import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/hubspot/pipeline-trend
 *
 * Live HubSpot pipeline $ data for the MQL page's Pipeline Metrics cards + Pipeline
 * Trend chart. Reuses the Studio Deals pipeline (668588091) — same pipeline/stage
 * map as /api/hubspot/deals-acv, but bucketed by deal CREATE date (not close date),
 * since "pipeline generated" means new pipeline added in a period, not closed in it.
 *
 * Two modes:
 *   mode=range (default) — ?start=YYYY-MM-DD&end=YYYY-MM-DD (exclusive end)
 *     Returns aggregate metrics for exactly that window — used for the current-period
 *     Pipeline Metrics cards so the window always matches the MQL page's active date range.
 *   mode=weekly — ?end=YYYY-MM-DD&weeks=8
 *     Returns N weekly buckets ending at `end`, for the Pipeline Trend chart.
 */

const HUBSPOT_API_BASE = 'https://api.hubapi.com'
const STUDIO_PIPELINE_ID = '668588091'
const CLOSED_LOST_STAGES = new Set(['982194450', '982194451']) // Closed Lost + Dropped
const CLOSED_WON_STAGE = '982194449'

// Studio Deals pipeline stage map — mirrors deals-acv/route.ts
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

export const maxDuration = 60

async function fetchDeals(apiKey: string, createdGteMs: number, createdLtMs: number): Promise<any[]> {
  const allDeals: any[] = []
  let after: string | undefined
  while (true) {
    const body: any = {
      filterGroups: [{
        filters: [
          { propertyName: 'pipeline', operator: 'EQ', value: STUDIO_PIPELINE_ID },
          { propertyName: 'createdate', operator: 'GTE', value: createdGteMs.toString() },
          { propertyName: 'createdate', operator: 'LT', value: createdLtMs.toString() },
        ],
      }],
      properties: ['dealname', 'amount', 'dealstage', 'createdate'],
      limit: 100,
    }
    if (after) body.after = after
    const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/deals/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      if (res.status === 429) { await new Promise(r => setTimeout(r, 1100)); continue }
      throw new Error(`HubSpot deals search failed: ${res.status}`)
    }
    const data = await res.json()
    allDeals.push(...(data.results || []))
    if (!data.paging?.next?.after || data.results?.length === 0) break
    after = data.paging.next.after
    await new Promise(r => setTimeout(r, 150))
  }
  return allDeals
}

type DealDetail = { name: string; amount: number; stage: string }

function summarize(deals: any[]) {
  let pipelineGenerated = 0
  let dealCount = 0
  let closedWonAmount = 0
  let closedWonCount = 0
  const dealDetails: DealDetail[] = []
  for (const d of deals) {
    const amount = parseFloat(d.properties?.amount || '0') || 0
    const stage = d.properties?.dealstage || ''
    if (CLOSED_LOST_STAGES.has(stage)) continue // excluded from "pipeline generated"
    pipelineGenerated += amount
    dealCount++
    dealDetails.push({
      name: d.properties?.dealname || 'Untitled Deal',
      amount,
      stage: STAGE_NAMES[stage] || stage || 'Unknown',
    })
    if (stage === CLOSED_WON_STAGE) {
      closedWonAmount += amount
      closedWonCount++
    }
  }
  dealDetails.sort((a, b) => b.amount - a.amount)
  const avgDealSize = dealCount > 0 ? pipelineGenerated / dealCount : 0
  const avgRevenuePerOpportunity = closedWonCount > 0 ? closedWonAmount / closedWonCount : 0
  return { pipelineGenerated, dealCount, closedWonAmount, closedWonCount, avgDealSize, avgRevenuePerOpportunity, deals: dealDetails }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'HUBSPOT_API_KEY not configured' }, { status: 500 })
  }

  const mode = searchParams.get('mode') || 'range'

  try {
    if (mode === 'weekly') {
      const end = searchParams.get('end') || new Date().toISOString().split('T')[0]
      const weeks = Math.min(Math.max(parseInt(searchParams.get('weeks') || '8', 10) || 8, 1), 26)
      const endDate = new Date(end + 'T00:00:00.000Z')
      const earliestStart = new Date(endDate.getTime() - weeks * 7 * 86_400_000)

      const deals = await fetchDeals(apiKey, earliestStart.getTime(), endDate.getTime())

      const buckets: Array<{ weekStart: string; label: string; pipelineGenerated: number; dealCount: number; closedWonAmount: number; closedWonCount: number; deals: DealDetail[] }> = []
      for (let i = weeks - 1; i >= 0; i--) {
        const bucketStart = new Date(endDate.getTime() - (i + 1) * 7 * 86_400_000)
        const bucketEnd = new Date(endDate.getTime() - i * 7 * 86_400_000)
        const bucketDeals = deals.filter(d => {
          const t = new Date(d.properties?.createdate || 0).getTime()
          return t >= bucketStart.getTime() && t < bucketEnd.getTime()
        })
        const s = summarize(bucketDeals)
        buckets.push({
          weekStart: bucketStart.toISOString().split('T')[0],
          label: bucketStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          pipelineGenerated: s.pipelineGenerated,
          dealCount: s.dealCount,
          closedWonAmount: s.closedWonAmount,
          closedWonCount: s.closedWonCount,
          deals: s.deals,
        })
      }

      return NextResponse.json({ mode: 'weekly', weeks: buckets })
    }

    // mode=range
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    if (!start || !end) {
      return NextResponse.json({ error: 'start and end params required for mode=range' }, { status: 400 })
    }
    const startMs = new Date(start + 'T00:00:00.000Z').getTime()
    const endMs = new Date(end + 'T00:00:00.000Z').getTime()

    const deals = await fetchDeals(apiKey, startMs, endMs)
    const summary = summarize(deals)

    // Also fetch month-to-date (calendar month containing `end`, up to `end`) for the Monthly card.
    // If the already-fetched `deals` window starts on/before monthStart, we can just filter it
    // locally (avoids a duplicate API call). Otherwise the query window started after monthStart
    // (e.g. a mid-month week), so we need a separate fetch covering the full month.
    const endDateObj = new Date(endMs)
    const monthStartMs = Date.UTC(endDateObj.getUTCFullYear(), endDateObj.getUTCMonth(), 1)
    const monthDeals = monthStartMs < startMs
      ? await fetchDeals(apiKey, monthStartMs, endMs)
      : deals.filter(d => new Date(d.properties?.createdate || 0).getTime() >= monthStartMs)
    const monthSummary = summarize(monthDeals)

    return NextResponse.json({
      mode: 'range',
      date_range: { start, end },
      week: summary,
      month_to_date: monthSummary,
    })
  } catch (err: any) {
    console.error('[hubspot/pipeline-trend]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
