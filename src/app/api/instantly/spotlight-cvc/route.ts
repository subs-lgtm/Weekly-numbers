import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/instantly/spotlight-cvc
 *
 * Live version of what was a manually-compiled Instantly report (a claude.ai artifact shared
 * 2026-09-21) for the 3 "Spotlight" outreach campaigns. Methodology below was reverse-engineered
 * by matching every number in that report against this same live API, campaign by campaign —
 * not guessed. Do not change the rate denominator or the campaign filter without re-verifying
 * against a fresh Instantly export, the same way this was built.
 *
 * Campaign filter: status === 1 (active) AND name starts with "Spotlight_" — deliberately NOT a
 * loose "contains 'spotlight'" match. This portal has 8 campaigns with "spotlight" in the name;
 * most are old/unrelated ("CVC_Spotlight_3rd batch", "Managers + VP's Spotlight", "Spotlight_CVC"
 * [status 3, a discontinued earlier iteration], "Pramod - New Spotlight - 770", "Spotlight - IR
 * Survey"). Only 3 match "Spotlight_" + active: Spotlight_CorpDev_Sep2026, Spotlight_PE_Buyer_
 * Sep2026, Spotlight_PE_Champion_Sep2026 — exactly the 3 in the reference report. The "_Sep2026"
 * suffix is NOT part of the filter (so this doesn't silently go empty next month) — only the
 * "Spotlight_" prefix + active status is checked.
 *
 * Rate methodology (verified exactly against the reference report's own numbers for all 3
 * campaigns): openRate / clickRate / bounceRate are each computed over `new_leads_contacted_count`
 * (lifetime) or `new_leads_contacted` (daily) — NOT over emails sent. This matches the report's
 * own footnote ("rates use Instantly's denominator, leads contacted"). Confirmed e.g. PE Buyer:
 * open_count_unique=58, new_leads_contacted_count=91 -> 58/91=63.7%, matching the report exactly;
 * 58/emails_sent_count(180)=32.2% does NOT match — don't "fix" this back to a sent-based rate.
 *
 * The existing /api/instantly/campaigns route batches multiple `id=` params into one
 * /campaigns/analytics call — confirmed via direct testing that Instantly's API rejects that
 * (400 "querystring/id must be string"), so that route's lifetime-mode category totals are
 * silently zero whenever `instantlyGet` swallows the failure. Not fixed here (separate route,
 * out of scope) — but this route deliberately fetches lifetime analytics ONE campaign at a time
 * to avoid the same bug.
 *
 * Query params: ?weeks=4 (trailing weeks, Monday-Sunday, default 4) &end=YYYY-MM-DD (anchor,
 * defaults to today — the anchor week is partial, Monday through the anchor date).
 */

const INSTANTLY_API_KEY = 'NDMyMDI3MWUtNDQ4OS00OTBhLWFlMTEtYjcwY2EwMjNlMmE0OkVZUlNzVHZya3BYTg=='
const BASE = 'https://api.instantly.ai/api/v2'

export const maxDuration = 60

async function instantlyGet<T>(path: string): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${INSTANTLY_API_KEY}` },
    next: { revalidate: 300 },
  })
  if (!res.ok) return null
  return res.json()
}

interface Campaign { id: string; name: string; status: number }

async function fetchSpotlightCampaigns(): Promise<Campaign[]> {
  const all: Campaign[] = []
  let cursor: string | null = null
  do {
    const qs: string = cursor ? `?limit=100&starting_after=${cursor}` : '?limit=100'
    const data: { items: Campaign[]; next_starting_after?: string } | null = await instantlyGet<{ items: Campaign[]; next_starting_after?: string }>(`/campaigns${qs}`)
    if (!data) break
    all.push(...(data.items || []))
    cursor = data.next_starting_after || null
  } while (cursor)
  return all.filter(c => c.status === 1 && c.name.startsWith('Spotlight_'))
}

function pct(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 1000) / 10 : 0
}

// Monday-Sunday weeks, same convention as week-context.tsx — local calendar date, no UTC forcing.
function mondayOf(d: Date): Date {
  const day = d.getDay() // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day
  const m = new Date(d)
  m.setDate(d.getDate() + diff)
  m.setHours(0, 0, 0, 0)
  return m
}
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const weeks = Math.min(Math.max(parseInt(searchParams.get('weeks') || '4', 10), 1), 12)
    const endParam = searchParams.get('end')
    const anchor = endParam ? new Date(endParam + 'T00:00:00') : new Date()

    const campaigns = await fetchSpotlightCampaigns()
    if (campaigns.length === 0) {
      return NextResponse.json({ campaigns: [], totals: null, weeklyTrend: [], currentWeek: null })
    }

    // --- Lifetime per-campaign summary (one call per campaign — see header note on batching) ---
    const campaignSummaries = await Promise.all(campaigns.map(async (c) => {
      const data = await instantlyGet<any[]>(`/campaigns/analytics?id=${c.id}`)
      const item = data?.[0]
      if (!item) return null
      const sent = item.emails_sent_count || 0
      const newLeadsContacted = item.new_leads_contacted_count || 0
      const openUnique = item.open_count_unique || 0
      const clickUnique = item.link_click_count_unique || 0
      const bounced = item.bounced_count || 0
      return {
        name: c.name,
        sent,
        newLeadsContacted,
        openUnique,
        clickUnique,
        bounced,
        openRate: pct(openUnique, newLeadsContacted),
        clickRate: pct(clickUnique, newLeadsContacted),
        bounceRate: pct(bounced, newLeadsContacted),
      }
    }))
    const validSummaries = campaignSummaries.filter((s): s is NonNullable<typeof s> => s !== null)

    const totals = validSummaries.reduce((acc, s) => ({
      sent: acc.sent + s.sent,
      newLeadsContacted: acc.newLeadsContacted + s.newLeadsContacted,
      openUnique: acc.openUnique + s.openUnique,
      clickUnique: acc.clickUnique + s.clickUnique,
      bounced: acc.bounced + s.bounced,
    }), { sent: 0, newLeadsContacted: 0, openUnique: 0, clickUnique: 0, bounced: 0 })

    // --- Weekly trend (Monday-Sunday, trailing `weeks`, anchor week partial through today) ---
    const anchorMonday = mondayOf(anchor)
    const weekStarts: Date[] = []
    for (let i = weeks - 1; i >= 0; i--) weekStarts.push(addDays(anchorMonday, -7 * i))

    const weeklyTrend = await Promise.all(weekStarts.map(async (weekStart) => {
      const weekEnd = addDays(weekStart, 6)
      const isAnchorWeek = weekStart.getTime() === anchorMonday.getTime()
      const rangeEnd = isAnchorWeek && weekEnd > anchor ? anchor : weekEnd

      let sent = 0, opens = 0, clicks = 0, replies = 0
      for (const c of campaigns) {
        const daily = await instantlyGet<any[]>(
          `/campaigns/analytics/daily?campaign_id=${c.id}&start_date=${toDateStr(weekStart)}&end_date=${toDateStr(rangeEnd)}`
        )
        for (const day of daily || []) {
          sent += day.sent || 0
          opens += day.unique_opened || 0
          clicks += day.unique_clicks || 0
          replies += day.unique_replies || 0
        }
      }
      return {
        weekStart: toDateStr(weekStart),
        weekEnd: toDateStr(rangeEnd),
        label: `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${rangeEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        sent, opens, clicks, replies,
        isCurrent: isAnchorWeek,
      }
    }))

    return NextResponse.json({
      campaigns: validSummaries,
      totals: {
        ...totals,
        openRate: pct(totals.openUnique, totals.newLeadsContacted),
        clickRate: pct(totals.clickUnique, totals.newLeadsContacted),
        bounceRate: pct(totals.bounced, totals.newLeadsContacted),
      },
      weeklyTrend,
      currentWeek: weeklyTrend[weeklyTrend.length - 1] || null,
    })
  } catch (err: any) {
    console.error('[instantly/spotlight-cvc] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
