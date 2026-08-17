'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, addWeeks, parseISO } from 'date-fns'

type GSIData = {
  total: number
  gsi: number
  accenture: number
  priority: { high: number; medium: number; low: number; unscored: number }
  demoBooked: number
  meetingBooked: number
  byOwner: Array<{ name: string; count: number }>
  byCountry: Array<{ country: string; count: number }>
  contacts: Array<{
    id: string; name: string; email: string; company: string;
    jobTitle: string; country: string; score: number; priority: string;
    owner: string; demoBooked: boolean; meetingBooked: boolean;
    formType: string; createdate: string;
  }>
  dateRange: { start: string; end: string }
}

type Props = {
  weekStart: string
  queryStart?: string
  queryEnd?: string
}

const PRIORITY_COLORS: Record<string, string> = {
  High:    '#DC2626',
  Medium:  '#D97706',
  Low:     '#2563EB',
  Unscored:'#9CA3AF',
}

const PORTAL_ID = '45094316'

export function GSILeadsCard({ weekStart, queryStart, queryEnd }: Props) {
  const [data, setData]       = useState<GSIData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const apiStart = queryStart || weekStart
  const apiEnd   = queryEnd   || format(addWeeks(parseISO(weekStart), 1), 'yyyy-MM-dd')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/hubspot/gsi-leads?start=${apiStart}&end=${apiEnd}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }, [apiStart, apiEnd])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)] flex items-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin text-[#6B4C4C]" />
        <span className="text-[13px] text-[#7A6A60]">Loading GSI & SI leads…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5">
        <p className="text-[13px] text-[#DC2626]">Failed to load GSI & SI leads: {error}</p>
        <button onClick={fetchData} className="mt-2 text-[12px] text-[#6B4C4C] hover:underline">Retry</button>
      </div>
    )
  }

  if (!data) return null

  const { total, gsi, accenture, priority, demoBooked, meetingBooked, byOwner, byCountry, contacts } = data
  const demoRate = total > 0 ? ((demoBooked / total) * 100).toFixed(0) : '0'

  return (
    <div className="rounded-[20px] border border-[#D4CBC0] bg-white shadow-[0_4px_20px_rgba(40,20,10,.07)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#D4CBC0] bg-[#F9F5F1]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(124,58,237,.10)]">
            <span className="text-[13px]">🏢</span>
          </div>
          <div>
            <p className="text-[13px] font-[600] text-[#2A1F1A]">GSI & SI Leads</p>
            <p className="text-[11px] text-[#7A6A60]">
              {apiStart} → {apiEnd} · GSI: {gsi} · Accenture: {accenture}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[#7A6A60] hover:bg-[#F2EDE8] transition-colors"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="p-5">
        {/* Top scorecards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {/* Total */}
          <div className="rounded-[12px] border border-[#D4CBC0] bg-[#F9F5F1] p-3">
            <p className="text-[10px] text-[#7A6A60] uppercase tracking-wide mb-1">Total Leads</p>
            <p className="text-[2rem] font-[700] text-[#2A1F1A] leading-none">{total}</p>
          </div>
          {/* Demo booked */}
          <div className="rounded-[12px] border border-[#D4CBC0] bg-[#F9F5F1] p-3">
            <p className="text-[10px] text-[#7A6A60] uppercase tracking-wide mb-1">Demo Booked</p>
            <p className="text-[2rem] font-[700] text-[#16A34A] leading-none">{demoBooked}</p>
            <p className="text-[10px] text-[#7A6A60] mt-0.5">{demoRate}% demo rate</p>
          </div>
          {/* Meetings */}
          <div className="rounded-[12px] border border-[#D4CBC0] bg-[#F9F5F1] p-3">
            <p className="text-[10px] text-[#7A6A60] uppercase tracking-wide mb-1">Meetings</p>
            <p className="text-[2rem] font-[700] text-[#2563EB] leading-none">{meetingBooked}</p>
          </div>
          {/* High priority */}
          <div className="rounded-[12px] border border-[#D4CBC0] bg-[#F9F5F1] p-3">
            <p className="text-[10px] text-[#7A6A60] uppercase tracking-wide mb-1">High Priority</p>
            <p className="text-[2rem] font-[700] text-[#DC2626] leading-none">{priority.high}</p>
            <p className="text-[10px] text-[#7A6A60] mt-0.5">
              {priority.medium} med · {priority.low} low
            </p>
          </div>
        </div>

        {/* Priority mini bar */}
        {total > 0 && (
          <div className="mb-5">
            <p className="text-[11px] font-[600] text-[#2A1F1A] mb-2">By Priority</p>
            <div className="flex rounded-full overflow-hidden h-3 gap-0.5">
              {(['High', 'Medium', 'Low', 'Unscored'] as const).map(p => {
                const count = priority[p.toLowerCase() as keyof typeof priority]
                const pct   = (count / total) * 100
                if (pct === 0) return null
                return (
                  <div
                    key={p}
                    title={`${p}: ${count}`}
                    style={{ width: `${pct}%`, background: PRIORITY_COLORS[p] }}
                  />
                )
              })}
            </div>
            <div className="flex gap-3 mt-1.5">
              {(['High', 'Medium', 'Low', 'Unscored'] as const).map(p => {
                const count = priority[p.toLowerCase() as keyof typeof priority]
                if (count === 0) return null
                return (
                  <span key={p} className="flex items-center gap-1 text-[10px] text-[#7A6A60]">
                    <span className="h-2 w-2 rounded-full inline-block" style={{ background: PRIORITY_COLORS[p] }} />
                    {p}: {count}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* By owner */}
        {byOwner.length > 0 && (
          <div className="mb-5">
            <p className="text-[11px] font-[600] text-[#2A1F1A] mb-2">By Owner</p>
            <div className="flex flex-wrap gap-2">
              {byOwner.map(o => (
                <span
                  key={o.name}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-[500] bg-[#F2EDE8] text-[#6B4C4C] border border-[#D4CBC0]"
                >
                  {o.name}
                  <span className="font-[700]">{o.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Expand/collapse contacts table */}
        {contacts.length > 0 && (
          <>
            <button
              onClick={() => setExpanded(e => !e)}
              className="flex items-center gap-1.5 text-[12px] font-[500] text-[#6B4C4C] hover:underline mb-3"
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {expanded ? 'Hide' : 'Show'} all {contacts.length} contacts
            </button>

            {expanded && (
              <div className="overflow-x-auto rounded-[12px] border border-[#D4CBC0]">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-[#F9F5F1] border-b border-[#D4CBC0]">
                      <th className="text-left py-2 px-3 text-[#7A6A60] font-[500]">Name</th>
                      <th className="text-left py-2 px-2 text-[#7A6A60] font-[500]">Company</th>
                      <th className="text-left py-2 px-2 text-[#7A6A60] font-[500]">Title</th>
                      <th className="text-left py-2 px-2 text-[#7A6A60] font-[500]">Country</th>
                      <th className="text-right py-2 px-2 text-[#7A6A60] font-[500]">Score</th>
                      <th className="text-center py-2 px-2 text-[#7A6A60] font-[500]">Priority</th>
                      <th className="text-left py-2 px-2 text-[#7A6A60] font-[500]">Owner</th>
                      <th className="text-center py-2 px-2 text-[#7A6A60] font-[500]">Demo</th>
                      <th className="text-center py-2 px-2 text-[#7A6A60] font-[500]">Meeting</th>
                      <th className="text-left py-2 px-2 text-[#7A6A60] font-[500]">Type</th>
                      <th className="py-2 px-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((c, i) => (
                      <tr
                        key={c.id}
                        className={cn(
                          'border-b border-[#F2EDE8] hover:bg-[#F9F5F1] transition-colors',
                          i === contacts.length - 1 && 'border-0',
                        )}
                      >
                        <td className="py-2 px-3 font-[500] text-[#2A1F1A] max-w-[130px] truncate">{c.name}</td>
                        <td className="py-2 px-2 text-[#7A6A60] max-w-[120px] truncate">{c.company}</td>
                        <td className="py-2 px-2 text-[#7A6A60] max-w-[120px] truncate">{c.jobTitle}</td>
                        <td className="py-2 px-2 text-[#7A6A60]">{c.country}</td>
                        <td className="py-2 px-2 text-right font-[600] text-[#2A1F1A]">{c.score || '—'}</td>
                        <td className="py-2 px-2 text-center">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-[500]"
                            style={{
                              background: PRIORITY_COLORS[c.priority] + '18',
                              color: PRIORITY_COLORS[c.priority],
                            }}
                          >
                            {c.priority}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-[#7A6A60]">{c.owner}</td>
                        <td className="py-2 px-2 text-center">
                          {c.demoBooked ? (
                            <span className="text-[#16A34A] font-[700]">✓</span>
                          ) : (
                            <span className="text-[#D4CBC0]">—</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {c.meetingBooked ? (
                            <span className="text-[#2563EB] font-[700]">✓</span>
                          ) : (
                            <span className="text-[#D4CBC0]">—</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-[#7A6A60] max-w-[80px] truncate">{c.formType}</td>
                        <td className="py-2 px-2">
                          <a
                            href={`https://app.hubspot.com/contacts/${PORTAL_ID}/contact/${c.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#7A6A60] hover:text-[#6B4C4C]"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {total === 0 && (
          <p className="text-[12px] text-[#7A6A60] text-center py-4">
            No GSI & SI leads found for this date range.
          </p>
        )}
      </div>
    </div>
  )
}
