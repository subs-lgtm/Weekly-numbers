import { NextRequest, NextResponse } from 'next/server'

const HUBSPOT_API_BASE = 'https://api.hubapi.com'

// Optional caching via Firebase Admin — fails gracefully if not configured
let cacheDb: any = null
function getCacheDb() {
  if (cacheDb !== undefined && cacheDb !== null) return cacheDb
  try {
    const { initializeApp, getApps, cert } = require('firebase-admin/app')
    const { getFirestore } = require('firebase-admin/firestore')
    const SA_EMAIL = process.env.SA_CLIENT_EMAIL || ''
    const SA_KEY = (process.env.SA_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    const PROJECT_ID = process.env.GCP_PROJECT_ID || 'abm-agent'
    if (!SA_EMAIL || !SA_KEY) { cacheDb = null; return null }
    const appName = 'mql-cache'
    const existing = getApps().find((a: any) => a.name === appName)
    const app = existing || initializeApp({ credential: cert({ projectId: PROJECT_ID, clientEmail: SA_EMAIL, privateKey: SA_KEY }) }, appName)
    cacheDb = getFirestore(app)
    return cacheDb
  } catch { cacheDb = null; return null }
}

async function getCached(start: string, end: string): Promise<any | null> {
  try {
    const db = getCacheDb()
    if (!db) return null
    const doc = await db.collection('mql_cache').doc(`${start}_${end}`).get()
    if (!doc.exists) return null
    const data = doc.data()!
    const cachedAt = data.cachedAt?.toDate?.() || new Date(0)
    const now = new Date()
    const ageMs = now.getTime() - cachedAt.getTime()
    // Past periods: cache for 7 days (data won't change for completed weeks)
    if (new Date(end + 'T00:00:00Z') < now) {
      if (ageMs < 604800000) return data.result // 7 day TTL for past periods
      return null
    }
    // Current period: cache for 1 hour
    if (ageMs < 3600000) return data.result
    return null
  } catch { return null }
}

async function setCache(start: string, end: string, result: any): Promise<void> {
  try {
    const db = getCacheDb()
    if (!db) return
    await db.collection('mql_cache').doc(`${start}_${end}`).set({ result, cachedAt: new Date(), start, end })
  } catch {}
}

async function searchAll(
  apiKey: string,
  filterGroups: object[],
  properties: string[],
): Promise<any[]> {
  const results: any[] = []
  let after: string | undefined

  while (true) {
    const body: any = { filterGroups, properties, limit: 100 }
    if (after) body.after = after

    const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      // Rate limit — wait and retry once
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 1100))
        continue
      }
      throw new Error(`HubSpot search failed: ${err.substring(0, 200)}`)
    }

    const data = await res.json()
    results.push(...(data.results || []))
    const nextPage = data.paging?.next?.after
    if (!nextPage || data.results?.length === 0) break
    after = nextPage
    // Small delay between pages to avoid rate limits
    await new Promise(r => setTimeout(r, 150))
  }

  return results
}

export const maxDuration = 300

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end params required' }, { status: 400 })
  }

  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'HUBSPOT_API_KEY not configured' }, { status: 500 })
  }

  try {
    const mode = searchParams.get('mode') // 'all' = all leads (no form type filter), default = MQLs only
    const noCache = searchParams.get('nocache') === '1'
    const includePipeline = searchParams.get('includePipeline') === '1' // opt-in: adds pipeline $ per source (expensive N+1 deal lookups)
    const includeClosedWon = searchParams.get('includeClosedWon') === '1' // opt-in: which Opportunity+ contacts have an associated Closed Won deal

    // Cache key must vary by includePipeline/includeClosedWon — otherwise a cached response
    // from one flag combination could be served for a request that explicitly asked for the other.
    const cacheKeyPrefix = `${mode === 'all' ? 'v4_all' : 'v4'}${includePipeline ? '_pipeline' : ''}${includeClosedWon ? '_closedwon' : ''}`

    // Check cache first (skip if nocache=1)
    if (!noCache) {
      const cached = await getCached(`${cacheKeyPrefix}_${start}`, end)
      if (cached) {
        return NextResponse.json(cached)
      }
    }

    const startMs = new Date(start + 'T00:00:00.000Z').getTime()
    const endMs = new Date(end + 'T00:00:00.000Z').getTime()

    const dateFilters = [
      { propertyName: 'createdate', operator: 'GTE', value: startMs.toString() },
      { propertyName: 'createdate', operator: 'LT', value: endMs.toString() },
      { propertyName: 'email', operator: 'NOT_CONTAINS_TOKEN', value: 'lyzr.ai' },
    ]

    // Fetch all properties needed for both MQL counts and funnel
    const CONTACT_PROPERTIES = [
      'lyzr_lead_score_category',
      'lyzr_lead_score',
      'lead_form_type',
      'lead_source_category',
      'email',
      'firstname',
      'lastname',
      'company',
      'jobtitle',
      'hs_lead_status',
      'hs_latest_meeting_activity',
      'hubspot_owner_id',
      // Funnel stage properties — from lead-analytics-dashboard/lib/hubspot.ts
      'lifecyclestage',    // marketingqualifiedlead, salesqualifiedlead, opportunity, 249550600, customer
      // 'hs_lead_status' already above
      'lsa_booked_demo',   // "Yes" when meeting-booked webhook fires
      'num_associated_deals',
      'createdate',
      'lastmodifieddate',
    ]

    const bookDemoContacts = await searchAll(
      apiKey,
      mode === 'all'
        ? [{ filters: [...dateFilters, { propertyName: 'lead_form_type', operator: 'HAS_PROPERTY' }] }] // All leads with any form type
        : [{ filters: [...dateFilters, { propertyName: 'lead_form_type', operator: 'CONTAINS_TOKEN', value: 'Book a Demo' }] },
           { filters: [...dateFilters, { propertyName: 'lead_form_type', operator: 'CONTAINS_TOKEN', value: 'Email Form' }] },
           { filters: [...dateFilters, { propertyName: 'lead_form_type', operator: 'CONTAINS_TOKEN', value: 'GSI and SI' }] },
           { filters: [...dateFilters, { propertyName: 'lead_form_type', operator: 'CONTAINS_TOKEN', value: 'Accenture' }] }],
      CONTACT_PROPERTIES,
    )

    // SDR-backfilled leads (entered directly into HubSpot, never through a marketing form) have
    // no lead_form_type, so the search above structurally can't see them. Broadening the base
    // query to "any contact missing lead_form_type" was tried and reverted — within some weeks
    // that pulled in thousands of unrelated bulk-imported/synced contacts (Total MQLs spiked to
    // 3,967 in testing). Instead, only the specific verified SDR leads are merged in by ID, kept
    // in their correct week via their real createdate — no risk of catching unrelated contacts.
    const KNOWN_SDR_BACKFILL_IDS = [
      '238937083235', // Chinaza Okpechi — Northern Trust
      '243363553069', // Celina Georgeadis — T-Mobile
      '238791426823', // Jeff Mikula — Coffee + Dunn
      '228441152383', // Juergen Sergeant — Colruyt Group
      '195487370882', // Michael Bayer — Wasabi
      '238244100972', // Nino Obach — SweldoMo Software
      '220162180252', // Aditya Arora — BridgeNext
      '243310324600', // Manuel A. Casas — Course5i
      '241511041832', // Yusra Mahmood — Nazztec
      '243363724359', // Bo White — AlignXGlobal
      '235640751682', // John Kennedy — Actual.Ai
      '65300007351',  // Arpit Ahuja — Medicto
      '150935578902', // Kris B — NeXera Technologies
      '194676488476', // Jeffrey Taylor — Never Lose Money Strategy
      '45236939173',  // Kunal Verma — Apexal / infrahive.io
      '237903011106', // Terry Ng — Chow Tai Fook
      '141097453904', // Mihir Mehta — Celestite
    ]
    let sdrBackfillContacts: any[] = []
    if (mode !== 'all') {
      try {
        const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/batch/read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ properties: CONTACT_PROPERTIES, inputs: KNOWN_SDR_BACKFILL_IDS.map(id => ({ id })) }),
        })
        if (res.ok) {
          const data = await res.json()
          // Only keep the ones whose real createdate actually falls in the week/month being
          // queried — otherwise every one of these 17 would double-count into every period.
          sdrBackfillContacts = (data.results || []).filter((c: any) => {
            const created = new Date(c.properties?.createdate || 0).getTime()
            return created >= startMs && created < endMs
          })
        }
      } catch { /* non-blocking — falls back to the base search result if this fails */ }
    }

    // Deduplicate by contact ID
    const seen = new Set<string>()
    const contacts: any[] = []
    for (const c of [...bookDemoContacts, ...sdrBackfillContacts]) {
      if (!seen.has(c.id)) {
        seen.add(c.id)
        contacts.push(c)
      }
    }

    // Fetch all HubSpot owners once and build id→firstName+lastName map
    // Used to resolve hubspot_owner_id to a human-readable name in contactsByPriority
    const ownerMap: Record<string, string> = {}
    try {
      const ownersRes = await fetch(`${HUBSPOT_API_BASE}/crm/v3/owners?limit=100`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (ownersRes.ok) {
        const ownersData = await ownersRes.json()
        for (const o of (ownersData.results || [])) {
          const name = [o.firstName, o.lastName].filter(Boolean).join(' ') || o.email || String(o.id)
          ownerMap[String(o.id)] = name
        }
      }
    } catch { /* non-blocking — owner names will show as '—' if this fails */ }

    let high = 0, medium = 0, low = 0, unknown = 0
    const byFormType: Record<string, number> = {}
    const bySourceCategory: Record<string, number> = {}
    const formTypeBreakdown: Record<string, { working: number; ads: number; website: number }> = {}

    // contacts_by_priority — populated as we loop, returned for click-through drill-down
    const contactsByPriority: Record<string, Array<{
      id: string; name: string; email: string; company: string; jobTitle: string;
      score: number; formType: string; source: string; status: string; owner: string;
    }>> = { high: [], medium: [], low: [], unknown: [] }

    // Funnel — exact same logic as lead-analytics-dashboard/lib/hubspot.ts computeFunnel()
    // lifecyclestage values: marketingqualifiedlead, salesqualifiedlead, opportunity, 249550600 (Opportunity custom), customer
    // hs_lead_status values: Demo Booked, Demo Completed, Demo Completed - PLG, Demo Completed - Disqualified,
    //                        Demo no show, Demo Cancelled by Client, Demo Completed - Ghosting
    let demoBooked = 0
    let demoCompleted = 0
    let demoNoShow = 0
    let sql = 0        // salesqualifiedlead | opportunity | 249550600 | customer
    let opportunity = 0 // 249550600 | customer
    let customer = 0
    let meetingBooked = 0 // contacts with hs_latest_meeting_activity set (actual meeting exists)
    let paidMqls = 0 // contacts from paid campaigns (Paid Campaigns or Paid Search / Paid Social)
    let qualifiedMqls = 0 // contacts with lyzr_lead_score > 40
    let workingMqls = 0 // contacts with hs_lead_status = "Working"
    let bookDemoLinkedInAds = 0 // Book a Demo + Email Form leads from Paid Campaigns
    let bookDemoWebsite = 0 // Book a Demo + Email Form leads from non-paid sources
    let mqlStatusNew = 0
    let mqlStatusWorking = 0
    let mqlStatusDemoBooked = 0
    let mqlStatusDemoCompleted = 0
    let mqlStatusSql = 0
    let mqlStatusJunk = 0
    // Per-stage breakdown: working, linkedin ads, website for each funnel stage
    const stageBreakdown: Record<string, { working: number; linkedinAds: number; website: number; total: number }> = {
      mqls: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      new: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      working: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      demo_booked: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      demo_completed: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      sql: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      junk: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      qualified: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      opportunity: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      customer: { working: 0, linkedinAds: 0, website: 0, total: 0 },
    }

    const DEMO_BOOKED_STATUSES = new Set([
      'Demo Booked', 'Demo Completed', 'Demo Completed - PLG',
      'Demo Completed - Disqualified', 'Demo no show',
      'Demo Cancelled by Client', 'Demo Completed - Ghosting',
    ])
    const DEMO_COMPLETED_STATUSES = new Set(['Demo Completed', 'Demo Completed - PLG'])
    const DEMO_NO_SHOW_STATUSES = new Set(['Demo no show'])
    const SQL_STAGES = new Set(['salesqualifiedlead', 'opportunity', '249550600', 'customer'])
    const OPP_STAGES = new Set(['249550600', 'customer'])
    // Any lifecyclestage beyond blank/lead — used for the pure lifecycle-stage leakage funnel
    const MQL_PLUS_STAGES = new Set(['marketingqualifiedlead', 'salesqualifiedlead', 'opportunity', '249550600', 'customer'])
    // hs_lead_status progression for the lead-status leakage funnel (separate from lifecyclestage)
    // "Working or beyond" excludes fresh OPEN and disqualification exits (Junk Lead, UNQUALIFIED)
    const WORKING_OR_BEYOND_STATUSES = new Set([
      'Working', 'Stalled', 'Demo Booked', 'Demo Completed', 'Demo Completed - PLG',
      'Demo Completed - Disqualified', 'Demo no show', 'Demo Cancelled by Client',
      'Demo Completed - Ghosting', 'Associated with a deal',
    ])
    const ASSOCIATED_WITH_DEAL_STATUSES = new Set(['Associated with a deal'])
    // MQL form types that count as "Book a Demo" for the split
    const BOOK_DEMO_FORMS = new Set(['Book a Demo', 'Email Form', 'Pre-Built Agents'])

    // Raw (non-cumulative) distributions — current value counts, for breakdown tables
    const byLifecycleStageRaw: Record<string, number> = {}
    const byLeadStatusRaw: Record<string, number> = {}

    // Lifecycle-stage leakage funnel (pure lifecyclestage property, cumulative/subset)
    let lifecycleMqlPlus = 0
    let lifecycleSqlPlus = 0
    let lifecycleOppPlus = 0
    let lifecycleCustomer = 0

    // Lead-status leakage funnel (pure hs_lead_status property, cumulative/subset)
    let statusWorkingPlus = 0
    let statusDemoBookedPlus = 0
    let statusDemoCompletedPlus = 0
    let statusAssociatedWithDeal = 0

    for (const c of contacts) {
      const props = c.properties || {}
      const cat = props.lyzr_lead_score_category || ''
      const formType = props.lead_form_type || 'Other'
      const sourceCat = props.lead_source_category || 'Other'
      const stage = props.lifecyclestage || ''
      const status = props.hs_lead_status || ''
      const hasMeeting = !!props.hs_latest_meeting_activity
      const leadScore = parseFloat(props.lyzr_lead_score || '0')

      if (cat === 'high_priority') high++
      else if (cat === 'medium_priority') medium++
      else if (cat === 'low_priority') low++
      else unknown++

      // Build contact detail record for click-through drill-down
      const contactDetail = {
        id: c.id,
        name: [props.firstname, props.lastname].filter(Boolean).join(' ') || '—',
        email: props.email || '—',
        company: props.company || '—',
        jobTitle: props.jobtitle || '—',
        score: parseFloat(props.lyzr_lead_score || '0'),
        formType: (props.lead_form_type?.split(';')[0] || 'Other').trim(),
        formTypes: (props.lead_form_type || '').split(';').map((s: string) => s.trim()).filter(Boolean),
        source: props.lead_source_category || 'Other',
        status: props.hs_lead_status || '—',
        lifecycleStage: props.lifecyclestage || '—',
        owner: ownerMap[props.hubspot_owner_id] || '—',
        createdate: props.createdate || null,
        lastmodifieddate: props.lastmodifieddate || null,
        demoBooked: DEMO_BOOKED_STATUSES.has(props.hs_lead_status || ''),
        demoCompleted: DEMO_COMPLETED_STATUSES.has(props.hs_lead_status || ''),
        demoNoShow: DEMO_NO_SHOW_STATUSES.has(props.hs_lead_status || ''),
      }
      if (cat === 'high_priority') contactsByPriority.high.push(contactDetail)
      else if (cat === 'medium_priority') contactsByPriority.medium.push(contactDetail)
      else if (cat === 'low_priority') contactsByPriority.low.push(contactDetail)
      else contactsByPriority.unknown.push(contactDetail)

      const primaryForm = (formType.split(';')[0] || 'Other').trim()
      // Merge Pre-Built Agents into Book a Demo
      const normalizedForm = primaryForm === 'Pre-Built Agents' ? 'Book a Demo' : primaryForm
      byFormType[normalizedForm] = (byFormType[normalizedForm] || 0) + 1
      bySourceCategory[sourceCat] = (bySourceCategory[sourceCat] || 0) + 1

      // Per-form-type breakdown: working / ads / website
      if (!formTypeBreakdown[normalizedForm]) formTypeBreakdown[normalizedForm] = { working: 0, ads: 0, website: 0 }
      if (status === 'Working') formTypeBreakdown[normalizedForm].working++
      if (sourceCat === 'Paid Campaigns' || sourceCat === 'Paid Search / Paid Social') formTypeBreakdown[normalizedForm].ads++
      else formTypeBreakdown[normalizedForm].website++

      if (DEMO_BOOKED_STATUSES.has(status)) demoBooked++
      if (DEMO_COMPLETED_STATUSES.has(status)) demoCompleted++
      if (DEMO_NO_SHOW_STATUSES.has(status)) demoNoShow++
      if (SQL_STAGES.has(stage)) sql++
      if (OPP_STAGES.has(stage)) opportunity++
      if (stage === 'customer') customer++
      if (hasMeeting) meetingBooked++

      // Raw distributions
      const stageKey = stage || '(blank)'
      const statusKey = status || '(blank)'
      byLifecycleStageRaw[stageKey] = (byLifecycleStageRaw[stageKey] || 0) + 1
      byLeadStatusRaw[statusKey] = (byLeadStatusRaw[statusKey] || 0) + 1

      // Lifecycle-stage leakage funnel (pure lifecyclestage, independent of hs_lead_status)
      if (MQL_PLUS_STAGES.has(stage)) lifecycleMqlPlus++
      if (SQL_STAGES.has(stage)) lifecycleSqlPlus++
      if (OPP_STAGES.has(stage)) lifecycleOppPlus++
      if (stage === 'customer') lifecycleCustomer++

      // Lead-status leakage funnel (pure hs_lead_status, independent of lifecyclestage)
      if (WORKING_OR_BEYOND_STATUSES.has(status)) statusWorkingPlus++
      if (DEMO_BOOKED_STATUSES.has(status)) statusDemoBookedPlus++
      if (DEMO_COMPLETED_STATUSES.has(status)) statusDemoCompletedPlus++
      if (ASSOCIATED_WITH_DEAL_STATUSES.has(status)) statusAssociatedWithDeal++
      if (sourceCat === 'Paid Campaigns' || sourceCat === 'Paid Search / Paid Social') paidMqls++
      if (leadScore > 40) qualifiedMqls++
      if (status === 'Working') workingMqls++

      // Book a Demo split: LinkedIn Ads (Paid) vs Website (organic/other)
      // Includes Book a Demo + Email Form + Pre-Built Agents form types
      const isBookDemo = BOOK_DEMO_FORMS.has(primaryForm) || normalizedForm === 'Book a Demo'
      const isPaid = sourceCat === 'Paid Campaigns' || sourceCat === 'Paid Search / Paid Social'
      const isWorking = status === 'Working'
      if (isBookDemo) {
        if (isPaid) bookDemoLinkedInAds++
        else bookDemoWebsite++
      }

      // Determine the single mutually-exclusive bucket for this contact
      let bucketKey = 'new'
      if (SQL_STAGES.has(stage)) {
        bucketKey = 'sql'
      } else if (status === 'Junk Lead' || status === 'Unqualified' || status === 'UNQUALIFIED') {
        bucketKey = 'junk'
      } else if (DEMO_COMPLETED_STATUSES.has(status)) {
        bucketKey = 'demo_completed'
      } else if (DEMO_BOOKED_STATUSES.has(status)) {
        bucketKey = 'demo_booked'
      } else if (status === 'Working' || status === 'CONNECTED' || status === 'No reply' || status === 'Associated with a deal') {
        bucketKey = 'working'
      } else {
        bucketKey = 'new'
      }

      // Increment counters
      if (bucketKey === 'sql') mqlStatusSql++
      else if (bucketKey === 'junk') mqlStatusJunk++
      else if (bucketKey === 'demo_completed') mqlStatusDemoCompleted++
      else if (bucketKey === 'demo_booked') mqlStatusDemoBooked++
      else if (bucketKey === 'working') mqlStatusWorking++
      else mqlStatusNew++

      // Increment stage breakdown for this specific bucket
      stageBreakdown[bucketKey].total++
      if (isWorking) stageBreakdown[bucketKey].working++
      if (isPaid) stageBreakdown[bucketKey].linkedinAds++
      else stageBreakdown[bucketKey].website++

      // Increment MQL (total) breakdown as well
      stageBreakdown['mqls'].total++
      if (isWorking) stageBreakdown['mqls'].working++
      if (isPaid) stageBreakdown['mqls'].linkedinAds++
      else stageBreakdown['mqls'].website++
    }

    const total = contacts.length
    const qualified = high + medium

    // Build per-source MQL/SQL/Opportunity/Customer breakdown
    // We loop contacts again to track stage per source
    const bySourceFunnel: Record<string, { total: number; mql: number; sql: number; opportunity: number; customer: number; working: number; pipelineValue: number }> = {}
    const sqlPlusContactIds: string[] = [] // for pipeline $ lookup — scoped to SQL+ only to keep deal-association calls light
    for (const c of contacts) {
      const props = c.properties || {}
      const src = props.lead_source_category || 'Direct'
      const stage = props.lifecyclestage || ''
      const status = props.hs_lead_status || ''
      if (!bySourceFunnel[src]) bySourceFunnel[src] = { total: 0, mql: 0, sql: 0, opportunity: 0, customer: 0, working: 0, pipelineValue: 0 }
      bySourceFunnel[src].total++
      if (['marketingqualifiedlead','opportunity','249550600','customer'].includes(stage)) bySourceFunnel[src].mql++
      if (SQL_STAGES.has(stage)) {
        bySourceFunnel[src].sql++
        sqlPlusContactIds.push(c.id)
      }
      if (OPP_STAGES.has(stage)) bySourceFunnel[src].opportunity++
      if (stage === 'customer') bySourceFunnel[src].customer++
      if (status === 'Working') bySourceFunnel[src].working++
    }

    // Pipeline $ per source — only for SQL+ contacts, batched to avoid rate limits.
    // GATED behind ?includePipeline=1 — this endpoint is called many times per page load
    // (WoW/MTD charts, comparison cards) and deal-association lookups are expensive at scale.
    // Only the Source Performance table on the MQL page requests this explicitly.
    if (includePipeline) {
      const contactSourceMap = new Map<string, string>()
      for (const c of contacts) {
        if (sqlPlusContactIds.includes(c.id)) {
          contactSourceMap.set(c.id, c.properties?.lead_source_category || 'Direct')
        }
      }
      const BATCH = 8
      for (let i = 0; i < sqlPlusContactIds.length; i += BATCH) {
        const batch = sqlPlusContactIds.slice(i, i + BATCH)
        const results = await Promise.all(batch.map(async (contactId) => {
          try {
            const assocRes = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}/associations/deals?limit=5`, {
              headers: { Authorization: `Bearer ${apiKey}` },
            })
            if (!assocRes.ok) return 0
            const assocData = await assocRes.json()
            const dealIds = (assocData.results || []).map((r: any) => r.id)
            if (dealIds.length === 0) return 0
            let sum = 0
            for (const dealId of dealIds) {
              const dealRes = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/deals/${dealId}?properties=amount`, {
                headers: { Authorization: `Bearer ${apiKey}` },
              })
              if (dealRes.ok) {
                const dealData = await dealRes.json()
                sum += parseFloat(dealData.properties?.amount || '0') || 0
              }
            }
            return sum
          } catch { return 0 }
        }))
        results.forEach((amount, idx) => {
          const contactId = batch[idx]
          const src = contactSourceMap.get(contactId) || 'Direct'
          if (bySourceFunnel[src]) bySourceFunnel[src].pipelineValue += amount
        })
        if (i + BATCH < sqlPlusContactIds.length) await new Promise(r => setTimeout(r, 150))
      }
    }

    // Which Opportunity+ contacts (lifecyclestage 249550600 or customer) have at least one
    // associated deal that reached Closed Won in the Studio Deals pipeline. GATED behind
    // ?includeClosedWon=1 — scoped to Opportunity+ only (typically a handful of contacts)
    // to keep the N+1 deal-association lookups cheap.
    const closedWonContactIds: string[] = []
    if (includeClosedWon) {
      const CLOSED_WON_STAGE_ID = '982194449'
      const oppPlusContactIds = contacts
        .filter(c => OPP_STAGES.has(c.properties?.lifecyclestage || ''))
        .map(c => c.id)
      const BATCH2 = 8
      for (let i = 0; i < oppPlusContactIds.length; i += BATCH2) {
        const batch = oppPlusContactIds.slice(i, i + BATCH2)
        const results = await Promise.all(batch.map(async (contactId) => {
          try {
            const assocRes = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}/associations/deals?limit=5`, {
              headers: { Authorization: `Bearer ${apiKey}` },
            })
            if (!assocRes.ok) return false
            const assocData = await assocRes.json()
            const dealIds = (assocData.results || []).map((r: any) => r.id)
            if (dealIds.length === 0) return false
            for (const dealId of dealIds) {
              const dealRes = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/deals/${dealId}?properties=dealstage`, {
                headers: { Authorization: `Bearer ${apiKey}` },
              })
              if (dealRes.ok) {
                const dealData = await dealRes.json()
                if (dealData.properties?.dealstage === CLOSED_WON_STAGE_ID) return true
              }
            }
            return false
          } catch { return false }
        }))
        results.forEach((isClosedWon, idx) => {
          if (isClosedWon) closedWonContactIds.push(batch[idx])
        })
        if (i + BATCH2 < oppPlusContactIds.length) await new Promise(r => setTimeout(r, 150))
      }
    }

    const result = {
      total,
      mql_status_breakdown: {
        new: mqlStatusNew,
        working: mqlStatusWorking,
        demo_booked: mqlStatusDemoBooked,
        demo_completed: mqlStatusDemoCompleted,
        sql: mqlStatusSql,
        junk: mqlStatusJunk,
      },
      qualified,
      qualified_mqls: qualifiedMqls,
      high_priority: high,
      medium_priority: medium,
      low_priority: low,
      unknown_priority: unknown,
      paid_mqls: paidMqls,
      working_mqls: workingMqls,
      book_demo_linkedin_ads: bookDemoLinkedInAds,
      book_demo_website: bookDemoWebsite,
      stage_breakdown: stageBreakdown,
      by_form_type: byFormType,
      form_type_breakdown: formTypeBreakdown,
      by_source_category: bySourceCategory,
      by_source_funnel: bySourceFunnel,
      funnel: {
        mqls: total,
        meeting_booked: meetingBooked,
        demo_booked: demoBooked,
        demo_completed: demoCompleted,
        demo_no_show: demoNoShow,
        sql,
        opportunity,
        customer,
      },
      // Pure lifecyclestage-based funnel (independent of hs_lead_status) — for the
      // "Lifecycle Stage Leakage" analysis
      lifecycle_stage_funnel: {
        total,
        mql_plus: lifecycleMqlPlus,
        sql_plus: lifecycleSqlPlus,
        opportunity_plus: lifecycleOppPlus,
        customer: lifecycleCustomer,
      },
      // Pure hs_lead_status-based funnel (independent of lifecyclestage) — for the
      // "Lead Status Leakage" analysis
      lead_status_funnel: {
        total,
        working_plus: statusWorkingPlus,
        demo_booked_plus: statusDemoBookedPlus,
        demo_completed_plus: statusDemoCompletedPlus,
        associated_with_deal: statusAssociatedWithDeal,
      },
      by_lifecycle_stage_raw: byLifecycleStageRaw,
      by_lead_status_raw: byLeadStatusRaw,
      date_range: { start, end },
      contacts_by_priority: contactsByPriority,
      closed_won_contact_ids: closedWonContactIds,
    }

    // Cache the result (v2 prefix to invalidate old stale entries)
    await setCache(`${cacheKeyPrefix}_${start}`, end, result)

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[hubspot/mqls]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
