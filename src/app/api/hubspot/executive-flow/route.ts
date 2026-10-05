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
 * - Opportunities Created / Customers Won: DEAL-verified, never the contact's lifecyclestage.
 *   UPDATED 2026-10-04 per explicit request to match the Cohort Funnel Table exactly: same
 *   contact cohort as MQLs (created in the period via Book a Demo), and a contact counts as an
 *   Opportunity only if it has a marketing-sourced Studio Deals deal (Inbound, Marketing,
 *   Partner Lead, SI Partner, HyperScalar, Event, and Direct — Direct re-added 2026-10-05 since the
 *   cohort is Book a Demo form submitters; Referral, Repeat Customer and blank source excluded). Customers Won = those whose qualifying deal is Closed Won. All of
 *   that logic lives in src/lib/marketing-opportunities.ts, shared with executive-cohorts, so
 *   the two can't drift. (The earlier version bucketed deals by deal createdate with
 *   deal_source IN {Direct, Inbound, Marketing}, which disagreed with the table: 3 vs 2 for
 *   September 2026, because it counted an outbound BNP Paribas deal.)
 *
 * Query params:
 *   ?start=YYYY-MM-DD&end=YYYY-MM-DD  (end exclusive, same convention as /api/hubspot/mqls)
 *   ?nocache=1                        bypass the Firestore cache
 *   ?mode=trend&months=N              server-side loop over N trailing months (for the Row 3
 *                                     trend chart) instead of a single current/previous pair
 */

import { classifyOutcomes, resolveChannel } from '@/lib/marketing-opportunities'

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
    const doc = await db.collection('executive_flow_cache_v5').doc(key).get()
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
    await db.collection('executive_flow_cache_v5').doc(key).set({ result, cachedAt: new Date() })
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
      properties: ['lifecyclestage', 'num_associated_deals', 'lead_source_category', 'hs_analytics_source', 'utm_source', 'utm_medium'],
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
  const dealCandidates: Array<{ id: string; channel: string }> = []
  for (const c of results) {
    if (SQL_EXACT.has(c.properties?.lifecyclestage || '')) sqlsCreated++
    if (parseInt(c.properties?.num_associated_deals || '0', 10) > 0) dealCandidates.push({ id: c.id, channel: resolveChannel(c.properties || {}) })
  }
  return { mqlsCreated: results.length, sqlsCreated, dealCandidates }
}

async function countAllFlow(apiKey: string, startMs: number, endMs: number) {
  const { mqlsCreated, sqlsCreated, dealCandidates } = await countContactFlow(apiKey, startMs, endMs)
  // Opportunities / Customers Won use the EXACT same definition as the Cohort Funnel Table
  // (src/lib/marketing-opportunities.ts): contacts created in the period via Book a Demo that have
  // a marketing-sourced Studio deal; Customers Won = those whose qualifying deal is Closed Won.
  const outcome = await classifyOutcomes(apiKey, dealCandidates)
  return { mqlsCreated, sqlsCreated, opportunitiesCreated: outcome.opportunityCount, customersWon: outcome.won }
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

    // Optional explicit previous window (the page uses calendar months, where "shift back by the
    // same span" would be off by a day for 30- vs 31-day months). Falls back to span-shifting.
    const prevStartParam = searchParams.get('prevStart')
    const prevEndParam = searchParams.get('prevEnd')
    const cacheKey = `${start}_${end}${prevStartParam && prevEndParam ? `_p${prevStartParam}_${prevEndParam}` : ''}`
    if (!noCache) {
      const cached = await getCached(cacheKey, end)
      if (cached) return NextResponse.json(cached)
    }

    const startMs = new Date(start + 'T00:00:00.000Z').getTime()
    const endMs = new Date(end + 'T00:00:00.000Z').getTime()
    const spanMs = endMs - startMs
    const prevStartMs = prevStartParam && prevEndParam ? new Date(prevStartParam + 'T00:00:00.000Z').getTime() : startMs - spanMs
    const prevEndMs = prevStartParam && prevEndParam ? new Date(prevEndParam + 'T00:00:00.000Z').getTime() : startMs

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
