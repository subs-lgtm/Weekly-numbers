import { NextRequest, NextResponse } from 'next/server'
import { GoogleAuth } from 'google-auth-library'

/**
 * GET /api/ga4/presignup-journey?start=YYYY-MM-DD&end=YYYY-MM-DD   (end exclusive, like the other routes)
 *
 * What happens on the website before a visitor books a demo, for the channels that have an on-site journey
 * (Organic Search, Direct, Google Ads). GA4 only - no per-person data:
 *   - landing pages: sessions that started there and how many of them ended in a demo sign-up
 *   - pages viewed in a session ("content in the journey"): sessions that viewed the page and how many of those
 *     sessions signed up, with lift versus the channel's own baseline rate
 *
 * A "demo sign-up" is a session with either GA4 key event Sign_up_for_demo or book_demo_popup_submit. The GA4 Data
 * API only exposes these per-event session rates, so demo sessions = sessions x (rate1 + rate2), capped at the
 * session count (a session that fires both is counted twice - small, flagged "approx." in the UI).
 *
 * Service account comes from env (SA_CLIENT_EMAIL / SA_PRIVATE_KEY, same one the Firestore cache uses).
 */

const GA4_PROPERTY_ID = '415108382'
const DEMO_EVENTS = ['Sign_up_for_demo', 'book_demo_popup_submit']
// Pages that ARE the conversion (or booking confirmation) - never "content that led to a sign-up".
const CONVERSION_PAGES = /^\/(lyzr\/demo|book-demo|meetings|thank|demo)/i

const CHANNELS: { key: string; label: string; groups: string[]; hubspotChannel: string }[] = [
  { key: 'organic', label: 'Organic Search', groups: ['Organic Search'], hubspotChannel: 'Organic Search' },
  { key: 'direct', label: 'Direct', groups: ['Direct'], hubspotChannel: 'Direct' },
  { key: 'ads', label: 'Google Ads (Search + Performance Max)', groups: ['Paid Search', 'Cross-network'], hubspotChannel: 'Paid Campaigns' },
]

let tokenCache: { token: string; exp: number } | null = null
async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token
  const email = process.env.SA_CLIENT_EMAIL
  const key = (process.env.SA_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  if (!email || !key) throw new Error('SA_CLIENT_EMAIL / SA_PRIVATE_KEY not configured')
  const auth = new GoogleAuth({
    credentials: { type: 'service_account', client_email: email, private_key: key },
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  })
  const t = (await (await auth.getClient()).getAccessToken()).token
  if (!t) throw new Error('could not get GA4 token')
  tokenCache = { token: t, exp: Date.now() + 50 * 60_000 }
  return t
}

async function runReport(token: string, body: any) {
  const res = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}:runReport`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`GA4 ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

const metrics = [
  { name: 'sessions' },
  ...DEMO_EVENTS.map(e => ({ name: `sessionKeyEventRate:${e}` })),
]
const demoSessions = (sessions: number, r1: number, r2: number) => Math.min(sessions, Math.round(sessions * (r1 + r2)))

const memo = new Map<string, { at: number; data: any }>()

async function channelReport(token: string, ch: typeof CHANNELS[number], start: string, endInclusive: string) {
  const dateRanges = [{ startDate: start, endDate: endInclusive }]
  const dimensionFilter = { filter: { fieldName: 'sessionDefaultChannelGroup', inListFilter: { values: ch.groups } } }
  const [tot, landing, pages] = await Promise.all([
    runReport(token, { dateRanges, dimensionFilter, metrics: [...metrics, { name: 'screenPageViewsPerSession' }] }),
    runReport(token, { dateRanges, dimensionFilter, dimensions: [{ name: 'landingPage' }], metrics, orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 60 }),
    runReport(token, { dateRanges, dimensionFilter, dimensions: [{ name: 'pagePath' }], metrics, orderBys: [{ metric: { metricName: 'sessions' }, desc: true }], limit: 250 }),
  ])
  const tv = tot.rows?.[0]?.metricValues || []
  const sessions = Number(tv[0]?.value || 0)
  const demo = demoSessions(sessions, Number(tv[1]?.value || 0), Number(tv[2]?.value || 0))
  const baseline = sessions ? demo / sessions : 0
  const mapRows = (d: any) => (d.rows || []).map((r: any) => {
    const s = Number(r.metricValues[0].value)
    return { page: r.dimensionValues[0].value as string, sessions: s, demoSessions: demoSessions(s, Number(r.metricValues[1].value), Number(r.metricValues[2].value)) }
  })
  const landingPages = mapRows(landing)
    .filter((r: any) => r.page && r.page !== '(not set)')
    .slice(0, 12)
    .map((r: any) => ({ ...r, rate: r.sessions ? r.demoSessions / r.sessions : 0 }))
  // Content in the journey: only pages with at least 2 demo sessions, so one lucky session doesn't rank a page.
  const content = mapRows(pages)
    .filter((r: any) => r.page && r.page !== '(not set)' && !CONVERSION_PAGES.test(r.page) && r.demoSessions >= 2)
    .map((r: any) => {
      const rate = r.sessions ? r.demoSessions / r.sessions : 0
      return { ...r, rate, lift: baseline > 0 ? rate / baseline : 0 }
    })
    .sort((a: any, b: any) => b.demoSessions - a.demoSessions)
    .slice(0, 12)
  // What draws traffic in this channel's sessions, converting or not (conversion pages excluded).
  const topPages = mapRows(pages)
    .filter((r: any) => r.page && r.page !== '(not set)' && !CONVERSION_PAGES.test(r.page))
    .slice(0, 10)
    .map((r: any) => ({ ...r, rate: r.sessions ? r.demoSessions / r.sessions : 0 }))
  return {
    key: ch.key, label: ch.label, hubspotChannel: ch.hubspotChannel,
    sessions, demoSessions: demo, rate: baseline,
    pagesPerSession: Number(tv[3]?.value || 0),
    landingPages, content, topPages,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  if (!start || !end) return NextResponse.json({ error: 'start and end params required' }, { status: 400 })
  const endDate = new Date(end + 'T00:00:00Z')
  endDate.setUTCDate(endDate.getUTCDate() - 1)
  const endInclusive = endDate.toISOString().slice(0, 10)
  const cacheKey = `${start}_${endInclusive}`
  const hit = memo.get(cacheKey)
  if (hit && Date.now() - hit.at < 30 * 60_000) return NextResponse.json(hit.data)
  try {
    const token = await getToken()
    const channels = await Promise.all(CHANNELS.map(c => channelReport(token, c, start, endInclusive)))
    const data = { range: { start, end: endInclusive }, demoEvents: DEMO_EVENTS, channels }
    memo.set(cacheKey, { at: Date.now(), data })
    return NextResponse.json(data)
  } catch (err: any) {
    console.error('[ga4/presignup-journey]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
