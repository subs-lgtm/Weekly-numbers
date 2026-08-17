'use client'

import { useEffect, useState } from 'react'

type DealDetail = { name: string; amount: number; stage: string }
type WeekBucket = { weekStart: string; label: string; pipelineGenerated: number; dealCount: number; closedWonAmount: number; closedWonCount: number; deals: DealDetail[] }

type Props = { queryEnd: string }

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

const STAGE_BADGE_CLASS: Record<string, string> = {
  'Closed Won': 'bg-green-50 text-green-700 border border-green-200',
  'Closed Lost': 'bg-red-50 text-red-600 border border-red-200',
  Dropped: 'bg-red-50 text-red-500 border border-red-200',
  Proposal: 'bg-amber-50 text-amber-700 border border-amber-200',
  Negotiation: 'bg-blue-50 text-blue-700 border border-blue-200',
}

function DealsTooltip({ week, align }: { week: WeekBucket; align: 'left' | 'center' | 'right' }) {
  const alignCls =
    align === 'left' ? 'left-0' :
    align === 'right' ? 'right-0' :
    'left-1/2 -translate-x-1/2'
  const arrowAlignCls =
    align === 'left' ? 'left-6' :
    align === 'right' ? 'right-6' :
    'left-1/2 -translate-x-1/2'

  return (
    <div className={`absolute bottom-full ${alignCls} mb-2 z-30 w-[320px] rounded-[14px] border border-[#D4CBC0] bg-white shadow-[0_8px_32px_rgba(40,20,10,.16)] p-3`}>
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-[11px] font-[700] text-[#2A1F1A]">{week.label} — {week.dealCount} deal{week.dealCount !== 1 ? 's' : ''}</p>
        <p className="text-[11px] font-[700] text-[#6B4C4C]">{formatCurrency(week.pipelineGenerated)}</p>
      </div>
      {week.deals.length === 0 ? (
        <p className="text-[11px] text-[#7A6A60] px-1 pb-1">No deals created this week.</p>
      ) : (
        <div className="max-h-[220px] overflow-y-auto">
          <table className="w-full text-[10.5px]">
            <thead>
              <tr className="border-b border-[#F2EDE8] sticky top-0 bg-white">
                <th className="text-left py-1 px-1 text-[#7A6A60] font-[500]">Deal</th>
                <th className="text-right py-1 px-1 text-[#7A6A60] font-[500]">Amount</th>
                <th className="text-left py-1 px-1 text-[#7A6A60] font-[500]">Stage</th>
              </tr>
            </thead>
            <tbody>
              {week.deals.map((d, i) => (
                <tr key={i} className="border-b border-[#F9F5F1] last:border-0">
                  <td className="py-1 px-1 text-[#2A1F1A] font-[500] max-w-[130px] truncate">{d.name}</td>
                  <td className="py-1 px-1 text-right text-[#2A1F1A] font-[600] whitespace-nowrap">
                    {d.amount > 0 ? formatCurrency(d.amount) : '—'}
                  </td>
                  <td className="py-1 px-1">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] ${STAGE_BADGE_CLASS[d.stage] || 'bg-gray-100 text-gray-600'}`}>
                      {d.stage}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* arrow */}
      <div className={`absolute top-full ${arrowAlignCls} w-0 h-0 border-l-[7px] border-l-transparent border-r-[7px] border-r-transparent border-t-[7px] border-t-white`} />
    </div>
  )
}

/** Matches reference HTML's "Pipeline Generated Trend" section — .card/.bar-chart, single series. */
export function PipelineTrendChart({ queryEnd }: Props) {
  const [weeks, setWeeks] = useState<WeekBucket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hoveredWeek, setHoveredWeek] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/hubspot/pipeline-trend?mode=weekly&end=${queryEnd}&weeks=8`)
      .then(r => r.json())
      .then(json => { if (!cancelled) { if (json.error) throw new Error(json.error); setWeeks(json.weeks || []) } })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [queryEnd])

  const maxVal = Math.max(...weeks.map(w => w.pipelineGenerated), 1)

  return (
    <div className="card mt">
      <div className="card-head">
        <span className="card-title">Pipeline Generated Trend</span>
        <span className="card-note">Weekly pipeline, last 8 weeks — hover a bar for deal details</span>
      </div>
      {loading ? (
        <p className="text-[13px] text-[#7A6A60]">Loading from HubSpot…</p>
      ) : error ? (
        <p className="text-[13px] text-[#DC2626]">Failed to load pipeline trend: {error}</p>
      ) : (
        <div className="bar-chart">
          {weeks.map((w, i) => {
            const heightPct = Math.max((w.pipelineGenerated / maxVal) * 100, w.pipelineGenerated > 0 ? 3 : 0)
            const align: 'left' | 'center' | 'right' = i <= 1 ? 'left' : i >= weeks.length - 2 ? 'right' : 'center'
            return (
              <div
                className="bar-col"
                key={w.weekStart}
                style={{ position: 'relative' }}
                onMouseEnter={() => setHoveredWeek(w.weekStart)}
                onMouseLeave={() => setHoveredWeek(null)}
              >
                {hoveredWeek === w.weekStart && <DealsTooltip week={w} align={align} />}
                <div className="bar-val">{formatCurrency(w.pipelineGenerated)}</div>
                <div className="bar" style={{ height: `${heightPct}%`, cursor: 'pointer' }} />
                <div className="bar-lbl">{w.label}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
