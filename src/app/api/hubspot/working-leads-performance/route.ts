import { NextRequest, NextResponse } from 'next/server'

/**
 * /api/hubspot/working-leads-performance
 *
 * Returns comprehensive Working Leads Performance data:
 * - Section 1: Funnel (Working → Demo Booked → Opportunity → Customer)
 * - Section 2: Aging analysis (how long leads sit in Working)
 * - Section 3: Weekly cohort analysis (conversion by entry week)
 *
 * Field mapping (specific to this HubSpot account):
 * - "Working" stage = hs_lead_status = "Working"
 * - "Demo Booked" = hs_lead_status IN ("Demo Booked", "Demo Completed", "Demo Completed - PLG", etc.)
 * - Opportunity = lifecyclestage = "opportunity" OR "249550600"
 * - Customer = lifecyclestage = "customer"
 * - Stage entry timestamp proxy = createdate (HubSpot doesn't expose hs_lead_status change timestamps via search API)
 *   Note: This means "days in Working" is actually "days since lead was created" which is a reasonable proxy
 *   since leads enter Working within hours of creation via our webhook automation.
 */

const HUBSPOT_API_BASE = 'https://api.hubapi.com'

export const maxDuration = 120

// Stage definitions — configurable for future HubSpot changes
const STAGE_CONFIG = {
  working: { field: 'hs_lead_status', values: ['Working'] },
  demoBooked: {
    field: 'hs_lead_status',
    values: ['Demo Booked', 'Demo Completed', 'Demo Completed - PLG', 'Demo no show', 'Demo Cancelled by Client', 'Demo Completed - Ghosting', 'Demo Completed - Disqualified'],
  },
  opportunity: { field: 'lifecyclestage', values: ['opportunity', '249550600'] },
  customer: { field: 'lifecyclestage', values: ['customer'] },
}

async function searchAll(apiKey: string, filterGroups: object[], properties: string[]): Promise<any[]> {
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
    if (res.status === 429) { await new Promise(r => setTimeout(r, 1100)); continue }
    if (!res.ok) { const err = await res.text(); throw new Error(`HubSpot: ${err.substring(0, 200)}`) }
    const data = await res.json()
    results.push(...(data.results || []))
    if (data.paging?.next?.after) { after = data.paging.next.after; await new Promise(r => setTimeout(r, 150)) }
    else break
  }
  return results
}

function getWeekKey(date: Date): string {
  // Get Monday of the week
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'HUBSPOT_API_KEY not configured' }, { status: 500 })

  // Optional lookback period (default: 90 days for cohort analysis)
  const lookbackDays = parseInt(searchParams.get('lookback') || '90')
  const lookbackMs = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).getTime()

  try {
    const PROPS = [
      'email', 'firstname', 'lastname', 'company',
      'hs_lead_status', 'lifecyclestage', 'lead_form_type',
      'lead_source_category', 'lyzr_lead_score', 'lyzr_lead_score_category',
      'hs_latest_meeting_activity', 'num_associated_deals',
      'createdate', 'hubspot_owner_id', 'lsa_contact_owner',
    ]

    // Fetch ALL leads that have EVER been in Working or progressed past it (within lookback)
    // This gives us the full cohort picture
    // HubSpot allows max 5 filterGroups per request — split demo statuses into batches
    const commonFilters = [
      { propertyName: 'createdate', operator: 'GTE', value: lookbackMs.toString() },
      { propertyName: 'email', operator: 'NOT_CONTAINS_TOKEN', value: 'lyzr.ai' },
    ]

    const demoStatusesBatch1 = ['Demo Booked', 'Demo Completed', 'Demo Completed - PLG', 'Demo no show']
    const demoStatusesBatch2 = ['Demo Cancelled by Client', 'Demo Completed - Ghosting', 'Demo Completed - Disqualified']

    const [workingLeads, demoBookedBatch1, demoBookedBatch2, opportunityLeads, customerLeads] = await Promise.all([
      // Currently in Working — only Book a Demo form type
      searchAll(apiKey, [{ filters: [
        { propertyName: 'hs_lead_status', operator: 'EQ', value: 'Working' },
        { propertyName: 'lead_form_type', operator: 'CONTAINS_TOKEN', value: 'Book a Demo' },
        ...commonFilters,
      ] }], PROPS),
      // Demo Booked batch 1 (4 statuses = 4 filter groups) — Book a Demo only
      searchAll(apiKey, demoStatusesBatch1.map(v => ({ filters: [
        { propertyName: 'hs_lead_status', operator: 'EQ', value: v },
        { propertyName: 'lead_form_type', operator: 'CONTAINS_TOKEN', value: 'Book a Demo' },
        ...commonFilters,
      ] })), PROPS),
      // Demo Booked batch 2 (3 statuses = 3 filter groups) — Book a Demo only
      searchAll(apiKey, demoStatusesBatch2.map(v => ({ filters: [
        { propertyName: 'hs_lead_status', operator: 'EQ', value: v },
        { propertyName: 'lead_form_type', operator: 'CONTAINS_TOKEN', value: 'Book a Demo' },
        ...commonFilters,
      ] })), PROPS),
      // Opportunity lifecycle (2 filter groups) — Book a Demo only
      searchAll(apiKey, STAGE_CONFIG.opportunity.values.map(v => ({ filters: [
        { propertyName: 'lifecyclestage', operator: 'EQ', value: v },
        { propertyName: 'lead_form_type', operator: 'CONTAINS_TOKEN', value: 'Book a Demo' },
        ...commonFilters,
      ] })), PROPS),
      // Customer lifecycle (1 filter group) — Book a Demo only
      searchAll(apiKey, [{ filters: [
        { propertyName: 'lifecyclestage', operator: 'EQ', value: 'customer' },
        { propertyName: 'lead_form_type', operator: 'CONTAINS_TOKEN', value: 'Book a Demo' },
        ...commonFilters,
      ] }], PROPS),
    ])

    const demoBookedLeads = [...demoBookedBatch1, ...demoBookedBatch2]

    // Exclude disqualified/junk leads — these shouldn't count even if technically in "Working"
    // Lifecycle stages: 242934529 = "Discarded", 1331052807 = "Disqualified"
    // Lead statuses: Junk Lead, UNQUALIFIED, Stalled, Demo Completed - Disqualified, Demo Completed - Ghosting, Demo Cancelled by Client
    const DISQUALIFIED_LIFECYCLES = new Set(['242934529', '1331052807'])
    const DISQUALIFIED_STATUSES = new Set([
      'Junk Lead',
      'UNQUALIFIED',
      'Demo Completed - Disqualified',
      'Demo Completed - Ghosting',
    ])

    function isDisqualified(contact: any): boolean {
      const p = contact.properties || {}
      if (DISQUALIFIED_LIFECYCLES.has(p.lifecyclestage || '')) return true
      if (DISQUALIFIED_STATUSES.has(p.hs_lead_status || '')) return true
      return false
    }

    // Filter working leads to remove junk/disqualified
    const filteredWorkingLeads = workingLeads.filter(c => !isDisqualified(c))

    // Dedupe across all queries (also excluding disqualified from everything)
    const allLeadsMap = new Map<string, any>()
    for (const c of [...filteredWorkingLeads, ...demoBookedLeads, ...opportunityLeads, ...customerLeads]) {
      if (!allLeadsMap.has(c.id) && !isDisqualified(c)) allLeadsMap.set(c.id, c)
    }

    const now = Date.now()

    // ==========================================
    // HELPER: Check if a contact was ever in "Working" via property history
    // ==========================================
    async function wasEverWorking(contactId: string): Promise<boolean> {
      try {
        const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}?propertiesWithHistory=hs_lead_status`, {
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        })
        if (!res.ok) return false
        const data = await res.json()
        const history = data.propertiesWithHistory?.hs_lead_status || []
        return history.some((h: any) => h.value === 'Working')
      } catch { return false }
    }

    // Check history for demo/opp/customer leads in batches of 5
    async function classifyByWorkingHistory(contacts: any[]): Promise<{ viaWorking: any[]; direct: any[] }> {
      const viaWorking: any[] = []
      const direct: any[] = []
      for (let i = 0; i < contacts.length; i += 5) {
        const batch = contacts.slice(i, i + 5)
        const results = await Promise.all(batch.map(c => wasEverWorking(c.id)))
        for (let j = 0; j < batch.length; j++) {
          if (results[j]) viaWorking.push(batch[j])
          else direct.push(batch[j])
        }
        if (i + 5 < contacts.length) await new Promise(r => setTimeout(r, 200))
      }
      return { viaWorking, direct }
    }

    // ==========================================
    // SECTION 1: FUNNEL — split by "via Working" vs "direct"
    // ==========================================

    // Dedupe demo/opp/customer leads first
    const uniqueDemoLeads: any[] = []
    const demoBIds = new Set<string>()
    for (const c of demoBookedLeads) { if (!demoBIds.has(c.id)) { demoBIds.add(c.id); uniqueDemoLeads.push(c) } }

    const uniqueOppLeads: any[] = []
    const oppIds = new Set<string>()
    for (const c of opportunityLeads) { if (!oppIds.has(c.id)) { oppIds.add(c.id); uniqueOppLeads.push(c) } }

    const uniqueCustLeads: any[] = []
    const custIds = new Set<string>()
    for (const c of customerLeads) { if (!custIds.has(c.id)) { custIds.add(c.id); uniqueCustLeads.push(c) } }

    // Classify each group by whether they went through Working
    const [demoClassified, oppClassified, custClassified] = await Promise.all([
      classifyByWorkingHistory(uniqueDemoLeads),
      classifyByWorkingHistory(uniqueOppLeads),
      classifyByWorkingHistory(uniqueCustLeads),
    ])

    const funnelCounts = {
      working: filteredWorkingLeads.length,
      demoBooked: uniqueDemoLeads.length,
      demoViaWorking: demoClassified.viaWorking.length,
      demoDirect: demoClassified.direct.length,
      demoCompleted: 0,
      opportunity: uniqueOppLeads.length,
      oppViaWorking: oppClassified.viaWorking.length,
      oppDirect: oppClassified.direct.length,
      customer: uniqueCustLeads.length,
      custViaWorking: custClassified.viaWorking.length,
      custDirect: custClassified.direct.length,
    }

    // Count demo completed specifically
    for (const c of demoBookedLeads) {
      const status = c.properties?.hs_lead_status || ''
      if (status === 'Demo Completed' || status === 'Demo Completed - PLG') funnelCounts.demoCompleted++
    }

    // Conversion rates — based on "via Working" only (accurate SDR performance)
    const totalEntered = filteredWorkingLeads.length + funnelCounts.demoViaWorking
    const workingToDemoRate = totalEntered > 0 ? ((funnelCounts.demoViaWorking / totalEntered) * 100) : 0
    const workingToOppRate = totalEntered > 0 ? ((funnelCounts.oppViaWorking / totalEntered) * 100) : 0

    // ==========================================
    // SECTION 2: AGING (only currently Working leads)
    // ==========================================
    const agingBuckets = { '0-7': 0, '8-14': 0, '15-30': 0, '31-60': 0, '60+': 0 }
    const agingDays: number[] = []

    for (const c of filteredWorkingLeads) {
      const created = new Date(c.properties?.createdate || now).getTime()
      const daysInWorking = Math.floor((now - created) / (1000 * 60 * 60 * 24))
      agingDays.push(daysInWorking)

      if (daysInWorking <= 7) agingBuckets['0-7']++
      else if (daysInWorking <= 14) agingBuckets['8-14']++
      else if (daysInWorking <= 30) agingBuckets['15-30']++
      else if (daysInWorking <= 60) agingBuckets['31-60']++
      else agingBuckets['60+']++
    }

    agingDays.sort((a, b) => a - b)
    const avgDays = agingDays.length > 0 ? Math.round(agingDays.reduce((s, d) => s + d, 0) / agingDays.length) : 0
    const medianDays = agingDays.length > 0 ? agingDays[Math.floor(agingDays.length / 2)] : 0
    const over30 = agingDays.filter(d => d > 30).length
    const over60 = agingDays.filter(d => d > 60).length

    // ==========================================
    // SECTION 3: WEEKLY COHORT ANALYSIS
    // ==========================================
    // Only include leads that went through Working — so opportunities count under their creation week only
    const cohorts: Record<string, { entered: number; demoBooked: number; opportunity: number; customer: number; totalDaysToDemo: number; demoCount: number }> = {}

    const cohortLeads = [...filteredWorkingLeads, ...demoClassified.viaWorking, ...oppClassified.viaWorking, ...custClassified.viaWorking]
    const cohortSeen = new Set<string>()
    for (const c of cohortLeads) {
      if (cohortSeen.has(c.id)) continue
      cohortSeen.add(c.id)
      const p = c.properties || {}
      const created = new Date(p.createdate || now)
      const weekKey = getWeekKey(created)
      const status = p.hs_lead_status || ''
      const stage = p.lifecyclestage || ''

      if (!cohorts[weekKey]) cohorts[weekKey] = { entered: 0, demoBooked: 0, opportunity: 0, customer: 0, totalDaysToDemo: 0, demoCount: 0 }
      cohorts[weekKey].entered++

      // Check current stage
      const isDemoBooked = STAGE_CONFIG.demoBooked.values.includes(status)
      const isOpp = STAGE_CONFIG.opportunity.values.includes(stage) || stage === 'customer'
      const isCust = stage === 'customer'

      if (isDemoBooked) {
        cohorts[weekKey].demoBooked++
        if (p.hs_latest_meeting_activity) {
          const meetingDate = new Date(p.hs_latest_meeting_activity).getTime()
          const createdMs = created.getTime()
          const daysToDemo = Math.max(0, Math.floor((meetingDate - createdMs) / (1000 * 60 * 60 * 24)))
          cohorts[weekKey].totalDaysToDemo += daysToDemo
          cohorts[weekKey].demoCount++
        }
      }
      if (isOpp) cohorts[weekKey].opportunity++
      if (isCust) cohorts[weekKey].customer++
    }

    // Sort cohorts by week (most recent first), take last 12 weeks
    const sortedCohorts = Object.entries(cohorts)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 12)
      .map(([week, data]) => ({
        week,
        entered: data.entered,
        demoBooked: data.demoBooked,
        demoConversionRate: data.entered > 0 ? parseFloat(((data.demoBooked / data.entered) * 100).toFixed(1)) : 0,
        opportunity: data.opportunity,
        customer: data.customer,
        avgDaysToDemo: data.demoCount > 0 ? Math.round(data.totalDaysToDemo / data.demoCount) : null,
      }))
      .reverse() // Oldest first for chart

    return NextResponse.json({
      // Section 1: Funnel — split into "via Working" (SDR-worked) vs "direct" (skipped Working)
      funnel: {
        working: funnelCounts.working,
        demoBooked: funnelCounts.demoBooked,
        demoViaWorking: funnelCounts.demoViaWorking,
        demoDirect: funnelCounts.demoDirect,
        demoCompleted: funnelCounts.demoCompleted,
        opportunity: funnelCounts.opportunity,
        oppViaWorking: funnelCounts.oppViaWorking,
        oppDirect: funnelCounts.oppDirect,
        customer: funnelCounts.customer,
        custViaWorking: funnelCounts.custViaWorking,
        custDirect: funnelCounts.custDirect,
        totalEntered: totalEntered,
        workingToDemoRate: parseFloat(workingToDemoRate.toFixed(1)),
        workingToOppRate: parseFloat(workingToOppRate.toFixed(1)),
      },
      // Section 2: Aging
      aging: {
        buckets: agingBuckets,
        avgDays,
        medianDays,
        over30,
        over60,
        totalWorking: filteredWorkingLeads.length,
      },
      // Section 3: Cohorts
      cohorts: sortedCohorts,
      // Metadata
      meta: {
        lookbackDays,
        generatedAt: new Date().toISOString(),
        stageConfig: {
          working: 'hs_lead_status = "Working"',
          demoBooked: 'hs_lead_status IN (Demo Booked, Demo Completed, etc.)',
          opportunity: 'lifecyclestage IN (opportunity, 249550600)',
          customer: 'lifecyclestage = customer',
          agingProxy: 'createdate (leads enter Working within hours of creation via webhook)',
        },
      },
    })
  } catch (err: any) {
    console.error('[working-leads-performance]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
