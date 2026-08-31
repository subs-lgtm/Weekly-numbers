import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/hubspot/executive-flow
 *
 * Section 1 of the Executive Dashboard — "Business Flow Performance".
 *
 * METHODOLOGY (corrected per explicit user instruction — an earlier version used
 * hs_v2_date_entered_* event-date properties, which produced technically-defensible but
 * unverifiable numbers the user couldn't reproduce in HubSpot's own UI; see CLAUDE.md and
 * executive-cohorts/route.ts for the full story): this route now defines the cohort for a
 * period EXACTLY like /api/hubspot/mqls — `createdate` in range + `lead_form_type CONTAINS_TOKEN
 * 'Book a Demo'` (the dashboard's one MQL definition) + the standard @lyzr.ai exclusion — then
 * reads that SAME cohort's CURRENT lifecyclestage (SQL_EXACT / OPP_EXACT / customer, exact
 * match, same as mqls/route.ts) for the SQLs/Opportunities/Customers Won figures. This has
 * already been cross-validated cell-by-cell against the user's own HubSpot CSV export for
 * March-August, with only the known EDT/UTC boundary rounding (±1) as any difference at all —
 * do not revert to hs_v2_date_entered_* without discussing it first.
 *
 * "Historical and immutable" now means: the createdate-based cohort SIZE never changes (a
 * contact's createdate is permanent), but the SQL/Opportunity/Customer breakdown for that cohort
 * is a live read of current lifecyclestage and will legitimately update as those specific
 * contacts progress — which is correct and matches how the Cohort Funnel Table below now works.
 *
 * Query params:
 *   ?start=YYYY-MM-DD&end=YYYY-MM-DD  (end exclusive, same convention as /api/hubspot/mqls)
 *   ?nocache=1                        bypass the Firestore cache
 *   ?mode=trend&months=N              server-side loop over N trailing months (for the Row 3
 *                                     trend chart) instead of a single current/previous pair
 */

const HUBSPOT_API_BASE = 'https://api.hubapi.com'

// Same portal-specific label mismatch as mqls/route.ts — internal 'opportunity' = SQL label,
// internal '249550600' = Opportunity label. Exact-current-stage match, not cumulative — matches
// HubSpot's own "Lifecycle stage is X" UI filter (see CLAUDE.md's 57-vs-75 writeup).
const SQL_EXACT = new Set(['opportunity'])
const OPP_EXACT = new Set(['249550600'])

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
    const doc = await db.collection('executive_flow_cache_v2').doc(key).get()
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
    await db.collection('executive_flow_cache_v2').doc(key).set({ result, cachedAt: new Date() })
  } catch {}
}

async function countAllFlow(apiKey: string, startMs: number, endMs: number) {
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

  let sqlsCreated = 0, opportunitiesCreated = 0, customersWon = 0
  for (const c of results) {
    const stage = c.properties?.lifecyclestage || ''
    if (SQL_EXACT.has(stage)) sqlsCreated++
    if (OPP_EXACT.has(stage)) opportunitiesCreated++
    if (stage === 'customer') customersWon++
  }
  return { mqlsCreated: results.length, sqlsCreated, opportunitiesCreated, customersWon }
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
