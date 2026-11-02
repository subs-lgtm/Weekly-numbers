import { NextRequest, NextResponse } from 'next/server'
import { fetchOpportunityDetails, loadQualifyingDeals, companyCopiedStageIds, resolveChannel, type OpportunityDetail } from '@/lib/marketing-opportunities'
import { THEMES, NONE, extractUseCase, classifyUseCase } from '@/lib/use-case-themes'

/**
 * GET /api/hubspot/executive-breakdown?months=3
 *
 * Executive Dashboard add-ons for the last N COMPLETED calendar months (default 3 = e.g. Jul/Aug/Sep):
 *   1. SQLs by acquisition source   (cohort SQLs split by channel + HubSpot original source)
 *   2. Opportunity pipeline         (count, value, source split, current stage, bottom-of-funnel / stuck flags)
 *   3. SQLs & Opportunities by use case (keyword themes on the form message / LinkedIn lead-form answer)
 *
 * Same population AND same definitions as the Cohort Funnel Table (so the totals tie out row for row):
 * contacts created in the month with Book a Demo in lead_form_type (excluding @lyzr.ai).
 *   SQL         = REACHED SQL: currently at the SQL lifecycle stage (internal 'opportunity', stage not merely copied
 *                 from the company record) OR has a marketing-sourced Studio deal. (Unified 2026-10-26; this panel
 *                 kept the old "currently exactly at SQL" rule until 2026-11-02, so leads that had already moved on
 *                 to a deal - e.g. October's two paid leads, Moxa and Bosch Hungary - vanished from it.)
 *   Opportunity = cohort contact with a marketing-sourced Studio Deals deal (src/lib/marketing-opportunities.ts).
 * Channel = resolveChannel() - paid signals first, then lead_source_category, then HubSpot original source.
 */

const HUBSPOT_API_BASE = 'https://api.hubapi.com'
export const maxDuration = 180

const SQL_EXACT = new Set(['opportunity'])

const ORIGINAL_SOURCE_LABEL: Record<string, string> = {
  PAID_SEARCH: 'Paid search', PAID_SOCIAL: 'Paid social', ORGANIC_SEARCH: 'Organic search', DIRECT_TRAFFIC: 'Direct traffic',
  SOCIAL_MEDIA: 'Organic social', REFERRALS: 'Referral', EMAIL_MARKETING: 'Email', OFFLINE: 'Offline / integration',
  OTHER_CAMPAIGNS: 'Other campaign', AI_REFERRALS: 'AI referral',
}

let cacheDb: any = null
function getCacheDb() {
  if (cacheDb) return cacheDb
  try {
    const { initializeApp, getApps, cert } = require('firebase-admin/app')
    const { getFirestore } = require('firebase-admin/firestore')
    const SA_EMAIL = process.env.SA_CLIENT_EMAIL || ''
    const SA_KEY = (process.env.SA_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    const PROJECT_ID = process.env.GCP_PROJECT_ID || 'abm-agent'
    if (!SA_EMAIL || !SA_KEY) return null
    const appName = 'executive-breakdown-cache'
    const app = getApps().find((a: any) => a.name === appName) || initializeApp({ credential: cert({ projectId: PROJECT_ID, clientEmail: SA_EMAIL, privateKey: SA_KEY }) }, appName)
    cacheDb = getFirestore(app)
    return cacheDb
  } catch { return null }
}
async function getCache(period: string): Promise<any | null> {
  try {
    const db = getCacheDb(); if (!db) return null
    const doc = await db.collection('executive_breakdown_cache_v3').doc(period).get()
    if (!doc.exists) return null
    const d = doc.data()!
    // Deal stages move, so even closed months are only trusted for an hour.
    return Date.now() - (d.cachedAt?.toDate?.()?.getTime() || 0) < 3_600_000 ? d.result : null
  } catch { return null }
}
async function setCache(period: string, result: any) {
  try { const db = getCacheDb(); if (db) await db.collection('executive_breakdown_cache_v3').doc(period).set({ result, cachedAt: new Date() }) } catch {}
}

async function searchContacts(apiKey: string, filters: any[], properties: string[]): Promise<any[]> {
  const results: any[] = []
  let after: string | undefined
  while (true) {
    const body: any = { filterGroups: [{ filters }], properties, limit: 100 }
    if (after) body.after = after
    const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`, {
      method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
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

const bump = (m: Record<string, number>, k: string, n = 1) => { m[k] = (m[k] || 0) + n }

/**
 * Paid-attributed Opportunities that sit OUTSIDE the Book a Demo cohort: leads created in the month through another form
 * (e.g. "GSI and SI") whose paid signals (LinkedIn Ads / Google Ads UTMs, original source) resolve to "Paid Campaigns" and that
 * have a marketing-sourced Studio deal. Shown as its own line so the cohort totals above (Book a Demo only) keep tying out
 * to the Cohort Funnel Table; these are NOT added to them. Example: Accenture - Chevron Engine_OpenFinetuner (LinkedIn GSI/SI).
 */
async function computePaidOtherForms(apiKey: string, monthStart: Date, monthEnd: Date) {
  const contacts = await searchContacts(apiKey, [
    { propertyName: 'createdate', operator: 'GTE', value: monthStart.getTime().toString() },
    { propertyName: 'createdate', operator: 'LT', value: monthEnd.getTime().toString() },
    { propertyName: 'email', operator: 'NOT_CONTAINS_TOKEN', value: 'lyzr.ai' },
    { propertyName: 'num_associated_deals', operator: 'GTE', value: '1' },
  ], ['lead_form_type', 'lead_source_category', 'hs_analytics_source', 'utm_source', 'utm_medium', 'company', 'email'])
  const candidates: Array<{ id: string; channel: string }> = []
  for (const c of contacts) {
    const p = c.properties || {}
    const forms = String(p.lead_form_type || '').split(';').map((x: string) => x.trim()).filter(Boolean)
    if (!forms.some(f => f !== 'Agent Studio') || forms.some(f => /book a demo/i.test(f))) continue
    const email = String(p.email || '').toLowerCase()
    if (email.includes('lyzr.com') || /^lyzr/i.test(String(p.company || ''))) continue
    const channel = resolveChannel(p)
    if (channel === 'Paid Campaigns') candidates.push({ id: String(c.id), channel })
  }
  const deals = await fetchOpportunityDetails(apiKey, candidates)
  deals.sort((a, b) => b.amount - a.amount)
  return { count: deals.length, value: deals.reduce((s, d) => s + d.amount, 0), deals }
}

async function computeMonth(apiKey: string, monthStart: Date, monthEnd: Date) {
  const contacts = await searchContacts(apiKey, [
    { propertyName: 'createdate', operator: 'GTE', value: monthStart.getTime().toString() },
    { propertyName: 'createdate', operator: 'LT', value: monthEnd.getTime().toString() },
    { propertyName: 'email', operator: 'NOT_CONTAINS_TOKEN', value: 'lyzr.ai' },
    { propertyName: 'lead_form_type', operator: 'CONTAINS_TOKEN', value: 'Book a Demo' },
  ], ['lifecyclestage', 'num_associated_deals', 'lead_source_category', 'hs_analytics_source', 'utm_source', 'utm_medium', 'message', 'platform_tools'])

  // --- deals first: a lead with a marketing-sourced deal counts as an SQL even if its lifecycle label moved on ---
  const channelOf = new Map<string, string>()
  const dealCandidates: Array<{ id: string; channel: string }> = []
  const exactSqlIds: string[] = []
  for (const c of contacts) {
    const props = c.properties || {}
    const id = String(c.id)
    channelOf.set(id, resolveChannel(props))
    if (SQL_EXACT.has(props.lifecyclestage || '')) exactSqlIds.push(id)
    if (parseInt(props.num_associated_deals || '0', 10) > 0) dealCandidates.push({ id, channel: channelOf.get(id)! })
  }
  const qualifying = await loadQualifyingDeals(apiKey, dealCandidates.map(d => d.id))
  const copied = await companyCopiedStageIds(apiKey, exactSqlIds)
  const sqlIds = new Set<string>([...exactSqlIds.filter(id => !copied.has(id)), ...qualifying.keys()])

  // --- 1. SQLs by source --------------------------------------------------------------------------
  const sqlByChannel: Record<string, number> = {}
  const sqlByOriginal: Record<string, number> = {}
  const sqlByChannelOriginal: Record<string, Record<string, number>> = {}
  let sqlTotal = 0

  // --- 3. use cases (SQLs now; opportunities filled after the deal lookup) -------------------------
  const sqlUseCase: Record<string, number> = {}
  const oppUseCase: Record<string, number> = {}
  const themeOf = (props: any) => classifyUseCase(extractUseCase({ message: props.message || '', platformTools: props.platform_tools || '' }).text).key
  const themeByContact = new Map<string, string>()

  for (const c of contacts) {
    const props = c.properties || {}
    const id = String(c.id)
    const channel = channelOf.get(id)!
    const theme = themeOf(props)
    themeByContact.set(id, theme)
    if (sqlIds.has(id)) {
      sqlTotal++
      bump(sqlByChannel, channel)
      const orig = ORIGINAL_SOURCE_LABEL[props.hs_analytics_source || ''] || props.hs_analytics_source || 'Unknown'
      bump(sqlByOriginal, orig)
      ;(sqlByChannelOriginal[channel] ||= {})[orig] = ((sqlByChannelOriginal[channel] || {})[orig] || 0) + 1
      bump(sqlUseCase, theme)
    }
  }

  // --- 2. opportunity pipeline --------------------------------------------------------------------
  const deals: OpportunityDetail[] = await fetchOpportunityDetails(apiKey, dealCandidates, qualifying)
  const bySource: Record<string, { count: number; value: number }> = {}
  const byStage: Record<string, { stage: string; group: string; count: number; value: number }> = {}
  const groups: Record<string, { count: number; value: number }> = {}
  let totalValue = 0, stuckCount = 0, stuckValue = 0
  for (const d of deals) {
    totalValue += d.amount
    ;(bySource[d.channel] ||= { count: 0, value: 0 }).count++
    bySource[d.channel].value += d.amount
    const sk = d.stage
    ;(byStage[sk] ||= { stage: d.stage, group: d.group, count: 0, value: 0 }).count++
    byStage[sk].value += d.amount
    ;(groups[d.group] ||= { count: 0, value: 0 }).count++
    groups[d.group].value += d.amount
    if (d.stuck) { stuckCount++; stuckValue += d.amount }
    bump(oppUseCase, themeByContact.get(d.contactId) || NONE.key)
  }
  deals.sort((a, b) => b.amount - a.amount)
  const paidOtherForms = await computePaidOtherForms(apiKey, monthStart, monthEnd)

  return {
    mqls: contacts.length,
    sql: { total: sqlTotal, byChannel: sqlByChannel, byOriginalSource: sqlByOriginal, byChannelOriginal: sqlByChannelOriginal },
    opportunities: { count: deals.length, totalValue, bySource, byStage: Object.values(byStage), groups, stuck: { count: stuckCount, value: stuckValue }, deals },
    paidOtherForms,
    useCases: { sql: sqlUseCase, opportunities: oppUseCase },
  }
}

export async function GET(req: NextRequest) {
  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'HUBSPOT_API_KEY not configured' }, { status: 500 })
  const { searchParams } = new URL(req.url)
  const noCache = searchParams.get('nocache') === '1'
  const months = Math.min(Math.max(parseInt(searchParams.get('months') || '3', 10), 1), 6)

  try {
    const now = new Date()
    const out: any[] = []
    // Last N COMPLETED months (the running month is partial and excluded, same rule as Lead Priority Mix).
    for (let i = months; i >= 1; i--) {
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1))
      const period = `${monthStart.getUTCFullYear()}-${String(monthStart.getUTCMonth() + 1).padStart(2, '0')}`
      let result = noCache ? null : await getCache(period)
      if (!result) {
        result = await computeMonth(apiKey, monthStart, monthEnd)
        await setCache(period, result)
      }
      out.push({ period, label: monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }), ...result })
    }
    return NextResponse.json({
      months: out,
      themes: [...THEMES, NONE].map(t => ({ key: t.key, label: t.label, color: t.color })).concat([{ key: 'other', label: 'Other', color: '#B9AFA6' }]),
    })
  } catch (err: any) {
    console.error('[executive-breakdown] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
