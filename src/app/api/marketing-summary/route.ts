import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/marketing-summary
 *
 * Machine-to-machine endpoint for Org Pulse's Marketing vertical. Returns a
 * batched window of weekly actuals computed live from HubSpot — one broad
 * contacts query and one deals query, each bucketed by week — so Org Pulse
 * can render its whole trend history without storing a local copy of any of
 * this. Goals (pipeline target, MQL targets) aren't included: those are
 * human-set targets with no HubSpot source, and Org Pulse keeps managing
 * them itself.
 *
 * Deliberately self-contained (no imports from the rest of this app,
 * including its own pipeline-trend deal-fetching logic, which this
 * duplicates in miniature) — this file exists only for Org Pulse to call,
 * so it's kept as the one addition to this repo rather than reaching into
 * files this team owns and maintains.
 *
 * Auth: `Authorization: Bearer <MARKETING_SUMMARY_API_KEY>`.
 * Params: `?weeks=26` (1-104, default 26), `?end=YYYY-MM-DD` (UTC Monday of
 * the last week wanted, defaults to the current week).
 */

const HUBSPOT_API_BASE = 'https://api.hubapi.com'
const WEEK_MS = 7 * 86_400_000
// MQLs are strictly marketing-channel leads (lead_form_type contains "Book a
// Demo") — mirrors the CONTAINS_TOKEN filter /api/hubspot/mqls uses.
const MQL_FORM_TOKEN = 'Book a Demo'
const SQL_STAGE = 'opportunity'
const OPPORTUNITY_STAGE = '249550600'
const CUSTOMER_STAGE = 'customer'
// Studio Deals pipeline — mirrors /api/hubspot/pipeline-trend's own constant.
const STUDIO_PIPELINE_ID = '668588091'
const CLOSED_LOST_STAGES = new Set(['982194450', '982194451']) // Closed Lost + Dropped

function mondayOf(d: Date): Date {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const offset = (t.getUTCDay() + 6) % 7 // Monday=0
  t.setUTCDate(t.getUTCDate() - offset)
  return t
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

async function searchContacts(apiKey: string, gteMs: number, ltMs: number): Promise<any[]> {
  const results: any[] = []
  let after: string | undefined
  const filters = [
    { propertyName: 'createdate', operator: 'GTE', value: gteMs.toString() },
    { propertyName: 'createdate', operator: 'LT', value: ltMs.toString() },
    { propertyName: 'email', operator: 'NOT_CONTAINS_TOKEN', value: 'lyzr.ai' },
    { propertyName: 'lead_form_type', operator: 'HAS_PROPERTY' },
  ]
  const properties = ['lead_form_type', 'lyzr_lead_score', 'lifecyclestage', 'createdate']

  while (true) {
    const body: any = { filterGroups: [{ filters }], properties, limit: 100 }
    if (after) body.after = after

    const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1100))
        continue
      }
      throw new Error(`HubSpot contacts search failed: ${res.status}`)
    }
    const data = await res.json()
    results.push(...(data.results || []))
    if (!data.paging?.next?.after || data.results?.length === 0) break
    after = data.paging.next.after
    await new Promise((r) => setTimeout(r, 150))
  }
  return results
}

async function searchDeals(apiKey: string, gteMs: number, ltMs: number): Promise<any[]> {
  const results: any[] = []
  let after: string | undefined
  const filters = [
    { propertyName: 'pipeline', operator: 'EQ', value: STUDIO_PIPELINE_ID },
    { propertyName: 'createdate', operator: 'GTE', value: gteMs.toString() },
    { propertyName: 'createdate', operator: 'LT', value: ltMs.toString() },
  ]
  const properties = ['amount', 'dealstage', 'createdate']

  while (true) {
    const body: any = { filterGroups: [{ filters }], properties, limit: 100 }
    if (after) body.after = after

    const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/deals/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1100))
        continue
      }
      throw new Error(`HubSpot deals search failed: ${res.status}`)
    }
    const data = await res.json()
    results.push(...(data.results || []))
    if (!data.paging?.next?.after || data.results?.length === 0) break
    after = data.paging.next.after
    await new Promise((r) => setTimeout(r, 150))
  }
  return results
}

type WeekBucket = {
  week_start: string
  total_leads: number
  total_mqls: number
  qualified_mqls: number
  sqls: number
  opportunities: number
  customers: number
  pipeline_generated: number
}

export const maxDuration = 300

export async function GET(req: NextRequest) {
  const authKey = process.env.MARKETING_SUMMARY_API_KEY
  if (!authKey) {
    return NextResponse.json({ error: 'MARKETING_SUMMARY_API_KEY not configured' }, { status: 500 })
  }
  const auth = req.headers.get('authorization') || ''
  if (auth !== `Bearer ${authKey}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'HUBSPOT_API_KEY not configured' }, { status: 500 })
  }

  const { searchParams } = new URL(req.url)
  const weeks = Math.min(Math.max(parseInt(searchParams.get('weeks') || '26', 10) || 26, 1), 104)
  const endParam = searchParams.get('end')
  const latestWeekStart = mondayOf(endParam ? new Date(endParam + 'T00:00:00.000Z') : new Date())
  const rangeEnd = new Date(latestWeekStart.getTime() + WEEK_MS)
  const earliestWeekStart = new Date(latestWeekStart.getTime() - (weeks - 1) * WEEK_MS)

  try {
    const [contacts, deals] = await Promise.all([
      searchContacts(apiKey, earliestWeekStart.getTime(), rangeEnd.getTime()),
      searchDeals(apiKey, earliestWeekStart.getTime(), rangeEnd.getTime()),
    ])

    const buckets: WeekBucket[] = Array.from({ length: weeks }, (_, i) => ({
      week_start: isoDate(new Date(earliestWeekStart.getTime() + i * WEEK_MS)),
      total_leads: 0,
      total_mqls: 0,
      qualified_mqls: 0,
      sqls: 0,
      opportunities: 0,
      customers: 0,
      pipeline_generated: 0,
    }))

    for (const d of deals) {
      const props = d.properties || {}
      const stage = props.dealstage || ''
      if (CLOSED_LOST_STAGES.has(stage)) continue // excluded from "pipeline generated"
      const createdMs = new Date(props.createdate || 0).getTime()
      const idx = Math.floor((createdMs - earliestWeekStart.getTime()) / WEEK_MS)
      if (idx < 0 || idx >= weeks) continue
      buckets[idx].pipeline_generated += parseFloat(props.amount || '0') || 0
    }

    for (const c of contacts) {
      const props = c.properties || {}
      // The Leads page's own "Total Leads" card excludes this channel
      // (src/app/(app)/leads/page.tsx filters `formType !== 'Agent Studio'`)
      // — it's a separate signup source, not part of Marketing's lead/MQL
      // funnel. lead_form_type can be a ";"-joined list; only the primary
      // (first) entry determines the contact's form type, same as the
      // contactDetail.formType derivation in /api/hubspot/mqls.
      const primaryFormType = (props.lead_form_type || '').split(';')[0].trim()
      if (primaryFormType === 'Agent Studio') continue
      const createdMs = new Date(props.createdate || 0).getTime()
      const idx = Math.floor((createdMs - earliestWeekStart.getTime()) / WEEK_MS)
      if (idx < 0 || idx >= weeks) continue
      const bucket = buckets[idx]

      // This app's own "Total Leads" figures (LeadsTotalCard.tsx: "excl.
      // Book a Demo & Agent Studio"; LeadFunnelCard.tsx's "Lead" stage)
      // treat leads and MQLs as separate buckets, not a superset/subset —
      // a contact whose primary form is a demo request doesn't also count
      // as a plain "lead" here.
      if (primaryFormType !== MQL_FORM_TOKEN) bucket.total_leads++
      const isMql = (props.lead_form_type || '').includes(MQL_FORM_TOKEN)
      if (!isMql) continue
      bucket.total_mqls++

      if (parseFloat(props.lyzr_lead_score || '0') > 40) bucket.qualified_mqls++
      const stage = props.lifecyclestage || ''
      if (stage === SQL_STAGE) bucket.sqls++
      if (stage === OPPORTUNITY_STAGE) bucket.opportunities++
      if (stage === CUSTOMER_STAGE) bucket.customers++
    }

    return NextResponse.json({ weeks: buckets })
  } catch (err: any) {
    console.error('[marketing-summary]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
