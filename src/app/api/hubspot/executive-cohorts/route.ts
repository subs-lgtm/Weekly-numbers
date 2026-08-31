import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/hubspot/executive-cohorts
 *
 * Sections 3 & 4 of the Executive Dashboard — "Cohort Conversion Performance" + the Cohort
 * Funnel Table.
 *
 * METHODOLOGY (corrected per explicit user instruction after the hs_v2_date_entered_* event-date
 * version produced numbers that didn't match what the user could verify themselves in HubSpot):
 * each cohort's membership is defined EXACTLY like the existing /api/hubspot/mqls route —
 * `createdate` in the cohort month + `lead_form_type CONTAINS_TOKEN 'Book a Demo'` (the
 * dashboard's one MQL definition, see CLAUDE.md) + the standard @lyzr.ai exclusion. This is a
 * fixed, permanent denominator (createdate never changes) — already cross-validated cell-by-cell
 * against the user's own HubSpot CSV export for March-August with only the known EDT/UTC
 * boundary rounding (±1) as any difference at all.
 *
 * "SQLs" is that same cohort's CURRENT lifecyclestage, EXACT match (SQL_EXACT, matching
 * HubSpot's own "Lifecycle stage is X" UI filter — per the 57-vs-75 investigation in CLAUDE.md).
 * "Opportunities" is deliberately CUMULATIVE (OPP_STAGES_CUMULATIVE — currently at Opportunity
 * OR Customer stage), not exact-match: a contact currently marked Customer already passed
 * through Opportunity, and excluding them (as exact-match would) produced a backwards,
 * non-shrinking funnel (Opportunities=1, Customers Won=16 for one real month) — that mismatch,
 * not just presentation, was the actual bug flagged by the user.
 *
 * "Customers Won" is verified against the actual HubSpot DEAL record (Studio Deals pipeline,
 * Closed Won stage) for every contact in that Opportunity-or-beyond set — NOT the contact's own
 * `lifecyclestage` label, which can lag behind or be set without a real backing deal. Per
 * explicit user instruction: pull this from the Deal ("opportunity section"), scoped to contacts
 * that actually came through this cohort's Book-a-Demo → Opportunity path, not a blanket
 * contacts-level customer count. See classifyOutcomes().
 *
 * This is what makes the cohort dynamic in the correct way: the denominator (createdate cohort
 * size) never changes, but the stage/deal breakdown is re-read live every request, so it updates
 * as records actually progress — satisfying "denominator static, outcome dynamic" without any
 * event-date property. Do NOT reintroduce hs_v2_date_entered_* here — that produced
 * technically-correct but unverifiable (and much lower/laggier) numbers the user could not
 * reproduce via HubSpot's own UI filters, which is what triggered this rewrite.
 *
 * Query params: ?months=6 (trailing monthly cohorts, default 6) &nocache=1
 */

const HUBSPOT_API_BASE = 'https://api.hubapi.com'

// Same portal-specific label mismatch as mqls/route.ts — internal 'opportunity' = SQL label,
// internal '249550600' = Opportunity label. Do not swap.
const SQL_EXACT = new Set(['opportunity'])
const OPP_STAGES_CUMULATIVE = new Set(['249550600', 'customer']) // reached Opportunity or beyond

const CLOSED_WON_STAGE_ID = '982194449'
const CLOSED_LOST_STAGE_IDS = new Set(['982194450', '982194451']) // Closed Lost + Dropped

// The Predictive Funnel always projects the 3 most-recent cohorts, regardless of how many
// months the caller asked to see displayed in the main Cohort Funnel Table.
const TRAILING_PROJECTION_MONTHS = 3

// Cohort maturity thresholds — code-level constant per confirmed decision (not runtime-editable
// in this build; revisit if/when an admin UI is wanted). Age is in days since the cohort
// period's start date (the 1st of the cohort month).
export const COHORT_MATURITY_THRESHOLDS = {
  tooEarly:        { maxDays: 30, label: 'Too Early to Judge' },
  developing:      { maxDays: 60, label: 'Developing' },
  partiallyMature: { maxDays: 90, label: 'Partially Mature' },
  mature:          { maxDays: Infinity, label: 'Mature' }, // 91+
} as const

function classifyMaturity(ageDays: number): string {
  if (ageDays <= COHORT_MATURITY_THRESHOLDS.tooEarly.maxDays) return COHORT_MATURITY_THRESHOLDS.tooEarly.label
  if (ageDays <= COHORT_MATURITY_THRESHOLDS.developing.maxDays) return COHORT_MATURITY_THRESHOLDS.developing.label
  if (ageDays <= COHORT_MATURITY_THRESHOLDS.partiallyMature.maxDays) return COHORT_MATURITY_THRESHOLDS.partiallyMature.label
  return COHORT_MATURITY_THRESHOLDS.mature.label
}

export const maxDuration = 180

// --- Firestore cache — same policy as mql_cache: 7-day TTL once the createdate month has
// closed, 1-hour TTL for the current month. Unlike the earlier version, there is no separate
// "static membership" tier — lifecyclestage is live data and deserves periodic refresh even for
// old cohorts, exactly like mqls/route.ts already does. ---
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
    const appName = 'executive-cohort-cache'
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
    const doc = await db.collection('executive_cohort_cache_v5').doc(period).get()
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
    await db.collection('executive_cohort_cache_v5').doc(period).set({ result, cachedAt: new Date() })
  } catch {}
}

async function searchContacts(apiKey: string, filters: any[], properties: string[]): Promise<any[]> {
  const results: any[] = []
  let after: string | undefined
  while (true) {
    const body: any = { filterGroups: [{ filters }], properties, limit: 100 }
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
  return results
}

/**
 * Classify a fixed contact list as WON / LOST / STILL_OPEN, as of right now — verified against
 * each contact's actual associated Deal record in the Studio Deals pipeline, NEVER the contact's
 * own `lifecyclestage` label. Per explicit user instruction: a contact marked lifecyclestage=
 * 'customer' with no real Closed Won deal behind it must NOT count as Customer Won here — the
 * Deal record is the source of truth, the Contact label is not trusted even as a shortcut.
 */
async function classifyOutcomes(apiKey: string, contacts: Array<{ id: string; lifecyclestage: string }>) {
  let won = 0, lost = 0, stillOpen = 0

  const BATCH = 8
  for (let i = 0; i < contacts.length; i += BATCH) {
    const batch = contacts.slice(i, i + BATCH)
    const results = await Promise.all(batch.map(async (c) => {
      try {
        const assocRes = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${c.id}/associations/deals?limit=5`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        if (!assocRes.ok) return 'STILL_OPEN'
        const assocData = await assocRes.json()
        const dealIds = (assocData.results || []).map((r: any) => r.id)
        if (dealIds.length === 0) return 'STILL_OPEN'
        let sawLost = false
        for (const dealId of dealIds) {
          const dealRes = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/deals/${dealId}?properties=dealstage`, {
            headers: { Authorization: `Bearer ${apiKey}` },
          })
          if (!dealRes.ok) continue
          const dealData = await dealRes.json()
          const stage = dealData.properties?.dealstage
          if (stage === CLOSED_WON_STAGE_ID) return 'WON'
          if (CLOSED_LOST_STAGE_IDS.has(stage)) sawLost = true
        }
        return sawLost ? 'LOST' : 'STILL_OPEN'
      } catch { return 'STILL_OPEN' }
    }))
    for (const outcome of results) {
      if (outcome === 'WON') won++
      else if (outcome === 'LOST') lost++
      else stillOpen++
    }
    if (i + BATCH < contacts.length) await new Promise(r => setTimeout(r, 150))
  }
  return { won, lost, stillOpen }
}

/** One month's cohort: createdate + Book a Demo (the dashboard's MQL definition), current-stage snapshot. */
async function fetchCohort(apiKey: string, monthStartMs: number, monthEndMs: number) {
  const contacts = await searchContacts(apiKey, [
    { propertyName: 'createdate', operator: 'GTE', value: monthStartMs.toString() },
    { propertyName: 'createdate', operator: 'LT', value: monthEndMs.toString() },
    { propertyName: 'email', operator: 'NOT_CONTAINS_TOKEN', value: 'lyzr.ai' },
    { propertyName: 'lead_form_type', operator: 'CONTAINS_TOKEN', value: 'Book a Demo' },
  ], ['lifecyclestage'])

  let sql = 0, workingMqls = 0
  const oppCumulativeContacts: Array<{ id: string; lifecyclestage: string }> = []
  for (const c of contacts) {
    const stage = c.properties?.lifecyclestage || ''
    if (SQL_EXACT.has(stage)) sql++
    // "Working MQLs" — still sitting exactly at the MQL stage: hasn't progressed to SQL/Opp/
    // Customer yet, AND hasn't been Discarded/Disqualified (those are different current-stage
    // values, so an exact 'marketingqualifiedlead' match already excludes them). This is the
    // pool that's still genuinely "in play" and could still convert forward as it ages — the
    // basis for the projection numbers below.
    if (stage === 'marketingqualifiedlead') workingMqls++
    // "Reached Opportunity or beyond" — deliberately CUMULATIVE, not exact-current-stage. A
    // contact currently marked Customer already passed through Opportunity; excluding them (as
    // an exact-match would) undercounts "Opportunities" while "Customers Won" stays high, which
    // produces a backwards, non-shrinking funnel (e.g. Opportunities=1, Customers Won=16) — that
    // was the actual bug the user flagged, not a display issue.
    if (OPP_STAGES_CUMULATIVE.has(stage)) oppCumulativeContacts.push({ id: c.id, lifecyclestage: stage })
  }

  return {
    mqlCount: contacts.length,
    sqlCount: sql,
    // "Active SQLs" for the projection table is this same exact-SQL-stage count — contacts
    // currently sitting at SQL, not yet progressed to Opportunity/Customer or discarded.
    workingMqls,
    // Contacts currently at Opportunity-or-beyond — this list is BOTH the "Opportunities" column
    // denominator AND the exact set that gets deal-verified below for Customers Won. Same
    // population feeds both, so the two numbers are always mutually consistent.
    oppCumulativeContacts,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'HUBSPOT_API_KEY not configured' }, { status: 500 })
  }
  const noCache = searchParams.get('nocache') === '1'
  const months = Math.min(Math.max(parseInt(searchParams.get('months') || '6', 10), 1), 12)

  // The Predictive Funnel needs at least a few OLDER cohorts beyond the trailing 3-month
  // projection window to compute a baseline rate from. If the user asks for a display window
  // that's too narrow to leave any older cohorts (e.g. "Last 3 months"), fetch more history
  // internally than what gets displayed, so the baseline never silently comes up empty — only
  // the last `months` cohorts are actually returned/shown, per what was requested. Capped at 12
  // (same ceiling as `months` itself) so a small `months` value can't balloon the fetch.
  const MIN_BASELINE_MONTHS = 3
  const internalMonths = Math.min(Math.max(months, TRAILING_PROJECTION_MONTHS + MIN_BASELINE_MONTHS), 12)

  try {
    const now = new Date()
    const cohorts: any[] = []

    for (let i = internalMonths - 1; i >= 0; i--) {
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1))
      const period = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}`
      const cohortStartDate = monthStart.toISOString().slice(0, 10)
      const periodClosed = monthEnd.getTime() < now.getTime()
      const ageDays = Math.floor((now.getTime() - monthStart.getTime()) / 86_400_000)
      const maturity = classifyMaturity(ageDays)

      let cached = noCache ? null : await getCache(period, periodClosed)
      if (!cached) {
        const cohort = await fetchCohort(apiKey, monthStart.getTime(), monthEnd.getTime())
        // Deal-verified outcome for every contact that reached Opportunity-or-beyond — "Won" here
        // means an actual associated Deal record hit Closed Won in the Studio Deals pipeline, not
        // just the contact's own lifecyclestage label (which can lag or be set without a real
        // deal behind it). Per explicit user instruction: pull Customers Won from the Deal
        // ("opportunity section"), not from the Contact's lifecyclestage.
        const opportunityOutcome = await classifyOutcomes(apiKey, cohort.oppCumulativeContacts)
        cached = { mqlCount: cohort.mqlCount, sqlCount: cohort.sqlCount, workingMqls: cohort.workingMqls, opportunityCount: cohort.oppCumulativeContacts.length, opportunityOutcome }
        await setCache(period, cached)
      }

      const { mqlCount, sqlCount, workingMqls, opportunityCount, opportunityOutcome } = cached
      const { won, lost, stillOpen } = opportunityOutcome
      const customersWon = won // deal-verified Closed Won count, scoped to this cohort's Opportunity-or-beyond contacts

      cohorts.push({
        period,
        label: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
        cohortStartDate,
        ageDays,
        maturity,
        mqlCount, sqlCount, workingMqls, activeSqls: sqlCount, opportunityCount, customersWon,
        mqlToSql: { pct: mqlCount > 0 ? (sqlCount / mqlCount) * 100 : null },
        sqlToOpportunity: { pct: sqlCount > 0 ? (opportunityCount / sqlCount) * 100 : null },
        opportunityToCustomer: { pct: opportunityCount > 0 ? (customersWon / opportunityCount) * 100 : null },
        // Opportunity Cohort Outcome chart: the SAME Opportunity-or-beyond population as the
        // row above, split Won (deal-verified) / Lost (deal-verified) / Still Open.
        opportunityCohort: {
          count: opportunityCount,
          won, lost, stillOpen,
          wonPct: opportunityCount > 0 ? (won / opportunityCount) * 100 : null,
          lostPct: opportunityCount > 0 ? (lost / opportunityCount) * 100 : null,
          stillOpenPct: opportunityCount > 0 ? (stillOpen / opportunityCount) * 100 : null,
        },
      })
    }

    // --- Predictive Funnel (confirmed methodology): project how many MORE SQLs/Opportunities
    // are likely to emerge from the still-Working pool of the TRAILING_PROJECTION_MONTHS most
    // recent cohorts, using the average conversion rate of every OLDER cohort (excluded from
    // this window, so a cohort is never used to project itself — avoids circularity). Per user
    // request, this trailing window is always shown regardless of exact maturity label — a
    // cohort that's just barely crossed into "Mature" (e.g. 91 days) still gets a projection
    // here, since "Mature" is a coarse label and the user wants the recent-months view
    // regardless of which side of that boundary a given cohort happens to fall on.
    // IMPORTANT — denominator fix: `sqlCount` only counts contacts CURRENTLY stuck at SQL
    // (haven't progressed). A rate of opportunityCount/sqlCount compares "people who moved on"
    // against "people who didn't," not against everyone who ever reached SQL — that overstates
    // the true conversion rate (confirmed: 21.6% naive vs 15.8% corrected on real March-May
    // data, flagged by the user as looking too high). The correct denominator for "of everyone
    // who reached SQL, what fraction eventually progressed to Opportunity" is
    // sqlCount + opportunityCount (opportunityCount is already cumulative — currently at
    // Opportunity-or-beyond — so adding sqlCount gives everyone who ever reached SQL at all).
    const reachedSqlOrBeyond = (c: any) => c.sqlCount + c.opportunityCount

    // baselineCohorts comes from the FULL internally-fetched set (cohorts, length
    // internalMonths), not from the narrower set the caller asked to display — this is exactly
    // what keeps the baseline populated even when `months` is too small to leave any older
    // cohorts of its own (e.g. months=3 with TRAILING_PROJECTION_MONTHS=3).
    const baselineCohorts = cohorts.slice(0, Math.max(0, cohorts.length - TRAILING_PROJECTION_MONTHS))
      .filter(c => c.mqlCount > 0 && reachedSqlOrBeyond(c) > 0)
    const projectableCohorts = new Set(cohorts.slice(-TRAILING_PROJECTION_MONTHS).map(c => c.period))
    const avg = (nums: number[]) => nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null
    const baselineMqlToSql = avg(baselineCohorts.map(c => reachedSqlOrBeyond(c) / c.mqlCount))
    const baselineSqlToOpp = avg(baselineCohorts.map(c => c.opportunityCount / reachedSqlOrBeyond(c)))

    for (const c of cohorts) {
      if (!projectableCohorts.has(c.period) || baselineMqlToSql === null || baselineSqlToOpp === null) {
        c.projection = null
        continue
      }
      // projectedAdditionalSql = additional contacts from the still-Working MQL pool expected to
      // eventually reach SQL-or-beyond. projectedTotalSql is therefore measured against
      // reachedSqlOrBeyond (sqlCount + opportunityCount), not sqlCount alone — otherwise contacts
      // who already progressed past SQL would be invisibly dropped from the "total SQL" figure.
      const projectedAdditionalSql = Math.round(c.workingMqls * baselineMqlToSql)
      const projectedAdditionalOpp = Math.round(c.activeSqls * baselineSqlToOpp)
      c.projection = {
        projectedAdditionalSql,
        projectedAdditionalOpp,
        projectedTotalSql: reachedSqlOrBeyond(c) + projectedAdditionalSql,
        projectedTotalOpp: c.opportunityCount + projectedAdditionalOpp,
      }
    }

    // Only return what the caller actually asked to see — internalMonths may have fetched extra
    // older history purely to feed the projection baseline above; that extra history itself
    // never gets displayed. The trailing-3 projectable cohorts are always within this slice
    // since internalMonths is never shrunk below `months`.
    const displayedCohorts = cohorts.slice(-months)

    return NextResponse.json({
      cohorts: displayedCohorts,
      maturityThresholds: COHORT_MATURITY_THRESHOLDS,
      projectionBaseline: {
        mqlToSqlPct: baselineMqlToSql !== null ? baselineMqlToSql * 100 : null,
        sqlToOppPct: baselineSqlToOpp !== null ? baselineSqlToOpp * 100 : null,
        matureCohortsUsed: baselineCohorts.map(c => c.period),
      },
    })
  } catch (err: any) {
    console.error('[executive-cohorts] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
