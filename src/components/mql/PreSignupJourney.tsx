'use client'

import { useEffect, useState } from 'react'

type PageRow = { page: string; sessions: number; demoSessions: number; rate: number; lift?: number }
type ChannelJourney = {
  key: string; label: string; hubspotChannel: string
  sessions: number; demoSessions: number; rate: number; pagesPerSession: number
  landingPages: PageRow[]; content: PageRow[]; topPages: PageRow[]
}
type Journey = { range: { start: string; end: string }; channels: ChannelJourney[] }

const pct = (r: number) => `${(r * 100).toFixed(r >= 0.1 ? 0 : 1)}%`

function PageTable({ rows, showLift }: { rows: PageRow[]; showLift?: boolean }) {
  if (rows.length === 0) return <p className="text-[12px] text-[#7A6A60] py-2">Not enough demo sign-ups in this period to rank pages.</p>
  return (
    <table className="w-full text-[12.5px] border-collapse">
      <thead>
        <tr className="text-left text-[10.5px] uppercase tracking-[.05em] text-[#7A6A60] border-b border-[#D4CBC0]">
          <th className="py-1.5 pr-2 font-[600]">Page</th>
          <th className="py-1.5 pr-2 font-[600] text-right">Sessions</th>
          <th className="py-1.5 pr-2 font-[600] text-right">Demo sign-ups</th>
          <th className="py-1.5 pr-2 font-[600] text-right">Rate</th>
          {showLift && <th className="py-1.5 font-[600] text-right">vs channel avg</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.page} className="border-b border-[#EEE7DC] last:border-0">
            <td className="py-1.5 pr-2 font-[600] text-[#2A1F1A] break-all">{r.page}</td>
            <td className="py-1.5 pr-2 text-right">{r.sessions.toLocaleString()}</td>
            <td className="py-1.5 pr-2 text-right font-[600]">{r.demoSessions || <span className="text-[#B9AFA6]">0</span>}</td>
            <td className="py-1.5 pr-2 text-right">{pct(r.rate)}</td>
            {showLift && (
              <td className={`py-1.5 text-right font-[600] ${(r.lift || 0) >= 1.5 ? 'text-[#2F7A4F]' : (r.lift || 0) < 0.7 ? 'text-[#BE4A3C]' : 'text-[#2A1F1A]'}`}>
                {r.lift ? `${r.lift >= 10 ? Math.round(r.lift) : r.lift.toFixed(1)}x` : '—'}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function PreSignupJourney({ start, end, hubspotByChannel }: { start: string; end: string; hubspotByChannel?: Record<string, number> }) {
  const [data, setData] = useState<Journey | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('organic')

  useEffect(() => {
    let cancelled = false
    setLoading(true); setError('')
    fetch(`/api/ga4/presignup-journey?start=${start}&end=${end}`)
      .then(r => r.json())
      .then(d => { if (cancelled) return; if (d.error) setError(d.error); else setData(d) })
      .catch(e => { if (!cancelled) setError(String(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [start, end])

  const ch = data?.channels.find(c => c.key === tab)
  const hubspot = (c: ChannelJourney) => {
    const raw = hubspotByChannel || {}
    return c.hubspotChannel === 'Organic Search' ? (raw['Organic Search'] || 0) + (raw['Content / Organic'] || 0) : (raw[c.hubspotChannel] || 0)
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Pre-Signup Website Journey</span>
        <span className="text-[11px] text-[#7A6A60]">GA4 · {start} → {data?.range.end || end}</span>
      </div>
      <p className="card-note mb-3">
        What visitors do on lyzr.ai before booking a demo, for the channels with an on-site journey (LinkedIn leads can&apos;t be tracked here).
        A demo sign-up = a GA4 session that fired <em>Sign_up_for_demo</em> or <em>book_demo_popup_submit</em> (approximate when a session fires both).
      </p>

      {loading ? <p className="text-[13px] text-[#7A6A60]">Loading GA4…</p>
        : error ? <p className="text-[13px] text-[#BE4A3C]">Could not load GA4 data: {error}</p>
        : !data ? null : (
          <>
            <div className="flex flex-wrap gap-2 mb-4">
              {data.channels.map(c => (
                <button key={c.key} onClick={() => setTab(c.key)}
                  className={`px-3 py-1.5 rounded-full text-[12px] font-[600] border transition-all ${tab === c.key ? 'bg-[#2A1F1A] text-white border-[#2A1F1A]' : 'text-[#7A6A60] border-[#D4CBC0] hover:text-[#2A1F1A]'}`}>
                  {c.label}
                </button>
              ))}
            </div>

            {ch && (() => {
              const hs = hubspot(ch)
              const coverage = hs > 0 ? Math.round((ch.demoSessions / hs) * 100) : null
              return (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    <div className="rounded-[12px] border border-[#EEE7DC] p-3"><p className="text-[10.5px] uppercase tracking-[.05em] text-[#7A6A60]">Sessions</p><p className="text-[22px] font-[700] text-[#2A1F1A]">{ch.sessions.toLocaleString()}</p></div>
                    <div className="rounded-[12px] border border-[#EEE7DC] p-3"><p className="text-[10.5px] uppercase tracking-[.05em] text-[#7A6A60]">Demo sign-ups (GA4)</p><p className="text-[22px] font-[700] text-[#2A1F1A]">{ch.demoSessions}</p></div>
                    <div className="rounded-[12px] border border-[#EEE7DC] p-3"><p className="text-[10.5px] uppercase tracking-[.05em] text-[#7A6A60]">Session → demo</p><p className="text-[22px] font-[700] text-[#2A1F1A]">{pct(ch.rate)}</p></div>
                    <div className="rounded-[12px] border border-[#EEE7DC] p-3"><p className="text-[10.5px] uppercase tracking-[.05em] text-[#7A6A60]">Pages / session</p><p className="text-[22px] font-[700] text-[#2A1F1A]">{ch.pagesPerSession.toFixed(1)}</p></div>
                  </div>

                  {coverage !== null && (
                    <p className={`text-[12px] mb-4 rounded-[10px] px-3 py-2 ${coverage < 70 || coverage > 130 ? 'bg-[#FBF1E4] text-[#8A5A14]' : 'bg-[#EAF4EE] text-[#2F6A45]'}`}>
                      <strong>Tracking coverage:</strong> GA4 recorded {ch.demoSessions} demo sign-ups for this channel, but HubSpot has {hs} MQLs from it in the selected period ({coverage}%).
                      {coverage < 70 && ' GA4 is missing a large share of sign-ups (the demo form / booking step is likely not firing the GA4 event for every visitor), so treat the rates below as a lower bound and use them to compare pages, not as absolute conversion rates.'}
                      {coverage > 130 && ' GA4 counts more than HubSpot because its sign-up events also fire on repeat submissions and on visitors HubSpot does not turn into a new MQL, so the two are not one-to-one.'}
                    </p>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div>
                      <p className="text-[11px] uppercase tracking-[.05em] text-[#7A6A60] font-[600] mb-1">Where sessions land</p>
                      <PageTable rows={ch.landingPages} />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-[.05em] text-[#7A6A60] font-[600] mb-1">Content seen in sessions that signed up (double-down candidates)</p>
                      <PageTable rows={ch.content} showLift />
                    </div>
                  </div>
                  <div className="mt-5">
                    <p className="text-[11px] uppercase tracking-[.05em] text-[#7A6A60] font-[600] mb-1">Most-viewed pages in this channel&apos;s sessions</p>
                    <PageTable rows={ch.topPages} />
                  </div>
                </>
              )
            })()}
          </>
        )}
    </div>
  )
}
