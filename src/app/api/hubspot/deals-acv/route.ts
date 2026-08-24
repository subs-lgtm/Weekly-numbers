import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/hubspot/deals-acv
 *
 * Fetches all deals from the "Studio Deals" pipeline (668588091) in HubSpot.
 * Returns:
 *   - Total pipeline value (open, excl. closed lost/dropped)
 *   - Closed Won total
 *   - Monthly breakdown of deal creation (cumulative toward Q3 $30M goal)
 *   - By-stage breakdown
 *   - Top deals list with source + company
 *
 * Always fetches the FULL pipeline (no closedate filter on the HubSpot search itself) —
 * the "Q3 Progress" goal card needs the complete dataset to correctly count every deal
 * closing in Q3, not just ones that also happen to match whatever the UI's date filter is.
 *
 * Optional query params (applied in-memory, after the full fetch):
 *   ?from=YYYY-MM-DD  — narrow the main scorecards/charts to closedate >= from
 *   ?to=YYYY-MM-DD    — narrow the main scorecards/charts to closedate <= to
 * When omitted, the main scorecards/charts reflect the OVERALL pipeline (every deal ever
 * generated, regardless of when it's expected to close) — the Q3 Progress card is always
 * computed separately and stays scoped to Q3 2026 regardless of this filter.
 */

const HUBSPOT_API_BASE = 'https://api.hubapi.com'
const STUDIO_PIPELINE_ID = '668588091'

// Studio Deals pipeline stage map
const STAGE_NAMES: Record<string, string> = {
  '982424357': 'Discovery Call',
  '982424358': 'Qualification',
  '982424359': 'Solution Validation',
  '982424360': 'Proposal',
  '982194447': 'Negotiation',
  '982194448': 'Legal & Contracts',
  '982194449': 'Closed Won',
  '982194450': 'Closed Lost',
  '982194451': 'Dropped',
  '1068884838': 'Stalled',
}

const CLOSED_LOST_STAGES = new Set(['982194450', '982194451']) // Closed Lost + Dropped
const CLOSED_WON_STAGE = '982194449'

export const maxDuration = 120

// Fetch associated company name for a deal
async function fetchDealCompany(dealId: string, apiKey: string): Promise<string> {
  try {
    const res = await fetch(
      `${HUBSPOT_API_BASE}/crm/v3/objects/deals/${dealId}/associations/companies?limit=1`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    )
    if (!res.ok) return ''
    const data = await res.json()
    const companyId = data.results?.[0]?.id
    if (!companyId) return ''
    const cRes = await fetch(
      `${HUBSPOT_API_BASE}/crm/v3/objects/companies/${companyId}?properties=name`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    )
    if (!cRes.ok) return ''
    const cData = await cRes.json()
    return cData.properties?.name || ''
  } catch {
    return ''
  }
}

// Fetch associated contact's lead_source_category for a deal
async function fetchDealSource(dealId: string, apiKey: string): Promise<string> {
  try {
    const res = await fetch(
      `${HUBSPOT_API_BASE}/crm/v3/objects/deals/${dealId}/associations/contacts?limit=1`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    )
    if (!res.ok) return ''
    const data = await res.json()
    const contactId = data.results?.[0]?.id
    if (!contactId) return ''
    const cRes = await fetch(
      `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}?properties=lead_source_category,utm_source,hs_analytics_source`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    )
    if (!cRes.ok) return ''
    const cData = await cRes.json()
    const p = cData.properties || {}
    return p.lead_source_category || p.utm_source || p.hs_analytics_source || 'Direct'
  } catch {
    return ''
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  // Optional date filters for "this quarter" or custom range
  const fromParam = searchParams.get('from') // YYYY-MM-DD
  const toParam   = searchParams.get('to')   // YYYY-MM-DD
  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'HUBSPOT_API_KEY not configured' }, { status: 500 })
  }

  try {
    // Fetch every deal in the Studio Deals pipeline, unfiltered — paginate fully. The Q3
    // Progress card needs the complete dataset to correctly find every deal closing in
    // Q3 regardless of any date filter the UI has active; the from/to params (if given)
    // are applied in-memory below, only to the main scorecards/charts.
    const allDeals: any[] = []
    let after: string | undefined

    while (true) {
      const body: any = {
        filterGroups: [{
          filters: [
            { propertyName: 'pipeline', operator: 'EQ', value: STUDIO_PIPELINE_ID },
          ],
        }],
        properties: ['dealname', 'amount', 'dealstage', 'closedate', 'createdate', 'hubspot_owner_id'],
        sorts: [{ propertyName: 'createdate', direction: 'DESCENDING' }],
        limit: 100,
      }
      if (after) body.after = after

      const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/deals/search`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        if (res.status === 429) {
          await new Promise(r => setTimeout(r, 1100))
          continue
        }
        throw new Error(`HubSpot search failed: ${res.status}`)
      }

      const data = await res.json()
      allDeals.push(...(data.results || []))
      if (!data.paging?.next?.after || data.results?.length === 0) break
      after = data.paging.next.after
      await new Promise(r => setTimeout(r, 150))
    }

    // The main scorecards/charts reflect the OVERALL pipeline by default (every deal ever
    // generated) — narrowed only if the caller explicitly passed from/to. The Q3 Progress
    // goal card is intentionally separate: it always looks at the full, unfiltered dataset
    // below, scoped to closedate within Q3 2026, regardless of this filter.
    const fromMs = fromParam ? new Date(fromParam + 'T00:00:00.000Z').getTime() : null
    const toMs   = toParam   ? new Date(toParam   + 'T23:59:59.999Z').getTime() : null
    const filteredDeals = (fromMs === null && toMs === null)
      ? allDeals
      : allDeals.filter(d => {
          const cd = d.properties?.closedate ? new Date(d.properties.closedate).getTime() : null
          if (cd === null) return false
          if (fromMs !== null && cd < fromMs) return false
          if (toMs !== null && cd > toMs) return false
          return true
        })

    // Process deals
    let openPipeline = 0
    let closedWon = 0
    let closedLost = 0
    const byStage: Record<string, { count: number; amount: number }> = {}
    const byMonth: Record<string, { open: number; won: number; lost: number; count: number }> = {}
    const topDeals: Array<{ dealId: string; name: string; amount: number; stage: string; closeDate: string; created: string }> = []

    for (const d of filteredDeals) {
      const p = d.properties
      const amount = parseFloat(p.amount || '0')
      const stage = p.dealstage || ''
      const stageName = STAGE_NAMES[stage] || stage
      const created = p.createdate || ''
      const closeDate = p.closedate || ''

      // By stage
      if (!byStage[stageName]) byStage[stageName] = { count: 0, amount: 0 }
      byStage[stageName].count++
      byStage[stageName].amount += amount

      // Monthly cumulative (by deal create date)
      const monthKey = created ? created.substring(0, 7) : 'unknown' // YYYY-MM
      if (!byMonth[monthKey]) byMonth[monthKey] = { open: 0, won: 0, lost: 0, count: 0 }
      byMonth[monthKey].count++

      if (stage === CLOSED_WON_STAGE) {
        closedWon += amount
        byMonth[monthKey].won += amount
      } else if (CLOSED_LOST_STAGES.has(stage)) {
        closedLost += amount
        byMonth[monthKey].lost += amount
      } else {
        openPipeline += amount
        byMonth[monthKey].open += amount
      }

      // Top deals (open or won, sorted by amount later)
      if (!CLOSED_LOST_STAGES.has(stage) && amount > 0) {
        topDeals.push({
          dealId: d.id,
          name: p.dealname || 'Untitled',
          amount,
          stage: stageName,
          closeDate,
          created,
        })
      }
    }

    // Sort top deals by amount desc, take top 15
    topDeals.sort((a, b) => b.amount - a.amount)
    const top15raw = topDeals.slice(0, 15)

    // Enrich top 15 with company name and deal source (from associated contact)
    // Run in parallel batches of 5 to avoid overwhelming the API
    const top15: Array<{ name: string; amount: number; stage: string; closeDate: string; created: string; company: string; source: string; dealId: string }> = []
    const BATCH = 5
    for (let i = 0; i < top15raw.length; i += BATCH) {
      const batch = top15raw.slice(i, i + BATCH)
      const enriched = await Promise.all(batch.map(async d => {
        const [company, source] = await Promise.all([
          fetchDealCompany(d.dealId, apiKey),
          fetchDealSource(d.dealId, apiKey),
        ])
        return { ...d, company, source }
      }))
      top15.push(...enriched)
      if (i + BATCH < top15raw.length) await new Promise(r => setTimeout(r, 200))
    }

    // Build pipeline value aggregated by source channel
    // Step 1: use sources already resolved for top 15
    const bySourceValue: Record<string, { open: number; won: number; total: number; count: number }> = {}
    const bySourceDeals: Record<string, Array<{ name: string; amount: number; stage: string; company: string; closeDate: string }>> = {}
    const accSource = (src: string, amount: number, isWon: boolean, dealMeta: { name: string; stage: string; company: string; closeDate: string }) => {
      const key = src || 'Direct'
      if (!bySourceValue[key]) bySourceValue[key] = { open: 0, won: 0, total: 0, count: 0 }
      bySourceValue[key].total += amount
      bySourceValue[key].count++
      if (isWon) bySourceValue[key].won += amount
      else bySourceValue[key].open += amount
      if (!bySourceDeals[key]) bySourceDeals[key] = []
      bySourceDeals[key].push({ name: dealMeta.name, amount, stage: dealMeta.stage, company: dealMeta.company, closeDate: dealMeta.closeDate })
    }

    // Seed from top 15 (already resolved)
    const top15IdSet = new Set(top15.map(d => d.dealId))
    for (const d of top15) {
      accSource(d.source, d.amount, d.stage === 'Closed Won', { name: d.name, stage: d.stage, company: d.company, closeDate: d.closeDate })
    }

    // Step 2: resolve sources (and company) for remaining non-lost deals, capped at the next
    // ENRICH_CAP largest by amount. The full unfiltered pipeline can run to 900+ deals — each
    // one needs 2 sequential HubSpot lookups (company + source association), so enriching every
    // single deal here previously timed the endpoint out once "All Time" (rather than a single
    // quarter) became the default view. Capping keeps this fast; since deals are sorted by
    // amount, the cap always keeps the ones that dominate the channel breakdown's $ totals —
    // openPipeline/closedWon/totalACV above are unaffected, they're summed before this cap.
    const ENRICH_CAP = 150
    const remainingDeals = topDeals.filter(d => !top15IdSet.has(d.dealId)).slice(0, ENRICH_CAP)
    for (let i = 0; i < remainingDeals.length; i += BATCH) {
      const batch = remainingDeals.slice(i, i + BATCH)
      const resolved = await Promise.all(batch.map(async d => {
        const [source, company] = await Promise.all([
          fetchDealSource(d.dealId, apiKey),
          fetchDealCompany(d.dealId, apiKey),
        ])
        return { source, company }
      }))
      batch.forEach((d, idx) => {
        accSource(resolved[idx].source, d.amount, d.stage === 'Closed Won', { name: d.name, stage: d.stage, company: resolved[idx].company, closeDate: d.closeDate })
      })
      if (i + BATCH < remainingDeals.length) await new Promise(r => setTimeout(r, 150))
    }

    // Sort each source's deal list by amount desc
    for (const key of Object.keys(bySourceDeals)) {
      bySourceDeals[key].sort((a, b) => b.amount - a.amount)
    }

    // Two distinct Q3 metrics, both computed from the full, unfiltered dataset (independent
    // of the from/to filter above):
    //
    // 1. q3OpenOnly ("Open Pipeline (This Quarter)" card) — any still-open deal (any create
    //    date) expected to CLOSE in Q3. The broad "what's left to land by Sep 30" view.
    //
    // 2. q3Cumulative/q3Data ("Q3 Progress" banner) — the narrower, same-quarter-velocity
    //    metric this dashboard originally used: only deals CREATED in Q3 that are ALSO
    //    expected to CLOSE in Q3. These must stay separate — conflating them was a bug
    //    (both ended up showing the narrow figure) fixed here.
    const Q3_START_MS = new Date('2026-07-01T00:00:00.000Z').getTime()
    const Q3_END_MS   = new Date('2026-09-30T23:59:59.999Z').getTime()
    const q3Months = ['2026-07', '2026-08', '2026-09']

    let q3OpenOnly = 0
    for (const d of allDeals) {
      const p = d.properties
      if (!p.closedate) continue
      const closeMs = new Date(p.closedate).getTime()
      if (closeMs < Q3_START_MS || closeMs > Q3_END_MS) continue
      const stage = p.dealstage || ''
      if (CLOSED_WON_STAGE === stage || CLOSED_LOST_STAGES.has(stage)) continue
      q3OpenOnly += parseFloat(p.amount || '0')
    }

    const q3ByCreateMonth: Record<string, { open: number; won: number; count: number }> = {}
    for (const d of allDeals) {
      const p = d.properties
      if (!p.closedate || !p.createdate) continue
      const closeMs = new Date(p.closedate).getTime()
      if (closeMs < Q3_START_MS || closeMs > Q3_END_MS) continue
      const createMonthKey = p.createdate.substring(0, 7)
      if (!q3Months.includes(createMonthKey)) continue
      const stage = p.dealstage || ''
      const amount = parseFloat(p.amount || '0')
      if (!q3ByCreateMonth[createMonthKey]) q3ByCreateMonth[createMonthKey] = { open: 0, won: 0, count: 0 }
      q3ByCreateMonth[createMonthKey].count++
      if (stage === CLOSED_WON_STAGE) q3ByCreateMonth[createMonthKey].won += amount
      else if (!CLOSED_LOST_STAGES.has(stage)) q3ByCreateMonth[createMonthKey].open += amount
    }
    const q3Goal = 30_000_000
    let q3Cumulative = 0
    const q3Data = q3Months.map(m => {
      const monthData = q3ByCreateMonth[m] || { open: 0, won: 0, count: 0 }
      q3Cumulative += monthData.open + monthData.won
      return {
        month: m,
        label: new Date(m + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        added: monthData.open + monthData.won,
        cumulative: q3Cumulative,
        open: monthData.open,
        won: monthData.won,
        deals: monthData.count,
      }
    })

    // Monthly trend (last 6 months)
    const sortedMonths = Object.entries(byMonth)
      .filter(([k]) => k !== 'unknown')
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 6)
      .reverse()

    let cumulativeTotal = 0
    const monthlyTrend = sortedMonths.map(([month, data]) => {
      cumulativeTotal += data.open + data.won
      return {
        month,
        label: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' }),
        open: data.open,
        won: data.won,
        lost: data.lost,
        total: data.open + data.won,
        cumulative: cumulativeTotal,
        deals: data.count,
      }
    })

    return NextResponse.json({
      totalDeals: filteredDeals.length,
      openPipeline,
      closedWon,
      closedLost,
      totalACV: openPipeline + closedWon,
      q3: { goal: q3Goal, data: q3Data, cumulative: q3Cumulative, openOnly: q3OpenOnly },
      byStage: Object.entries(byStage)
        .sort((a, b) => b[1].amount - a[1].amount)
        .map(([stage, data]) => ({ stage, ...data })),
      bySourceValue: Object.entries(bySourceValue)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([source, v]) => ({ source, ...v, deals: bySourceDeals[source] || [] })),
      monthlyTrend,
      topDeals: top15,
    })
  } catch (err: any) {
    console.error('[deals-acv] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
