'use client'

import { useEffect, useState } from 'react'

type CampaignSummary = {
  name: string
  sent: number
  newLeadsContacted: number
  openUnique: number
  clickUnique: number
  bounced: number
  openRate: number
  clickRate: number
  bounceRate: number
}

type WeekPoint = {
  weekStart: string
  weekEnd: string
  label: string
  sent: number
  opens: number
  clicks: number
  replies: number
  isCurrent: boolean
}

type Totals = {
  sent: number; newLeadsContacted: number; openUnique: number; clickUnique: number; bounced: number
  openRate: number; clickRate: number; bounceRate: number
}

type SpotlightData = {
  campaigns: CampaignSummary[]
  totals: Totals | null
  weeklyTrend: WeekPoint[]
  currentWeek: WeekPoint | null
}

// Shortens "Spotlight_PE_Buyer_Sep2026" -> "PE Buyer" for compact card headers.
function shortName(name: string): string {
  return name.replace(/^Spotlight_/, '').replace(/_Sep\d{4}$/, '').replace(/_/g, ' ')
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[15px] border border-border bg-card px-[19px] py-[18px] shadow-[var(--shadow-resting)]">
      <div className="mb-[9px] text-[10.5px] font-[600] uppercase tracking-[.08em] text-muted-foreground">{label}</div>
      <div className="font-[family-name:var(--font-playfair)] text-[26px] font-[500] leading-none text-foreground">{value}</div>
    </div>
  )
}

export function SpotlightCvcDashboard() {
  const [data, setData] = useState<SpotlightData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch('/api/instantly/spotlight-cvc?weeks=4')
      .then(r => r.json().then(body => ({ ok: r.ok, body })))
      .then(({ ok, body }) => {
        if (cancelled) return
        if (!ok) throw new Error(body.error || 'Failed to load Spotlight CVC data')
        setData(body)
      })
      .catch(e => { if (!cancelled) setError(e.message || 'Failed to load Spotlight CVC data') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="card flex h-40 items-center justify-center text-[12.5px] text-muted-foreground">
        Loading live Instantly data…
      </div>
    )
  }

  if (error) {
    return (
      <div className="card flex h-40 flex-col items-center justify-center gap-2 text-center">
        <p className="text-[12.5px] font-[600] text-destructive">Couldn&apos;t load Spotlight CVC data</p>
        <p className="text-[11.5px] text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (!data || data.campaigns.length === 0) {
    return (
      <div className="card flex h-32 items-center justify-center text-[12.5px] text-muted-foreground">
        No active "Spotlight_" campaigns found in Instantly right now.
      </div>
    )
  }

  const { campaigns, totals, weeklyTrend, currentWeek } = data
  const maxSent = Math.max(1, ...weeklyTrend.map(w => w.sent))

  return (
    <div className="space-y-4">
      {/* Current week headline — mirrors the reference report's "Current Week Performance" */}
      {currentWeek && (
        <div>
          <p className="section-label first">Current Week ({currentWeek.label})</p>
          <div className="row-4">
            <StatCard label="Emails Sent" value={currentWeek.sent.toLocaleString()} />
            <StatCard label="Opens" value={currentWeek.opens.toLocaleString()} />
            <StatCard label="Clicks" value={currentWeek.clicks.toLocaleString()} />
            <StatCard label="Replies" value={currentWeek.replies.toLocaleString()} />
          </div>
        </div>
      )}

      {/* 4-week trend */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Weekly Trend</span>
          <span className="card-note">Live from Instantly · updates every 5 min</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Week</th>
                <th>Sent</th>
                <th>Opens</th>
                <th>Clicks</th>
                <th>Replies</th>
              </tr>
            </thead>
            <tbody>
              {weeklyTrend.map(w => (
                <tr key={w.weekStart}>
                  <td className="tname">{w.label}{w.isCurrent && <span className="tsub"> (in progress)</span>}</td>
                  <td>{w.sent.toLocaleString()}</td>
                  <td>{w.opens.toLocaleString()}</td>
                  <td>{w.clicks.toLocaleString()}</td>
                  <td>{w.replies.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bar-chart mt">
          {weeklyTrend.map(w => (
            <div className="bar-col" key={w.weekStart}>
              <div className="bar-val">{w.sent}</div>
              <div className="bar" style={{ height: `${Math.max(4, (w.sent / maxSent) * 100)}%`, opacity: w.isCurrent ? 0.6 : 1 }} />
              <div className="bar-lbl">{w.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-campaign summary — lifetime since launch, rates over leads contacted */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Campaign Performance (Lifetime)</span>
          <span className="card-note">Rates computed over leads contacted, not emails sent</span>
        </div>
        <div className="chan-grid" style={{ gridTemplateColumns: `repeat(${campaigns.length}, 1fr)` }}>
          {campaigns.map(c => (
            <div className="chan-card" key={c.name}>
              <div className="chan-top">
                <span className="chan-name">{shortName(c.name)}</span>
              </div>
              <div className="chan-val">{c.sent.toLocaleString()} <span className="text-[11px] font-normal text-muted-foreground">sent</span></div>
              <div className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                <div className="flex justify-between"><span>Leads contacted</span><span className="font-[600] text-foreground">{c.newLeadsContacted.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Open rate</span><span className="font-[600] text-foreground">{c.openRate}%</span></div>
                <div className="flex justify-between"><span>Click rate</span><span className="font-[600] text-foreground">{c.clickRate}%</span></div>
                <div className="flex justify-between"><span>Bounce rate</span><span className="font-[600] text-foreground">{c.bounceRate}%</span></div>
              </div>
            </div>
          ))}
        </div>
        {totals && (
          <div className="mt-3 border-t border-border pt-3 text-[11.5px] text-muted-foreground">
            Across all {campaigns.length} campaigns: {totals.sent.toLocaleString()} emails sent, {totals.openRate}% open rate,
            {' '}{totals.clickRate}% click rate, {totals.bounceRate}% bounce rate.
          </div>
        )}
      </div>
    </div>
  )
}
