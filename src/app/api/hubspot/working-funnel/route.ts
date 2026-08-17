import { NextRequest, NextResponse } from 'next/server'

/**
 * /api/hubspot/working-funnel
 *
 * Returns the funnel of leads currently in "Working" status that have made progress.
 * Shows how many Working leads have:
 * - Meeting scheduled/completed
 * - Deals associated
 * - Advanced lifecycle stages (MQL → SQL → Opportunity → Customer)
 *
 * Also returns leads that have progressed PAST Working (Demo Booked, Demo Completed)
 * filtered to Inbound only.
 */

const HUBSPOT_API_BASE = 'https://api.hubapi.com'

export const maxDuration = 60

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
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 1100))
      continue
    }
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`HubSpot search failed: ${err.substring(0, 200)}`)
    }
    const data = await res.json()
    results.push(...(data.results || []))
    if (data.paging?.next?.after) after = data.paging.next.after
    else break
    await new Promise(r => setTimeout(r, 150))
  }
  return results
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const channel = searchParams.get('channel') || 'all' // 'all', 'inbound', 'outbound'
  const start = searchParams.get('start') // optional: filter by createdate
  const end = searchParams.get('end')

  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'HUBSPOT_API_KEY not configured' }, { status: 500 })
  }

  try {
    const PROPS = [
      'email', 'firstname', 'lastname', 'company',
      'hs_lead_status', 'lifecyclestage', 'lead_channel', 'lead_form_type',
      'lead_source_category', 'lyzr_lead_score', 'lyzr_lead_score_category',
      'hs_latest_meeting_activity', 'num_associated_deals',
      'createdate', 'hubspot_owner_id',
    ]

    // Build filter for Working leads
    const workingFilters: any[] = [
      { propertyName: 'hs_lead_status', operator: 'EQ', value: 'Working' },
    ]
    if (channel === 'inbound') {
      workingFilters.push({ propertyName: 'lead_channel', operator: 'EQ', value: 'Inbound' })
    }
    // Date range filter on createdate
    if (start && end) {
      const startMs = new Date(start + 'T00:00:00.000Z').getTime()
      const endMs = new Date(end + 'T00:00:00.000Z').getTime()
      workingFilters.push({ propertyName: 'createdate', operator: 'GTE', value: startMs.toString() })
      workingFilters.push({ propertyName: 'createdate', operator: 'LT', value: endMs.toString() })
    }

    const workingLeads = await searchAll(apiKey, [{ filters: workingFilters }], PROPS)

    // Categorize Working leads by their progress
    let withMeeting = 0
    let withDeals = 0
    const byStage: Record<string, number> = {}
    const byFormType: Record<string, number> = {}
    const bySourceCategory: Record<string, number> = {}
    const byScoreCategory: Record<string, number> = {}

    // Leads that have made progress (meeting or deal or SQL+)
    const SQL_STAGES = new Set(['salesqualifiedlead', 'opportunity', '249550600', 'customer'])
    const OPP_STAGES = new Set(['opportunity', '249550600', 'customer'])
    let sqlCount = 0
    let oppCount = 0
    let customerCount = 0

    const progressedList: {
      email: string
      name: string
      company: string
      stage: string
      hasMeeting: boolean
      deals: number
      score: string
      formType: string
      source: string
      created: string
    }[] = []

    for (const c of workingLeads) {
      const p = c.properties || {}
      const stage = p.lifecyclestage || 'unknown'
      const formType = (p.lead_form_type || 'Unknown').split(';')[0].trim()
      const source = p.lead_source_category || 'Unknown'
      const scoreCat = p.lyzr_lead_score_category || 'unknown'
      const hasMeeting = !!p.hs_latest_meeting_activity
      const deals = parseInt(p.num_associated_deals || '0')

      byStage[stage] = (byStage[stage] || 0) + 1
      byFormType[formType] = (byFormType[formType] || 0) + 1
      bySourceCategory[source] = (bySourceCategory[source] || 0) + 1
      byScoreCategory[scoreCat] = (byScoreCategory[scoreCat] || 0) + 1

      if (hasMeeting) withMeeting++
      if (deals > 0) withDeals++
      if (SQL_STAGES.has(stage)) sqlCount++
      if (OPP_STAGES.has(stage)) oppCount++
      if (stage === 'customer') customerCount++

      // A lead has "made progress" if it has meeting OR deal OR advanced past MQL
      if (hasMeeting || deals > 0 || SQL_STAGES.has(stage)) {
        progressedList.push({
          email: p.email || '',
          name: `${p.firstname || ''} ${p.lastname || ''}`.trim(),
          company: p.company || '',
          stage,
          hasMeeting,
          deals,
          score: p.lyzr_lead_score || '',
          formType,
          source,
          created: p.createdate || '',
        })
      }
    }

    // Also get Inbound leads that have moved PAST working (Demo Booked, Demo Completed, etc.)
    const dateFiltersForPast: any[] = []
    if (start && end) {
      const startMs = new Date(start + 'T00:00:00.000Z').getTime()
      const endMs = new Date(end + 'T00:00:00.000Z').getTime()
      dateFiltersForPast.push({ propertyName: 'createdate', operator: 'GTE', value: startMs.toString() })
      dateFiltersForPast.push({ propertyName: 'createdate', operator: 'LT', value: endMs.toString() })
    }
    const pastWorkingFilters = [
      { filters: [
        { propertyName: 'hs_lead_status', operator: 'EQ', value: 'Demo Booked' },
        ...(channel === 'inbound' ? [{ propertyName: 'lead_channel', operator: 'EQ', value: 'Inbound' }] : []),
        ...dateFiltersForPast,
      ]},
      { filters: [
        { propertyName: 'hs_lead_status', operator: 'EQ', value: 'Demo Completed' },
        ...(channel === 'inbound' ? [{ propertyName: 'lead_channel', operator: 'EQ', value: 'Inbound' }] : []),
        ...dateFiltersForPast,
      ]},
      { filters: [
        { propertyName: 'hs_lead_status', operator: 'EQ', value: 'Demo Completed - PLG' },
        ...(channel === 'inbound' ? [{ propertyName: 'lead_channel', operator: 'EQ', value: 'Inbound' }] : []),
        ...dateFiltersForPast,
      ]},
    ]

    const pastWorkingLeads = await searchAll(apiKey, pastWorkingFilters, PROPS)

    const pastWorkingByStatus: Record<string, number> = {}
    const pastWorkingByStage: Record<string, number> = {}
    for (const c of pastWorkingLeads) {
      const p = c.properties || {}
      const status = p.hs_lead_status || 'unknown'
      const stage = p.lifecyclestage || 'unknown'
      pastWorkingByStatus[status] = (pastWorkingByStatus[status] || 0) + 1
      pastWorkingByStage[stage] = (pastWorkingByStage[stage] || 0) + 1
    }

    // Build the funnel numbers
    const funnel = {
      total_working: workingLeads.length,
      with_meeting: withMeeting,
      with_deals: withDeals,
      sql: sqlCount,
      opportunity: oppCount,
      customer: customerCount,
      past_working_demo_booked: pastWorkingByStatus['Demo Booked'] || 0,
      past_working_demo_completed: (pastWorkingByStatus['Demo Completed'] || 0) + (pastWorkingByStatus['Demo Completed - PLG'] || 0),
      past_working_total: pastWorkingLeads.length,
    }

    return NextResponse.json({
      funnel,
      byStage,
      byFormType,
      bySourceCategory,
      byScoreCategory,
      pastWorkingByStatus,
      pastWorkingByStage,
      progressedLeads: progressedList.sort((a, b) => {
        // Sort by deals desc, then meeting, then stage
        if (b.deals !== a.deals) return b.deals - a.deals
        if (b.hasMeeting !== a.hasMeeting) return b.hasMeeting ? 1 : -1
        return 0
      }).slice(0, 50), // Top 50 most progressed
      channel,
    })
  } catch (err: any) {
    console.error('[hubspot/working-funnel]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
