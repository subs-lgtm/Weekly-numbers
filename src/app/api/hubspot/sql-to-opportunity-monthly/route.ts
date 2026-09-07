import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/hubspot/sql-to-opportunity-monthly?months=4&nocache=1
 *
 * Trailing monthly SQL -> Opportunity counts, both from HubSpot directly (no SDR tracker
 * sheet, no in-memory contact funnel computation — this route does two lightweight COUNT-only
 * searches per month using HubSpot's `total` field, so it stays cheap even over several months).
 *
 * Replaces the old weekly SQL->Opportunity WoW chart per explicit user request on 2026-09-07:
 * a contact moving all the way from SQL to Opportunity inside a single calendar week is rare
 * (deals take longer than that to progress), so a week-by-week view was mostly flat/misleading.
 * Monthly is a more honest granularity for this particular conversion.
 *
 * SQL: contacts CREATED in the month, Book a Demo, whose CURRENT lifecyclestage is exactly SQL
 * (internal value 'opportunity' -- see CLAUDE.md's portal label-mismatch gotcha). Same
 * definition as funnel.sql in /api/hubspot/mqls.
 *
 * Opportunity ("marketing efforts driven Opportunities"): DEALS created in the month, in the
 * Studio Deals pipeline, whose deal_source is one of Direct/Outbound, Inbound, or Marketing,
 * AND whose associated contact came in through a Book a Demo form (`contact_lead_form_type`,
 * a deal-level property HubSpot mirrors from the associated contact). This exact filter
 * combination was pulled directly from a HubSpot Deals list filter the user provided
 * (screenshot, 2026-09-07) -- it deliberately EXCLUDES deal_source values like HyperScalers,
 * SI Partner, Referral, Repeat Customer, Partner Lead, Event, since those aren't
 * marketing-generated and would overstate marketing's contribution if included.
 */

const HUBSPOT_API_BASE = 'https://api.hubapi.com'
const STUDIO_PIPELINE_ID = '668588091' // Studio Deals pipeline — same as deals-acv/route.ts
const MARKETING_DEAL_SOURCES = ['Direct', 'Inbound', 'Marketing']

export const maxDuration = 60

async function countContacts(apiKey: string, filters: object[]): Promise<number> {
  const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ filterGroups: [{ filters }], limit: 1 }),
  })
  if (!res.ok) {
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 1100))
      return countContacts(apiKey, filters)
    }
    throw new Error(`HubSpot contacts search failed: ${res.status}`)
  }
  const data = await res.json()
  return data.total || 0
}

async function countDeals(apiKey: string, filters: object[]): Promise<number> {
  const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/deals/search`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ filterGroups: [{ filters }], limit: 1 }),
  })
  if (!res.ok) {
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 1100))
      return countDeals(apiKey, filters)
    }
    throw new Error(`HubSpot deals search failed: ${res.status}`)
  }
  const data = await res.json()
  return data.total || 0
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const months = Math.min(Math.max(parseInt(searchParams.get('months') || '4', 10) || 4, 1), 12)

  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'HUBSPOT_API_KEY not configured' }, { status: 500 })
  }

  try {
    // Trailing N months ending with the current real calendar month — not tied to any
    // page-level week picker (same reasoning as the MQL Journey MTD fix earlier today).
    const today = new Date()
    const monthConfigs: { period: string; label: string; start: string; end: string }[] = []
    for (let i = months - 1; i >= 0; i--) {
      const m = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const nextM = new Date(today.getFullYear(), today.getMonth() - i + 1, 1)
      const pad = (n: number) => String(n).padStart(2, '0')
      monthConfigs.push({
        period: `${m.getFullYear()}-${pad(m.getMonth() + 1)}`,
        label: m.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        start: `${m.getFullYear()}-${pad(m.getMonth() + 1)}-01`,
        end: `${nextM.getFullYear()}-${pad(nextM.getMonth() + 1)}-01`,
      })
    }

    const results = await Promise.all(monthConfigs.map(async (m) => {
      const startMs = new Date(m.start + 'T00:00:00.000Z').getTime()
      const endMs = new Date(m.end + 'T00:00:00.000Z').getTime()

      const [sql, opportunity] = await Promise.all([
        countContacts(apiKey, [
          { propertyName: 'createdate', operator: 'GTE', value: startMs.toString() },
          { propertyName: 'createdate', operator: 'LT', value: endMs.toString() },
          { propertyName: 'email', operator: 'NOT_CONTAINS_TOKEN', value: 'lyzr.ai' },
          { propertyName: 'lead_form_type', operator: 'CONTAINS_TOKEN', value: 'Book a Demo' },
          { propertyName: 'lifecyclestage', operator: 'EQ', value: 'opportunity' },
        ]),
        countDeals(apiKey, [
          { propertyName: 'createdate', operator: 'GTE', value: startMs.toString() },
          { propertyName: 'createdate', operator: 'LT', value: endMs.toString() },
          { propertyName: 'pipeline', operator: 'EQ', value: STUDIO_PIPELINE_ID },
          { propertyName: 'deal_source', operator: 'IN', values: MARKETING_DEAL_SOURCES },
          { propertyName: 'contact_lead_form_type', operator: 'CONTAINS_TOKEN', value: 'Book a Demo' },
        ]),
      ])

      const rate = sql > 0 ? Math.round((opportunity / sql) * 100) : 0
      return { period: m.period, label: m.label, sql, opportunity, rate }
    }))

    return NextResponse.json({ months: results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
