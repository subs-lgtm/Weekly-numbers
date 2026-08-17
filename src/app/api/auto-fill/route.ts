import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { GoogleAuth } from 'google-auth-library'

export const maxDuration = 120

const SA_EMAIL = process.env.SA_CLIENT_EMAIL || ''
const SA_KEY = (process.env.SA_PRIVATE_KEY || '').replace(/\\n/g, '\n')
const PROJECT_ID = process.env.GCP_PROJECT_ID || 'abm-agent'
const HUBSPOT_KEY = process.env.HUBSPOT_API_KEY || ''
const SEMRUSH_KEY = process.env.SEMRUSH_API_KEY || ''
const SEMRUSH_DOMAIN = process.env.SEMRUSH_DOMAIN || 'lyzr.ai'
const GA4_PROP = process.env.GA4_PROPERTY_ID || ''
const GSC_SITE = process.env.GSC_SITE_URL || ''
const WP_URL = process.env.WORDPRESS_URL || ''

function getDb() {
  if (getApps().length === 0) {
    initializeApp({ credential: cert({ projectId: PROJECT_ID, clientEmail: SA_EMAIL, privateKey: SA_KEY }) })
  }
  return getFirestore()
}

async function getGoogleToken(): Promise<string> {
  const auth = new GoogleAuth({
    credentials: { type: 'service_account', client_email: SA_EMAIL, private_key: SA_KEY },
    scopes: ['https://www.googleapis.com/auth/analytics.readonly', 'https://www.googleapis.com/auth/webmasters.readonly', 'https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const client = await auth.getClient()
  const { token } = await client.getAccessToken()
  return token!
}

function weekStart(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1
  const mon = new Date(now)
  mon.setDate(now.getDate() - diff)
  // On Monday, use last week
  if (day === 1) mon.setDate(mon.getDate() - 7)
  return mon.toISOString().split('T')[0]
}

async function save(db: FirebaseFirestore.Firestore, week: string, section: string, metrics: Record<string, string>) {
  const batch = db.batch()
  for (const [key, value] of Object.entries(metrics)) {
    if (!value && value !== '0') continue
    const ref = db.collection('weekly_metrics').doc(week).collection('sections').doc(section).collection('entries').doc(key)
    batch.set(ref, { value, notes: '', updatedBy: 'auto-fill', updatedAt: new Date() }, { merge: true })
  }
  await batch.commit()
}

// ── HubSpot: MQLs, Leads, Email ──
async function fetchHubSpot(): Promise<{ mqls: Record<string, string>; leads: Record<string, string>; email: Record<string, string> }> {
  const mqls: Record<string, string> = {}
  const leads: Record<string, string> = {}
  const email: Record<string, string> = {}
  if (!HUBSPOT_KEY) return { mqls, leads, email }
  try {
    // Contacts created this week
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const contactsRes = await fetch(
      `https://api.hubapi.com/crm/v3/objects/contacts/search`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${HUBSPOT_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filterGroups: [{ filters: [{ propertyName: 'createdate', operator: 'GTE', value: weekAgo.getTime().toString() }] }],
          limit: 0,
        }),
      }
    )
    if (contactsRes.ok) {
      const d = await contactsRes.json()
      leads.leads_total = String(d.total || 0)
    }

    // Deals (demos)
    const dealsRes = await fetch(
      `https://api.hubapi.com/crm/v3/objects/deals/search`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${HUBSPOT_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filterGroups: [{ filters: [{ propertyName: 'createdate', operator: 'GTE', value: weekAgo.getTime().toString() }] }],
          limit: 0,
        }),
      }
    )
    if (dealsRes.ok) {
      const d = await dealsRes.json()
      mqls.book_a_demo_total = String(d.total || 0)
    }

    // Email campaigns
    const emailRes = await fetch(
      `https://api.hubapi.com/marketing-emails/v1/emails?limit=20&orderBy=-updated`,
      { headers: { Authorization: `Bearer ${HUBSPOT_KEY}` } }
    )
    if (emailRes.ok) {
      const d = await emailRes.json()
      const campaigns = d.objects || []
      let sent = 0, opens = 0, clicks = 0
      for (const c of campaigns.slice(0, 10)) {
        sent += c.stats?.counters?.sent || 0
        opens += c.stats?.counters?.open || 0
        clicks += c.stats?.counters?.click || 0
      }
      email.emails_sent = String(sent)
      email.unique_opens = String(opens)
      email.clicks = String(clicks)
      if (sent > 0) email.open_rate = String(Math.round((opens / sent) * 100))
      if (opens > 0) email.click_rate = String(Math.round((clicks / opens) * 100))
    }
  } catch (e) { console.error('[auto-fill] HubSpot error:', e) }
  return { mqls, leads, email }
}

// ── GA4: Organic sessions, blog sessions ──
async function fetchGA4(token: string): Promise<{ seo: Record<string, string>; content: Record<string, string> }> {
  const seo: Record<string, string> = {}
  const content: Record<string, string> = {}
  if (!GA4_PROP) return { seo, content }
  try {
    const res = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROP}:runReport`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
          metrics: [{ name: 'sessions' }],
          dimensions: [{ name: 'sessionDefaultChannelGroup' }],
        }),
      }
    )
    if (res.ok) {
      const d = await res.json()
      let organic = 0, total = 0
      for (const row of d.rows || []) {
        const ch = row.dimensionValues?.[0]?.value || ''
        const val = parseInt(row.metricValues?.[0]?.value || '0')
        total += val
        if (ch.toLowerCase().includes('organic')) organic += val
      }
      seo.organic_sessions = String(organic)
      seo.weekly_sessions = String(total)
    }

    // Blog sessions
    const blogRes = await fetch(
      `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROP}:runReport`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
          metrics: [{ name: 'sessions' }],
          dimensionFilter: { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'CONTAINS', value: '/blog' } } },
        }),
      }
    )
    if (blogRes.ok) {
      const d = await blogRes.json()
      content.blog_sessions = String(d.rows?.[0]?.metricValues?.[0]?.value || '0')
    }
  } catch (e) { console.error('[auto-fill] GA4 error:', e) }
  return { seo, content }
}

// ── GSC: Clicks, impressions, avg position ──
async function fetchGSC(token: string): Promise<Record<string, string>> {
  const seo: Record<string, string> = {}
  if (!GSC_SITE) return seo
  try {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: weekAgo.toISOString().split('T')[0],
          endDate: now.toISOString().split('T')[0],
          dimensions: [],
        }),
      }
    )
    if (res.ok) {
      const d = await res.json()
      const row = d.rows?.[0]
      if (row) {
        seo.organic_clicks_gsc = String(Math.round(row.clicks || 0))
        seo.impressions_gsc = String(Math.round(row.impressions || 0))
        seo.avg_position = String(Math.round(row.position || 0))
      }
    }
  } catch (e) { console.error('[auto-fill] GSC error:', e) }
  return seo
}

// ── SEMrush: Keyword rankings ──
async function fetchSEMrush(): Promise<Record<string, string>> {
  const seo: Record<string, string> = {}
  if (!SEMRUSH_KEY) return seo
  try {
    const res = await fetch(
      `https://api.semrush.com/?type=domain_ranks&key=${SEMRUSH_KEY}&export_columns=Or,Ot&domain=${SEMRUSH_DOMAIN}&database=us`
    )
    if (res.ok) {
      const text = await res.text()
      const lines = text.trim().split('\n')
      if (lines.length > 1) {
        const [organic_kw] = lines[1].split(';')
        seo.keywords_top50 = organic_kw || '0'
      }
    }
  } catch (e) { console.error('[auto-fill] SEMrush error:', e) }
  return seo
}

// ── WordPress: Blog posts published this week ──
async function fetchWordPress(): Promise<Record<string, string>> {
  const content: Record<string, string> = {}
  if (!WP_URL) return content
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const res = await fetch(`${WP_URL}/wp-json/wp/v2/posts?after=${weekAgo}&per_page=100&_fields=id`)
    if (res.ok) {
      const posts = await res.json()
      content.blogs_published = String(Array.isArray(posts) ? posts.length : 0)
    }
    // Total pages
    const pagesRes = await fetch(`${WP_URL}/wp-json/wp/v2/pages?per_page=1&_fields=id`)
    if (pagesRes.ok) {
      const total = pagesRes.headers.get('X-WP-Total')
      if (total) content.pages_published = total
    }
  } catch (e) { console.error('[auto-fill] WordPress error:', e) }
  return content
}

// ── Google Sheets: Agent Studio Users ──
const STUDIO_SHEET_ID = '1Jt_Pkea9NpyOgcdAqdF-O8v6tOmAIQXkkSMeD3GLt-o'

async function fetchStudioSignups(token: string): Promise<Record<string, string>> {
  const studio: Record<string, string> = {}
  try {
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${STUDIO_SHEET_ID}/values/${encodeURIComponent("'Agent Studio Users'!A1:D20")}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) return studio

    const data = await res.json()
    const rows = data.values || []
    if (rows.length < 2) return studio

    // Find the current month row (latest row with actuals data)
    const now = new Date()
    const currentMonth = now.toLocaleString('en-US', { month: 'long' }).toLowerCase()
    const monthAbbrev = now.toLocaleString('en-US', { month: 'short' }).toLowerCase()

    // Find the row for current month, or use the last row with data
    let targetRow: string[] | null = null
    let prevRow: string[] | null = null
    for (let i = 1; i < rows.length; i++) {
      const monthCell = (rows[i][0] || '').toLowerCase().trim()
      if (monthCell && (rows[i][2] || rows[i][3])) {
        prevRow = targetRow
        targetRow = rows[i]
      }
      if (monthCell.includes(currentMonth) || monthCell.includes(monthAbbrev) || monthCell === currentMonth.substring(0, 3)) {
        prevRow = i > 1 ? rows[i - 1] : null
        targetRow = rows[i]
        break
      }
    }

    if (targetRow) {
      const goal = (targetRow[1] || '').replace(/,/g, '')
      const cumulative = (targetRow[2] || '').replace(/,/g, '')
      const monthly = (targetRow[3] || '').replace(/,/g, '')

      if (goal) studio.goal_users = goal
      if (cumulative) studio.total_users = cumulative
      if (cumulative) studio.lifetime_signups = cumulative
      if (monthly) studio.signups_mtd = monthly

      // Calculate weekly signups from previous month's cumulative vs current
      if (prevRow && prevRow[2]) {
        const prevCumulative = parseInt((prevRow[2] || '0').replace(/,/g, ''))
        const currCumulative = parseInt(cumulative || '0')
        if (currCumulative > prevCumulative) {
          // Rough weekly = monthly / weeks elapsed in month
          const dayOfMonth = now.getDate()
          const weeksElapsed = Math.max(1, Math.ceil(dayOfMonth / 7))
          const weeklyEstimate = Math.round(parseInt(monthly || '0') / weeksElapsed)
          studio.signups_last_week = String(weeklyEstimate)
        }
      }
    }
  } catch (e) { console.error('[auto-fill] Studio Sheets error:', e) }
  return studio
}

export async function POST(req: NextRequest) {
  try {
    const db = getDb()
    const week = weekStart()
    const results: Record<string, string[]> = {}

    const googleToken = await getGoogleToken()

    // Fetch all sources in parallel
    const [hubspot, ga4, gsc, semrush, wp, studioSheet] = await Promise.allSettled([
      fetchHubSpot(),
      fetchGA4(googleToken),
      fetchGSC(googleToken),
      fetchSEMrush(),
      fetchWordPress(),
      fetchStudioSignups(googleToken),
    ])

    // MQLs
    if (hubspot.status === 'fulfilled') {
      const { mqls, leads, email } = hubspot.value
      if (Object.keys(mqls).length) { await save(db, week, 'mqls', mqls); results.mqls = Object.keys(mqls) }
      if (Object.keys(leads).length) { await save(db, week, 'leads', leads); results.leads = Object.keys(leads) }
      if (Object.keys(email).length) { await save(db, week, 'email', email); results.email = Object.keys(email) }
    }

    // SEO from GA4
    if (ga4.status === 'fulfilled') {
      const { seo, content } = ga4.value
      if (Object.keys(seo).length) { await save(db, week, 'seo', seo); results.seo_ga4 = Object.keys(seo) }
      if (Object.keys(content).length) { await save(db, week, 'content', content); results.content_ga4 = Object.keys(content) }
    }

    // SEO from GSC
    if (gsc.status === 'fulfilled' && Object.keys(gsc.value).length) {
      await save(db, week, 'seo', gsc.value)
      results.seo_gsc = Object.keys(gsc.value)
    }

    // SEMrush
    if (semrush.status === 'fulfilled' && Object.keys(semrush.value).length) {
      await save(db, week, 'seo', semrush.value)
      results.seo_semrush = Object.keys(semrush.value)
    }

    // WordPress
    if (wp.status === 'fulfilled' && Object.keys(wp.value).length) {
      await save(db, week, 'content', wp.value)
      results.content_wp = Object.keys(wp.value)
    }

    // Agent Studio Users (from Google Sheet)
    if (studioSheet.status === 'fulfilled' && Object.keys(studioSheet.value).length) {
      await save(db, week, 'studio-signups', studioSheet.value)
      results.studio_signups = Object.keys(studioSheet.value)
    }

    return NextResponse.json({ success: true, week, filled: results })
  } catch (err: any) {
    console.error('[auto-fill]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
