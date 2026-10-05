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

/**
 * Deal-based Opportunities for a fixed cohort of contacts, as of right now. A cohort contact
 * counts as an Opportunity ONLY if it has at least one associated Studio Deals pipeline deal whose
 * deal_source is Direct/Inbound/Marketing — the contact's own `lifecyclestage` label is never
 * consulted (it can say Opportunity/Customer with no deal behind it; confirmed on real September
 * contacts, user flagged Karim Sabbagh who has no deal in HubSpot at all). Outcome per qualifying
 * contact: WON if any qualifying deal is Closed Won, else LOST if one is Closed Lost/Dropped,
 * else STILL_OPEN.
 */
export async function classifyOutcomes(apiKey: string, candidates: Array<{ id: string; channel: string }>) {
  let won = 0, lost = 0, stillOpen = 0
  const opportunityContactIds = new Set<string>()
  const bySource: Record<string, number> = {}
  const byChannel: Record<string, number> = {}
  const contactIds = candidates.map(c => c.id)
  const channelOf = new Map(candidates.map(c => [c.id, c.channel]))

  const BATCH = 8
  for (let i = 0; i < contactIds.length; i += BATCH) {
    const batch = contactIds.slice(i, i + BATCH)
    const results = await Promise.all(batch.map(async (id) => {
      try {
        const assocRes = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${id}/associations/deals?limit=10`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        if (!assocRes.ok) return null
        const assocData = await assocRes.json()
        const dealIds = (assocData.results || []).map((r: any) => r.id)
        let qualifies = false, sawWon = false, sawLost = false, source = ''
        for (const dealId of dealIds) {
          const dealRes = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/deals/${dealId}?properties=dealstage,pipeline,deal_source`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          })
          if (!dealRes.ok) continue
          const props = (await dealRes.json()).properties || {}
          if (props.pipeline !== STUDIO_DEALS_PIPELINE_ID || !MARKETING_DEAL_SOURCES.has(props.deal_source)) continue
          qualifies = true
          if (!source) source = props.deal_source
          if (props.dealstage === CLOSED_WON_STAGE_ID) sawWon = true
          else if (CLOSED_LOST_STAGE_IDS.has(props.dealstage)) sawLost = true
        }
        if (!qualifies) return null
        return { id, source, outcome: sawWon ? 'WON' : sawLost ? 'LOST' : 'STILL_OPEN' }
      } catch { return null }
    }))
    for (const r of results) {
      if (!r) continue
      opportunityContactIds.add(r.id)
      const srcLabel = DEAL_SOURCE_LABELS[r.source] || r.source
      bySource[srcLabel] = (bySource[srcLabel] || 0) + 1
      const ch = channelOf.get(r.id) || 'Unknown'
      byChannel[ch] = (byChannel[ch] || 0) + 1
      if (r.outcome === 'WON') won++
      else if (r.outcome === 'LOST') lost++
      else stillOpen++
    }
    if (i + BATCH < contactIds.length) await new Promise(r => setTimeout(r, 150))
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

