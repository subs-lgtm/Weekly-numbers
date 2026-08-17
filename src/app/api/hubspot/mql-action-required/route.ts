import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/hubspot/mql-action-required
 *
 * Surfaces operational issues from live HubSpot contact data for the given date range:
 *   1. High-priority MQLs with no SDR movement (still OPEN) for 24h+
 *   2. Demo no-shows with no follow-up status change since the no-show
 *   3. SQLs (lifecyclestage) with no Opportunity yet, grouped by owner
 *   4. High-priority MQLs within 4h of a 24h SLA breach
 *   5. Opportunities with no activity (lastmodifieddate) in 5+ days
 *
 * IMPORTANT DATA LIMITATION (documented, not glossed over):
 * HubSpot's contacts search API does not expose property-change history — only
 * current state (`hs_lead_status`, `lifecyclestage`) plus `createdate` and
 * `lastmodifieddate`. So "time since entering a status" is approximated using
 * `createdate` (time since lead creation) rather than the true time the contact
 * entered that specific status. This is the same proxy already used elsewhere
 * in this app (see working-leads-performance route). It is a reasonable
 * approximation for MQLs that go OPEN -> Working quickly, but is NOT exact for
 * leads that sat in one status, moved, then moved back.
 */

const HUBSPOT_API_BASE = 'https://api.hubapi.com'

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
    if (!res.ok) {
      if (res.status === 429) { await new Promise(r => setTimeout(r, 1100)); continue }
      const err = await res.text()
      throw new Error(`HubSpot search failed: ${err.substring(0, 200)}`)
    }
    const data = await res.json()
    results.push(...(data.results || []))
    const nextPage = data.paging?.next?.after
    if (!nextPage || data.results?.length === 0) break
    after = nextPage
    await new Promise(r => setTimeout(r, 150))
  }
  return results
}

export const maxDuration = 120

// SLA policy — high priority MQLs should get first SDR touch within 24h.
const HIGH_PRIORITY_SLA_HOURS = 24
const OPPORTUNITY_STALE_DAYS = 5

const SQL_STAGES = new Set(['salesqualifiedlead', 'opportunity', '249550600', 'customer'])
const OPP_STAGES = new Set(['249550600', 'customer'])

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
    const startMs = new Date(start + 'T00:00:00.000Z').getTime()
    const endMs = new Date(end + 'T00:00:00.000Z').getTime()
    const dateFilters = [
      { propertyName: 'createdate', operator: 'GTE', value: startMs.toString() },
      { propertyName: 'createdate', operator: 'LT', value: endMs.toString() },
      { propertyName: 'email', operator: 'NOT_CONTAINS_TOKEN', value: 'lyzr.ai' },
      { propertyName: 'lead_form_type', operator: 'HAS_PROPERTY' },
    ]

    const PROPERTIES = [
      'lyzr_lead_score_category', 'lyzr_lead_score', 'hs_lead_status', 'lifecyclestage',
      'firstname', 'lastname', 'company', 'hubspot_owner_id', 'createdate', 'lastmodifieddate',
      'num_associated_deals',
    ]

    const contacts = await searchAll(apiKey, [{ filters: dateFilters }], PROPERTIES)

    // Owner name map
    const ownerMap: Record<string, string> = {}
    try {
      const ownersRes = await fetch(`${HUBSPOT_API_BASE}/crm/v3/owners?limit=100`, { headers: { Authorization: `Bearer ${apiKey}` } })
      if (ownersRes.ok) {
        const ownersData = await ownersRes.json()
        for (const o of (ownersData.results || [])) {
          ownerMap[String(o.id)] = [o.firstName, o.lastName].filter(Boolean).join(' ') || o.email || String(o.id)
        }
      }
    } catch {}

    const now = Date.now()
    const hoursSince = (iso: string | undefined) => iso ? (now - new Date(iso).getTime()) / 3_600_000 : null
    const daysSince = (iso: string | undefined) => iso ? (now - new Date(iso).getTime()) / 86_400_000 : null

    type Item = { id: string; name: string; company: string; owner: string; detail: string }

    // 1. High-priority, still OPEN, 24h+ since creation
    const staleHighPriority: Item[] = []
    // 4. High-priority within 4h of 24h SLA breach (i.e. 20h-24h since creation, still OPEN)
    const slaAtRisk: Item[] = []
    // 2. Demo no-shows with no status change since
    const noShowNeedsFollowup: Item[] = []
    // 3. SQL without Opportunity, grouped by owner
    const sqlWithoutOpp: Item[] = []
    const sqlWithoutOppByOwner: Record<string, number> = {}
    // 5. Stale opportunities (lifecyclestage Opp+, no activity in 5+ days)
    const staleOpportunities: Item[] = []

    for (const c of contacts) {
      const p = c.properties || {}
      const name = [p.firstname, p.lastname].filter(Boolean).join(' ') || p.email || '—'
      const company = p.company || '—'
      const owner = ownerMap[p.hubspot_owner_id] || '—'
      const cat = p.lyzr_lead_score_category || ''
      const status = p.hs_lead_status || ''
      const stage = p.lifecyclestage || ''
      const hrsSinceCreate = hoursSince(p.createdate)
      const daysSinceModified = daysSince(p.lastmodifieddate)

      if (cat === 'high_priority' && status === 'OPEN' && hrsSinceCreate !== null) {
        if (hrsSinceCreate >= HIGH_PRIORITY_SLA_HOURS) {
          staleHighPriority.push({ id: c.id, name, company, owner, detail: `${Math.floor(hrsSinceCreate)}h since creation, no SDR contact` })
        } else if (hrsSinceCreate >= HIGH_PRIORITY_SLA_HOURS - 4) {
          slaAtRisk.push({ id: c.id, name, company, owner, detail: `${Math.floor(HIGH_PRIORITY_SLA_HOURS - hrsSinceCreate)}h until SLA breach` })
        }
      }

      if (status === 'Demo no show' && daysSinceModified !== null && daysSinceModified >= 1) {
        noShowNeedsFollowup.push({ id: c.id, name, company, owner, detail: `No-show ${Math.floor(daysSinceModified)}d ago, no follow-up status change` })
      }

      if (SQL_STAGES.has(stage) && !OPP_STAGES.has(stage)) {
        sqlWithoutOpp.push({ id: c.id, name, company, owner, detail: 'SQL stage, no Opportunity yet' })
        sqlWithoutOppByOwner[owner] = (sqlWithoutOppByOwner[owner] || 0) + 1
      }

      if (OPP_STAGES.has(stage) && daysSinceModified !== null && daysSinceModified >= OPPORTUNITY_STALE_DAYS) {
        staleOpportunities.push({ id: c.id, name, company, owner, detail: `No activity in ${Math.floor(daysSinceModified)}d` })
      }
    }

    // Find the owner with the largest SQL-without-opp backlog
    const worstOwnerEntry = Object.entries(sqlWithoutOppByOwner).sort((a, b) => b[1] - a[1])[0]

    return NextResponse.json({
      date_range: { start, end },
      sla_policy: { high_priority_hours: HIGH_PRIORITY_SLA_HOURS, opportunity_stale_days: OPPORTUNITY_STALE_DAYS },
      data_note: 'Time-based fields use createdate/lastmodifieddate as a proxy — HubSpot does not expose property-change history via the search API.',
      items: {
        stale_high_priority: { count: staleHighPriority.length, examples: staleHighPriority.slice(0, 10) },
        no_show_needs_followup: { count: noShowNeedsFollowup.length, examples: noShowNeedsFollowup.slice(0, 10) },
        sql_without_opportunity: {
          count: sqlWithoutOpp.length,
          examples: sqlWithoutOpp.slice(0, 10),
          worst_owner: worstOwnerEntry ? { owner: worstOwnerEntry[0], count: worstOwnerEntry[1] } : null,
          by_owner: sqlWithoutOppByOwner,
        },
        sla_at_risk: { count: slaAtRisk.length, examples: slaAtRisk.slice(0, 10) },
        stale_opportunities: { count: staleOpportunities.length, examples: staleOpportunities.slice(0, 10) },
      },
    })
  } catch (err: any) {
    console.error('[hubspot/mql-action-required]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
