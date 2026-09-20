import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/hubspot/executive-flow
 *
 * Section 1 of the Executive Dashboard — "Business Flow Performance".
 *
 * METHODOLOGY — split data model per explicit user instruction on 2026-09-18 ("mql sql you can
 * take from the contacts level in hubspot but opportunities customer won those things you must
 * take from the opportunity stage"):
 *
 * - MQLs Created / SQLs Created: CONTACT-based, unchanged from the prior version — cohort is
 *   `createdate` in range + `lead_form_type CONTAINS_TOKEN 'Book a Demo'` + the standard
 *   @lyzr.ai exclusion (the dashboard's one MQL definition, see CLAUDE.md), with SQL read off
 *   that same cohort's CURRENT lifecyclestage (SQL_EXACT, exact match, same as mqls/route.ts).
 * - Opportunities Created / Customers Won: DEAL-based, NOT contact lifecyclestage. Prior to this
 *   change both were read from the contact's `lifecyclestage` (OPP_EXACT / 'customer'), which
 *   produced a backwards, non-shrinking chart — e.g. July 2026 showed Opportunities Created: 2
 *   but Customers Won: 16, because "Opportunities Created" was exact-current-stage-only (a
 *   contact that already progressed to Customer no longer counts) and "Customers Won" trusted
 *   the raw lifecyclestage label with no check against a real Closed Won deal (the same
 *   data-hygiene gap CLAUDE.md documents for Jeff Asiedu/Jose Diaz — lifecyclestage=customer
 *   with no real Closed Won deal behind it). Fixed by switching both to the actual Deal record:
 *   `countDealFlow()` pulls deals in the Studio Deals pipeline (668588091), scoped to
 *   "marketing efforts driven" per explicit user confirmation on 2026-09-18 — same filter as
 *   /api/hubspot/sql-to-opportunity-monthly and /api/hubspot/pipeline-trend: `deal_source IN
 *   {Direct, Inbound, Marketing}` AND `contact_lead_form_type CONTAINS_TOKEN 'Book a Demo'`.
 *   Both metrics are bucketed by deal CREATEDATE (also confirmed explicitly) — "Opportunities
 *   Created" is the count of such deals created in the period; "Customers Won" is the subset of
 *   that SAME created-in-period deal set currently at dealstage Closed Won (982194449). This
 *   means a deal created in month X but won in month X+2 counts as a Customer Won in month X,
 *   not month X+2 — deliberately consistent with MQL/SQL/Opportunity all being anchored to
 *   createdate, not an event/close date. Do not switch "Customers Won" to closedate-bucketing
 *   without asking again — it was explicitly considered and rejected in favor of createdate
 *   consistency.
 *
 * Query params:
 *   ?start=YYYY-MM-DD&end=YYYY-MM-DD  (end exclusive, same convention as /api/hubspot/mqls)
 *   ?nocache=1                        bypass the Firestore cache
 *   ?mode=trend&months=N              server-side loop over N trailing months (for the Row 3
 *                                     trend chart) instead of a single current/previous pair
 */

const HUBSPOT_API_BASE = 'https://api.hubapi.com'

// Same portal-specific label mismatch as mqls/route.ts — internal 'opportunity' = SQL label.
// Exact-current-stage match, not cumulative — matches HubSpot's own "Lifecycle stage is X" UI
// filter (see CLAUDE.md's 57-vs-75 writeup). Only used for SQLs now — Opportunity/Customer come
// from the Deal object, see fetchMarketingDeals() below.
const SQL_EXACT = new Set(['opportunity'])

// Deal-based Opportunity/Customer Won — same "marketing efforts driven" scope as
// /api/hubspot/pipeline-trend and /api/hubspot/sql-to-opportunity-monthly. Do not conflate with
// the contact-lifecyclestage OPP_EXACT definition used elsewhere on this dashboard — this route
// deliberately uses the Deal record instead, per explicit user instruction.
const STUDIO_PIPELINE_ID = '668588091'
const MARKETING_DEAL_SOURCES = ['Direct', 'Inbound', 'Marketing']
const CLOSED_WON_STAGE = '982194449'

type FlowKey = 'mql' | 'sql' | 'opportunity' | 'customer'

export const maxDuration = 120

// --- Firestore cache (new collection — kept separate from mql_cache to avoid key collisions
// between the two features, per the plan) ---
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
    const appName = 'executive-flow-cache'
    const existing = getApps().find((a: any) => a.name === appName)
    const app = existing || initializeApp({ credential: cert({ projectId: PROJECT_ID, clientEmail: SA_EMAIL, privateKey: SA_KEY }) }, appName)
    cacheDb = getFirestore(app)
    return cacheDb
  } catch { cacheDb = null; return null }
}

async function getCached(key: string, end: string): Promise<any | null> {
  try {
    const db = getCacheDb()
    if (!db) return null
    const doc = await db.collection('executive_flow_cache_v3').doc(key).get()
    if (!doc.exists) return null
    const data = doc.data()!
    const cachedAt = data.cachedAt?.toDate?.() || new Date(0)
    const ageMs = Date.now() - cachedAt.getTime()
    if (new Date(end + 'T00:00:00Z') < new Date()) {
      return ageMs < 604800000 ? data.result : null // 7 day TTL, closed period
    }
    return ageMs < 3600000 ? data.result : null // 1 hour TTL, open period
  } catch { return null }
}

async function setCache(key: string, result: any): Promise<void> {
  try {
    const db = getCacheDb()
    if (!db) return
    await db.collection('executive_flow_cache_v3').doc(key).set({ result, cachedAt: new Date() })
  } catch {}
}

/** Contact-based MQLs/SQLs — unchanged from before, see file-header note. */
async function countContactFlow(apiKey: string, startMs: number, endMs: number) {
  const results: any[] = []
  let after: string | undefined
  while (true) {
    const body: any = {
      filterGroups: [{
        filters: [
          { propertyName: 'createdate', operator: 'GTE', value: startMs.toString() },
          { propertyName: 'createdate', operator: 'LT', value: endMs.toString() },
          { propertyName: 'email', operator: 'NOT_CONTAINS_TOKEN', value: 'lyzr.ai' },
          { propertyName: 'lead_form_type', operator: 'CONTAINS_TOKEN', value: 'Book a Demo' },
        ],
      }],
      properties: ['lifecyclestage'],
      limit: 100,
    }
    if (after) body.after = after
    const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      if (res.status === 429) { await new Promise(r => setTimeout(r, 1100)); continue }
      throw new Error(`HubSpot search failed: ${res.status}`)
    }
    const data = await res.json()
    results.push(...(data.results || []))
    if (!data.paging?.next?.after || data.results?.length === 0) break
    after = data.paging.next.after
    await new Promise(r => setTimeout(r, 150))
  }

  let sqlsCreated = 0
  for (const c of results) {
    if (SQL_EXACT.has(c.properties?.lifecyclestage || '')) sqlsCreated++
  }
  return { mqlsCreated: results.length, sqlsCreated }
}

/**
 * Deal-based Opportunities Created / Customers Won — see file-header note. Mirrors
 * pipeline-trend/route.ts's fetchDeals() exactly (same pipeline/source/lead-form-type filter).
 */
async function countDealFlow(apiKey: string, createdGteMs: number, createdLtMs: number) {
  const deals: any[] = []
  let after: string | undefined
  while (true) {
    const body: any = {
      filterGroups: [{
        filters: [
          { propertyName: 'pipeline', operator: 'EQ', value: STUDIO_PIPELINE_ID },
          { propertyName: 'createdate', operator: 'GTE', value: createdGteMs.toString() },
          { propertyName: 'createdate', operator: 'LT', value: createdLtMs.toString() },
          { propertyName: 'deal_source', operator: 'IN', values: MARKETING_DEAL_SOURCES },
          { propertyName: 'contact_lead_form_type', operator: 'CONTAINS_TOKEN', value: 'Book a Demo' },
        ],
      }],
      properties: ['dealstage'],
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
    deals.push(...(data.results || []))
    if (!data.paging?.next?.after || data.results?.length === 0) break
    after = data.paging.next.after
    await new Promise(r => setTimeout(r, 150))
  }

  const customersWon = deals.filter(d => d.properties?.dealstage === CLOSED_WON_STAGE).length
  return { opportunitiesCreated: deals.length, customersWon }
}

async function countAllFlow(apiKey: string, startMs: number, endMs: number) {
  const [contactFlow, dealFlow] = await Promise.all([
    countContactFlow(apiKey, startMs, endMs),
    countDealFlow(apiKey, startMs, endMs),
  ])
  return { ...contactFlow, ...dealFlow }
}

function pctChange(current: number, previous: number): { pct: number | null; direction: 'up' | 'down' | 'flat' } {
  if (previous === 0) {
    if (current === 0) return { pct: null, direction: 'flat' }
    return { pct: null, direction: 'up' } // "New" — render pct===null as "New" in the UI
  }
  const pct = ((current - previous) / previous) * 100
  return { pct, direction: pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat' }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'HUBSPOT_API_KEY not configured' }, { status: 500 })
  }
  const noCache = searchParams.get('nocache') === '1'
  const mode = searchParams.get('mode')

  try {
    if (mode === 'trend') {
      const months = Math.min(Math.max(parseInt(searchParams.get('months') || '6', 10), 1), 12)
      const endAnchor = searchParams.get('end') // YYYY-MM-DD, defaults to today
      const anchorDate = endAnchor ? new Date(endAnchor + 'T00:00:00.000Z') : new Date()
      const points: Array<{ month: string; label: string; mqlsCreated: number; sqlsCreated: number; opportunitiesCreated: number; customersWon: number }> = []

      for (let i = months - 1; i >= 0; i--) {
        const monthStart = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() - i, 1))
        const monthEnd = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() - i + 1, 1))
        const monthKey = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}`
        const cacheKey = `trend_${monthKey}`
        let counts = noCache ? null : await getCached(cacheKey, monthEnd.toISOString().slice(0, 10))
        if (!counts) {
          counts = await countAllFlow(apiKey, monthStart.getTime(), monthEnd.getTime())
          await setCache(cacheKey, counts)
        }
        points.push({
          month: monthKey,
          label: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
          ...counts,
        })
      }
      return NextResponse.json({ points })
    }

    const start = searchParams.get('start')
    const end = searchParams.get('end')
    if (!start || !end) {
      return NextResponse.json({ error: 'start and end params required' }, { status: 400 })
    }

    const cacheKey = `${start}_${end}`
    if (!noCache) {
      const cached = await getCached(cacheKey, end)
      if (cached) return NextResponse.json(cached)
    }

    const startMs = new Date(start + 'T00:00:00.000Z').getTime()
    const endMs = new Date(end + 'T00:00:00.000Z').getTime()
    const spanMs = endMs - startMs
    const prevStartMs = startMs - spanMs
    const prevEndMs = startMs

    const [current, previous] = await Promise.all([
      countAllFlow(apiKey, startMs, endMs),
      countAllFlow(apiKey, prevStartMs, prevEndMs),
    ])

    const change: Record<FlowKey, { pct: number | null; direction: 'up' | 'down' | 'flat' }> = {
      mql: pctChange(current.mqlsCreated, previous.mqlsCreated),
      sql: pctChange(current.sqlsCreated, previous.sqlsCreated),
      opportunity: pctChange(current.opportunitiesCreated, previous.opportunitiesCreated),
      customer: pctChange(current.customersWon, previous.customersWon),
    }

    const result = {
      date_range: { start, end },
      previous_range: {
        start: new Date(prevStartMs).toISOString().slice(0, 10),
        end: new Date(prevEndMs).toISOString().slice(0, 10),
      },
      current,
      previous,
      change: {
        mqlsCreated: change.mql,
        sqlsCreated: change.sql,
        opportunitiesCreated: change.opportunity,
        customersWon: change.customer,
      },
    }

    await setCache(cacheKey, result)
    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[executive-flow] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
