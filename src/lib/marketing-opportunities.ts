// Shared by /api/hubspot/executive-cohorts and /api/hubspot/executive-flow so the Cohort Funnel
// Table and the Business Flow cards can never disagree on what counts as a marketing Opportunity.

const HUBSPOT_API_BASE = 'https://api.hubapi.com'
const CLOSED_WON_STAGE_ID = '982194449'
const CLOSED_LOST_STAGE_IDS = new Set(['982194450', '982194451']) // Closed Lost + Dropped

export const STUDIO_DEALS_PIPELINE_ID = '668588091'
// Same "marketing efforts driven" deal filter as /api/hubspot/sql-to-opportunity-monthly and
// pipeline-trend: Studio Deals pipeline, deal_source in {Direct, Inbound, Marketing}. The cohort
// contacts are already Book-a-Demo by construction, which covers that filter's contact half.
// Widened 2026-10-04 per explicit request: Partner Lead, SI Partner, HyperScalar and Event deals
// also count as marketing-driven. Still excluded: Referral, Repeat Customer, and blank deal_source.
// 'Direct' (labelled "Direct / Outbound" in HubSpot) is back IN as of 2026-10-05 per explicit request:
// every contact this is applied to is a Book a Demo form submitter, i.e. it already has a marketing
// touchpoint, so a sales-set "Direct" source on its deal does not make it non-marketing (e.g. First
// Hospitality and BNP Paribas, both August Book a Demo leads on Direct traffic). Still excluded:
// Referral, Repeat Customer and blank deal_source.
export const MARKETING_DEAL_SOURCES = new Set(['Direct', 'Inbound', 'Marketing', 'Partner Lead', 'SI Partner', 'HyperScalar', 'Event'])
export const DEAL_SOURCE_LABELS: Record<string, string> = { Direct: 'Direct / Outbound', HyperScalar: 'HyperScalers' }

// --- Deal loading (shared, rate-limit safe) ------------------------------------------------------------
// History: classifyOutcomes / fetchOpportunityDetails used to make 1 + N GET calls per contact and treated
// ANY non-OK response (including HTTP 429 rate limits) as "this contact has no deal". When the Executive page
// fired its routes in parallel, later months hit the rate limit and came back as 0 opportunities / $0 - and
// that wrong result was then cached (flagged 2026-11-02: Sep/Oct pipeline showed $0 while HubSpot had 9 deals).
// Now: two batch endpoints (v4 associations, v3 deals batch/read), retries on 429/5xx, and a hard error if a
// call still fails - the route then returns 500 and caches nothing, instead of caching a silently-low number.

async function hubspotPost(apiKey: string, path: string, body: unknown): Promise<any> {
  let lastStatus = 0
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(`${HUBSPOT_API_BASE}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) return res.json()
    lastStatus = res.status
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = parseFloat(res.headers.get('retry-after') || '')
      await new Promise(r => setTimeout(r, Number.isFinite(retryAfter) ? retryAfter * 1000 : 1000 * (attempt + 1)))
      continue
    }
    break
  }
  throw new Error(`HubSpot ${path} failed (${lastStatus})`)
}

type QualifyingDeal = {
  id: string; dealname: string; amount: number; dealstage: string; deal_source: string
  createdate: string; enteredCurrentStage: string
}

/** contactId -> its Studio Deals pipeline deals with a marketing deal_source (contacts without one are absent). */
export async function loadQualifyingDeals(apiKey: string, contactIds: string[]): Promise<Map<string, QualifyingDeal[]>> {
  const out = new Map<string, QualifyingDeal[]>()
  const ids = Array.from(new Set(contactIds.map(String)))
  if (ids.length === 0) return out

  const dealsOfContact = new Map<string, string[]>()
  for (let i = 0; i < ids.length; i += 500) {
    const data = await hubspotPost(apiKey, '/crm/v4/associations/contacts/deals/batch/read', { inputs: ids.slice(i, i + 500).map(id => ({ id })) })
    for (const r of data.results || []) dealsOfContact.set(String(r.from?.id), (r.to || []).map((t: any) => String(t.toObjectId)))
  }

  const allDealIds = Array.from(new Set(Array.from(dealsOfContact.values()).flat()))
  const deals = new Map<string, any>()
  for (let i = 0; i < allDealIds.length; i += 100) {
    const data = await hubspotPost(apiKey, '/crm/v3/objects/deals/batch/read', {
      properties: ['dealname', 'amount', 'dealstage', 'pipeline', 'deal_source', 'createdate', 'hs_v2_date_entered_current_stage'],
      inputs: allDealIds.slice(i, i + 100).map(id => ({ id })),
    })
    for (const d of data.results || []) deals.set(String(d.id), d.properties || {})
  }

  for (const [contactId, dealIds] of dealsOfContact) {
    const q: QualifyingDeal[] = []
    for (const id of dealIds) {
      const p = deals.get(id)
      if (!p || p.pipeline !== STUDIO_DEALS_PIPELINE_ID || !MARKETING_DEAL_SOURCES.has(p.deal_source)) continue
      q.push({
        id, dealname: p.dealname || '', amount: parseFloat(p.amount || '0') || 0, dealstage: p.dealstage || '',
        deal_source: p.deal_source, createdate: p.createdate || '', enteredCurrentStage: p.hs_v2_date_entered_current_stage || p.createdate || '',
      })
    }
    if (q.length) out.set(contactId, q)
  }
  return out
}

/**
 * Deal-based Opportunities for a fixed cohort of contacts, as of right now. A cohort contact
 * counts as an Opportunity ONLY if it has at least one associated Studio Deals pipeline deal whose
 * deal_source is in MARKETING_DEAL_SOURCES — the contact's own `lifecyclestage` label is never
 * consulted. Outcome per qualifying contact: WON if any qualifying deal is Closed Won, else LOST if
 * one is Closed Lost/Dropped, else STILL_OPEN.
 */
export async function classifyOutcomes(apiKey: string, candidates: Array<{ id: string; channel: string }>) {
  let won = 0, lost = 0, stillOpen = 0
  const opportunityContactIds = new Set<string>()
  const bySource: Record<string, number> = {}
  const byChannel: Record<string, number> = {}
  const channelOf = new Map(candidates.map(c => [String(c.id), c.channel]))
  const qualifying = await loadQualifyingDeals(apiKey, candidates.map(c => String(c.id)))
  for (const [id, deals] of qualifying) {
    opportunityContactIds.add(id)
    const srcLabel = DEAL_SOURCE_LABELS[deals[0].deal_source] || deals[0].deal_source
    bySource[srcLabel] = (bySource[srcLabel] || 0) + 1
    const ch = channelOf.get(id) || 'Unknown'
    byChannel[ch] = (byChannel[ch] || 0) + 1
    if (deals.some(d => d.dealstage === CLOSED_WON_STAGE_ID)) won++
    else if (deals.some(d => CLOSED_LOST_STAGE_IDS.has(d.dealstage))) lost++
    else stillOpen++
  }
  return { won, lost, stillOpen, opportunityCount: opportunityContactIds.size, opportunityContactIds, bySource, byChannel }
}

/**
 * Best-available marketing channel for a contact. `lead_source_category` alone is unreliable
 * ("Direct" is the default for contacts created by an integration/sync, which have NO web
 * attribution: original source OFFLINE), so paid signals (original source / UTMs) win first,
 * then a real category, then the original source, and finally an explicit "Unattributed".
 */
export function resolveChannel(props: Record<string, string | null | undefined>): string {
  const cat = props.lead_source_category || ''
  const orig = props.hs_analytics_source || ''
  const utm = `${props.utm_source || ''} ${props.utm_medium || ''}`.toLowerCase()
  if (orig === 'PAID_SEARCH' || orig === 'PAID_SOCIAL' || /google ads|googleads|linkedin ads|pmax|cpc|paid/.test(utm)) return 'Paid Campaigns'
  if (cat && cat !== 'Direct' && cat !== 'Platform') return cat
  if (orig === 'ORGANIC_SEARCH') return 'Organic Search'
  if (orig === 'SOCIAL_MEDIA') return 'Social'
  if (orig === 'REFERRALS') return 'Referral'
  if (orig === 'DIRECT_TRAFFIC') return 'Direct'
  if (cat === 'Platform') return 'Platform'
  return 'Unattributed (offline / integration)'
}


// --- Opportunity details (value / stage / age) for the Executive Dashboard pipeline breakdown ---------

export const STAGE_INFO: Record<string, { label: string; group: 'top' | 'middle' | 'bottom' | 'won' | 'lost' | 'stalled' }> = {
  '982424357': { label: 'Discovery Call', group: 'top' },
  '982424358': { label: 'Qualification', group: 'top' },
  '982424359': { label: 'Solution Validation', group: 'middle' },
  '982424360': { label: 'Proposal', group: 'middle' },
  '982194447': { label: 'Negotiation', group: 'bottom' },
  '982194448': { label: 'Legal & Contracts', group: 'bottom' },
  '982194449': { label: 'Closed Won', group: 'won' },
  '982194450': { label: 'Closed Lost', group: 'lost' },
  '982194451': { label: 'Dropped', group: 'lost' },
  '1068884838': { label: 'Stalled', group: 'stalled' },
}
/** An open deal that has sat in the same top/middle/stalled stage longer than this is flagged as stuck. */
export const STUCK_AFTER_DAYS = 30

export type OpportunityDetail = {
  contactId: string
  dealId: string
  name: string
  amount: number
  stageId: string
  stage: string
  group: 'top' | 'middle' | 'bottom' | 'won' | 'lost' | 'stalled' | 'unknown'
  dealSource: string
  channel: string
  createdAt: string
  daysInStage: number
  stuck: boolean
}

/**
 * One row per cohort contact that counts as an Opportunity (same qualification as classifyOutcomes). When a
 * contact has several qualifying deals the one with the largest amount (then the newest) is used, so the
 * count stays "contacts" like the cohort table while the value is that deal's amount.
 */
export async function fetchOpportunityDetails(apiKey: string, candidates: Array<{ id: string; channel: string }>, preloaded?: Map<string, QualifyingDeal[]>): Promise<OpportunityDetail[]> {
  const qualifying = preloaded ?? await loadQualifyingDeals(apiKey, candidates.map(c => String(c.id)))
  const out: OpportunityDetail[] = []
  for (const cand of candidates) {
    const deals = qualifying.get(String(cand.id))
    if (!deals?.length) continue
    const best = [...deals].sort((x, y) => (y.amount - x.amount) || String(y.createdate).localeCompare(String(x.createdate)))[0]
    const info = STAGE_INFO[best.dealstage]
    const daysInStage = Math.max(0, Math.floor((Date.now() - new Date(best.enteredCurrentStage).getTime()) / 86_400_000))
    const group = info?.group ?? 'unknown'
    const open = group === 'top' || group === 'middle' || group === 'stalled'
    out.push({
      contactId: String(cand.id), dealId: best.id, name: best.dealname || '(unnamed)', amount: best.amount,
      stageId: best.dealstage, stage: info?.label ?? best.dealstage, group,
      dealSource: DEAL_SOURCE_LABELS[best.deal_source] || best.deal_source,
      channel: cand.channel, createdAt: best.createdate, daysInStage, stuck: open && daysInStage > STUCK_AFTER_DAYS,
    })
  }
  return out
}


/**
 * Contacts whose CURRENT lifecycle stage was copied by HubSpot from their company record (history source = COMPANIES,
 * "LifecycleChangeToContactUpdate: triggered by companyId") - no person or workflow moved them, so they must not count as
 * having progressed. Shared by the Cohort Funnel Table, the Business Flow cards and the MQL page so "SQL" means the same thing
 * everywhere (2026-10-26 unification).
 */
export async function companyCopiedStageIds(apiKey: string, contactIds: string[]): Promise<Set<string>> {
  const flagged = new Set<string>()
  try {
    for (let i = 0; i < contactIds.length; i += 50) {
      for (let attempt = 0; attempt < 4; attempt++) {
        const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/batch/read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ propertiesWithHistory: ['lifecyclestage'], properties: ['lifecyclestage'], inputs: contactIds.slice(i, i + 50).map(id => ({ id: String(id) })) }),
        })
        if (res.status === 429 || res.status >= 500) { await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); continue }
        if (!res.ok) break
        const data = await res.json()
        for (const r of data.results || []) {
          const latest = (r.propertiesWithHistory?.lifecyclestage || [])[0]
          if (latest?.sourceType === 'COMPANIES' && String(latest?.sourceId || '').startsWith('LifecycleChangeToContactUpdate')) flagged.add(String(r.id))
        }
        break
      }
    }
  } catch { /* best effort: on failure nothing is excluded (never inflates the number silently - the caller still caches only on success paths) */ }
  return flagged
}
