import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/hubspot/sql-to-opportunity-monthly?months=4&nocache=1
 *
 * METHODOLOGY REWRITE (2026-09-21, per explicit user report — "this looks wrong" on the Monthly
 * Trend chart, then explicit confirmation to rebuild as a true cohort rate): the original version
 * divided two INDEPENDENTLY-DATED populations that only coincidentally shared a month label —
 * "SQL" was contacts CREATED that month currently at SQL stage, "Opportunity" was DEALS CREATED
 * that month (a different object, different date field, no guaranteed link to that month's SQL
 * contacts at all). Verified directly against August 2026: of the 3 deals counted as "August
 * Opportunities," only 1 was even associated with a contact created in August — the other two
 * were associated with contacts created in July (one deal) and July/September (the other) — so
 * "3/18 = 17%" never meant "17% of August's SQLs became Opportunities." Same class of mismatch
 * already documented for the Executive Dashboard's cohort work (deal-createdate vs.
 * contact-createdate are different cohorts) — this route just hadn't been fixed yet.
 *
 * This now uses the SAME cohort methodology as executive-cohorts/route.ts's Cohort Funnel Table:
 * - SQL (fixed cohort, the denominator): contacts CREATED in the month, Book a Demo, @lyzr.ai
 *   excluded, whose lifecyclestage has EVER reached SQL-or-beyond (SQL_STAGES_CUMULATIVE — SQL,
 *   Opportunity, or Customer). Cumulative, not exact-current-stage-only — a contact who
 *   progressed past SQL must stay IN this cohort, or their eventual deal would be silently
 *   dropped from the numerator too (the exact "Opportunities=1, Customers=16" class of bug
 *   already found and fixed elsewhere — see CLAUDE.md). The cohort's SIZE is permanent (a
 *   contact's createdate never changes); this is what "fixed cohort" means.
 * - Opportunity (the numerator, dynamic): of THAT SAME fixed cohort, how many contacts have AT
 *   LEast one associated Deal in the Studio Deals pipeline with deal_source in
 *   {Direct, Inbound, Marketing} — checked live, via each contact's actual associated deal(s),
 *   regardless of when that deal was created. This is what makes it "eventual" — a July SQL
 *   contact who gets a deal in September now correctly counts toward July's rate once that
 *   happens, instead of being invisible to this chart forever.
 * - Maturity: a recent month's cohort hasn't had time to convert yet, so its rate will always
 *   read low regardless of true performance — same COHORT_MATURITY_THRESHOLDS boundaries as
 *   executive-cohorts/route.ts (not imported from it — each API route in this app is
 *   self-contained — just the same day-cutoffs, kept in sync by hand if ever changed).
 */

const HUBSPOT_API_BASE = 'https://api.hubapi.com'
const STUDIO_PIPELINE_ID = '668588091' // Studio Deals pipeline — same as deals-acv/route.ts
const MARKETING_DEAL_SOURCES = ['Direct', 'Inbound', 'Marketing']

// Same portal-specific label mismatch as mqls/route.ts — internal 'opportunity' = SQL label.
// Cumulative: reached SQL or beyond (SQL, Opportunity, or Customer stage) — see header note.
const SQL_STAGES_CUMULATIVE = new Set(['opportunity', '249550600', 'customer'])

const COHORT_MATURITY_THRESHOLDS = {
  tooEarly: { maxDays: 30, label: 'Too Early to Judge' },
  developing: { maxDays: 60, label: 'Developing' },
  partiallyMature: { maxDays: 90, label: 'Partially Mature' },
  mature: { maxDays: Infinity, label: 'Mature' },
} as const

function classifyMaturity(ageDays: number): string {
  if (ageDays <= COHORT_MATURITY_THRESHOLDS.tooEarly.maxDays) return COHORT_MATURITY_THRESHOLDS.tooEarly.label
  if (ageDays <= COHORT_MATURITY_THRESHOLDS.developing.maxDays) return COHORT_MATURITY_THRESHOLDS.developing.label
  if (ageDays <= COHORT_MATURITY_THRESHOLDS.partiallyMature.maxDays) return COHORT_MATURITY_THRESHOLDS.partiallyMature.label
  return COHORT_MATURITY_THRESHOLDS.mature.label
}

export const maxDuration = 120

// --- Firestore cache — same policy as executive-cohorts' membership tier: infinite once the
// cohort month has closed (createdate cohort membership never changes), 1 hour while still open
// (population still growing). The live deal-association check is cheap enough (one batched pass)
// that it doesn't need its own separate, shorter-TTL tier the way executive-cohorts splits
// membership/outcome — re-running it on every cache-miss is fine. ---
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
    const appName = 'sql-to-opp-cohort-cache'
    const existing = getApps().find((a: any) => a.name === appName)
    const app = existing || initializeApp({ credential: cert({ projectId: PROJECT_ID, clientEmail: SA_EMAIL, privateKey: SA_KEY }) }, appName)
    cacheDb = getFirestore(app)
    return cacheDb
  } catch { cacheDb = null; return null }
}

async function getCache(period: string, periodClosed: boolean): Promise<any | null> {
  try {
    const db = getCacheDb()
    if (!db) return null
    const doc = await db.collection('sql_to_opp_cohort_cache').doc(period).get()
    if (!doc.exists) return null
    const data = doc.data()!
    const cachedAt = data.cachedAt?.toDate?.() || new Date(0)
    const ageMs = Date.now() - cachedAt.getTime()
    return ageMs < (periodClosed ? 604800000 : 3600000) ? data.result : null // 7d closed, 1h open
  } catch { return null }
}
async function setCache(period: string, result: any): Promise<void> {
  try {
    const db = getCacheDb()
    if (!db) return
    await db.collection('sql_to_opp_cohort_cache').doc(period).set({ result, cachedAt: new Date() })
  } catch {}
}

async function searchContacts(apiKey: string, filters: object[]): Promise<any[]> {
  const results: any[] = []
  let after: string | undefined
  while (true) {
    const body: any = { filterGroups: [{ filters }], properties: ['lifecyclestage'], limit: 100 }
    if (after) body.after = after
    const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      if (res.status === 429) { await new Promise(r => setTimeout(r, 1100)); continue }
      throw new Error(`HubSpot contacts search failed: ${res.status}`)
    }
    const data = await res.json()
    results.push(...(data.results || []))
    if (!data.paging?.next?.after || data.results?.length === 0) break
    after = data.paging.next.after
    await new Promise(r => setTimeout(r, 150))
  }
  return results
}

/**
 * For a fixed list of SQL-cohort contact IDs, checks each one's actual associated deals for a
 * marketing-driven Studio deal (any stage — "reached Opportunity" means a deal exists, not that
 * it was won). Same batched pattern as executive-cohorts/route.ts's classifyOutcomes().
 */
async function countReachedOpportunity(apiKey: string, contactIds: string[]): Promise<number> {
  let reached = 0
  const BATCH = 8
  for (let i = 0; i < contactIds.length; i += BATCH) {
    const batch = contactIds.slice(i, i + BATCH)
    const results = await Promise.all(batch.map(async (id) => {
      try {
        const assocRes = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${id}/associations/deals?limit=10`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        if (!assocRes.ok) return false
        const assocData = await assocRes.json()
        const dealIds = (assocData.results || []).map((r: any) => r.id)
        if (dealIds.length === 0) return false
        for (const dealId of dealIds) {
          const dealRes = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/deals/${dealId}?properties=pipeline,deal_source`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          })
          if (!dealRes.ok) continue
          const dealData = await dealRes.json()
          const p = dealData.properties || {}
          if (p.pipeline === STUDIO_PIPELINE_ID && MARKETING_DEAL_SOURCES.includes(p.deal_source)) return true
        }
        return false
      } catch { return false }
    }))
    reached += results.filter(Boolean).length
    if (i + BATCH < contactIds.length) await new Promise(r => setTimeout(r, 150))
  }
  return reached
}

async function fetchMonthCohort(apiKey: string, startMs: number, endMs: number) {
  const contacts = await searchContacts(apiKey, [
    { propertyName: 'createdate', operator: 'GTE', value: startMs.toString() },
    { propertyName: 'createdate', operator: 'LT', value: endMs.toString() },
    { propertyName: 'email', operator: 'NOT_CONTAINS_TOKEN', value: 'lyzr.ai' },
    { propertyName: 'lead_form_type', operator: 'CONTAINS_TOKEN', value: 'Book a Demo' },
    { propertyName: 'lifecyclestage', operator: 'IN', values: Array.from(SQL_STAGES_CUMULATIVE) },
  ])
  const sqlCohortIds = contacts.map(c => c.id)
  const opportunity = await countReachedOpportunity(apiKey, sqlCohortIds)
  return { sql: sqlCohortIds.length, opportunity }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const months = Math.min(Math.max(parseInt(searchParams.get('months') || '4', 10) || 4, 1), 12)
  const noCache = searchParams.get('nocache') === '1'

  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'HUBSPOT_API_KEY not configured' }, { status: 500 })
  }

  try {
    const today = new Date()
    const results: { period: string; label: string; sql: number; opportunity: number; rate: number; ageDays: number; maturity: string }[] = []

    for (let i = months - 1; i >= 0; i--) {
      const m = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i, 1))
      const nextM = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - i + 1, 1))
      const pad = (n: number) => String(n).padStart(2, '0')
      const period = `${m.getUTCFullYear()}-${pad(m.getUTCMonth() + 1)}`
      const label = m.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
      const periodClosed = nextM.getTime() < today.getTime()
      const ageDays = Math.floor((today.getTime() - m.getTime()) / 86_400_000)
      const maturity = classifyMaturity(ageDays)

      let cached = noCache ? null : await getCache(period, periodClosed)
      if (!cached) {
        cached = await fetchMonthCohort(apiKey, m.getTime(), nextM.getTime())
        await setCache(period, cached)
      }

      const { sql, opportunity } = cached
      const rate = sql > 0 ? Math.round((opportunity / sql) * 100) : 0
      results.push({ period, label, sql, opportunity, rate, ageDays, maturity })
    }

    return NextResponse.json({ months: results, maturityThresholds: COHORT_MATURITY_THRESHOLDS })
  } catch (err: any) {
    console.error('[sql-to-opportunity-monthly] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
