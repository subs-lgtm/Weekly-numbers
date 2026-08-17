'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, TrendingUp, DollarSign, Target, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, LabelList, Legend,
} from 'recharts'

type DealData = {
  totalDeals: number
  openPipeline: number
  closedWon: number
  closedLost: number
  totalACV: number
  q3: {
    goal: number
    data: Array<{ month: string; label: string; added: number; cumulative: number; open: number; won: number; deals: number }>
    cumulative: number
  }
  monthlyTrend: Array<{ month: string; label: string; open: number; won: number; total: number; cumulative: number; deals: number }>
  topDeals: Array<{ name: string; amount: number; stage: string; closeDate: string; created: string; company: string; source: string }>
  byStage: Array<{ stage: string; count: number; amount: number }>
  bySourceValue: Array<{
    source: string; open: number; won: number; total: number; count: number
    deals: Array<{ name: string; amount: number; stage: string; company: string; closeDate: string }>
  }>
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

// Default to current calendar quarter boundaries
function currentQuarterBounds(): { from: string; to: string; label: string } {
  const now = new Date()
  const year = now.getFullYear()
  const q = Math.floor(now.getMonth() / 3)
  const qStart = new Date(Date.UTC(year, q * 3, 1))
  const qEnd   = new Date(Date.UTC(year, q * 3 + 3, 0)) // last day of last month in quarter
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  return {
    from: fmt(qStart),
    to:   fmt(qEnd),
    label: `Q${q + 1} ${year}`,
  }
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[10px] border border-[#D4CBC0] bg-white px-3 py-2 shadow-lg text-[12px]">
      <p className="font-[600] text-[#2A1F1A] mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

const SOURCE_COLORS: Record<string, string> = {
  'Google Ads': '#EA4335', 'Paid Campaigns': '#EA4335',
  'LinkedIn': '#0A66C2',
  'Organic Search': '#16A34A', 'ORGANIC_SEARCH': '#16A34A',
  'Email / Outbound': '#D97706', 'Email': '#D97706',
  'Referral': '#6366F1', 'REFERRALS': '#6366F1',
  'Partner': '#8B5CF6',
  'Direct': '#6B7280', 'DIRECT_TRAFFIC': '#6B7280',
  'Social': '#EC4899', 'SOCIAL_MEDIA': '#EC4899',
}

function sourceDot(source: string) {
  const color = SOURCE_COLORS[source] || '#9CA3AF'
  return <span className="inline-block h-2 w-2 rounded-full flex-shrink-0 mr-1.5" style={{ background: color }} />
}

export function OpportunityACVChart() {
  const defaultQ = currentQuarterBounds()
  const [filterFrom, setFilterFrom] = useState(defaultQ.from)
  const [filterTo,   setFilterTo]   = useState(defaultQ.to)
  const [filterLabel, setFilterLabel] = useState(defaultQ.label)
  const [showFilter, setShowFilter] = useState(false)
  const [data, setData] = useState<DealData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSource, setExpandedSource] = useState<string | null>(null)

  const fetchData = useCallback(async (from: string, to: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/hubspot/deals-acv?from=${from}&to=${to}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchData(filterFrom, filterTo) }, [fetchData, filterFrom, filterTo])

  const applyFilter = () => {
    setFilterLabel(`${filterFrom} → ${filterTo}`)
    setShowFilter(false)
    fetchData(filterFrom, filterTo)
  }

  const resetToQuarter = () => {
    const q = currentQuarterBounds()
    setFilterFrom(q.from)
    setFilterTo(q.to)
    setFilterLabel(q.label)
    setShowFilter(false)
    fetchData(q.from, q.to)
  }

  if (loading) {
    return (
      <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-8 flex items-center justify-center gap-2">
        <RefreshCw className="h-4 w-4 animate-spin text-[#6B4C4C]" />
        <span className="text-[13px] text-[#7A6A60]">Loading pipeline data...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-8 text-center">
        <p className="text-[13px] text-[#DC2626]">Failed: {error}</p>
        <button onClick={() => fetchData(filterFrom, filterTo)} className="mt-2 text-[12px] text-[#6B4C4C] hover:underline">Retry</button>
      </div>
    )
  }

  if (!data) return null

  const q3Goal = data.q3.goal
  const q3Progress = ((data.q3.cumulative / q3Goal) * 100).toFixed(1)
  const monthlyGoal = q3Goal / 3

  const chartData = data.monthlyTrend.map(m => ({
    name: m.label,
    'Open Pipeline': m.open,
    'Closed Won': m.won,
    total: m.total,
  }))

  return (
    <div className="rounded-[20px] border border-[#D4CBC0] bg-white shadow-[0_4px_20px_rgba(40,20,10,.07)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#D4CBC0] bg-[#F9F5F1]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(107,76,76,.10)]">
            <TrendingUp className="h-3.5 w-3.5 text-[#6B4C4C]" />
          </div>
          <div>
            <p className="text-[13px] font-[600] text-[#2A1F1A]">Opportunity ACV Pipeline</p>
            <p className="text-[11px] text-[#7A6A60]">
              Studio Deals · Q3 Goal: {formatCurrency(q3Goal)} · {data.totalDeals} deals · {filterLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Date range filter */}
          <div className="relative">
            <button
              onClick={() => setShowFilter(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#D4CBC0] text-[11px] text-[#6B4C4C] hover:bg-[#F2EDE8] transition-colors"
            >
              <Filter className="h-3 w-3" />
              {filterLabel}
            </button>
            {showFilter && (
              <div className="absolute right-0 top-8 z-20 w-[260px] rounded-[12px] border border-[#D4CBC0] bg-white shadow-xl p-4">
                <p className="text-[12px] font-[600] text-[#2A1F1A] mb-3">Date Range (Close Date)</p>
                <div className="space-y-2 mb-3">
                  <div>
                    <label className="text-[10px] text-[#7A6A60] uppercase tracking-wide">From</label>
                    <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                      className="w-full mt-0.5 rounded-[8px] border border-[#D4CBC0] px-2 py-1.5 text-[12px] text-[#2A1F1A] outline-none focus:border-[#6B4C4C]" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#7A6A60] uppercase tracking-wide">To</label>
                    <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                      className="w-full mt-0.5 rounded-[8px] border border-[#D4CBC0] px-2 py-1.5 text-[12px] text-[#2A1F1A] outline-none focus:border-[#6B4C4C]" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={applyFilter}
                    className="flex-1 rounded-full bg-[#6B4C4C] text-white text-[11px] py-1.5 font-[600] hover:opacity-90">
                    Apply
                  </button>
                  <button onClick={resetToQuarter}
                    className="flex-1 rounded-full border border-[#D4CBC0] text-[#6B4C4C] text-[11px] py-1.5 font-[500] hover:bg-[#F2EDE8]">
                    This Quarter
                  </button>
                </div>
              </div>
            )}
          </div>
          <button onClick={() => fetchData(filterFrom, filterTo)} disabled={loading}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[#7A6A60] hover:bg-[#F2EDE8] transition-colors disabled:opacity-40">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="p-5">
        {/* Scorecards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="rounded-[12px] border border-[#D4CBC0] bg-[#F9F5F1] p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="h-3 w-3 text-[#16A34A]" />
              <span className="text-[10px] text-[#7A6A60] uppercase tracking-wide">Closed Won</span>
            </div>
            <p className="text-[20px] font-[700] text-[#16A34A]">{formatCurrency(data.closedWon)}</p>
          </div>
          <div className="rounded-[12px] border border-[#D4CBC0] bg-[#F9F5F1] p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="h-3 w-3 text-[#2563EB]" />
              <span className="text-[10px] text-[#7A6A60] uppercase tracking-wide">Open Pipeline</span>
            </div>
            <p className="text-[20px] font-[700] text-[#2563EB]">{formatCurrency(data.openPipeline)}</p>
          </div>
          <div className="rounded-[12px] border border-[#D4CBC0] bg-[#F9F5F1] p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3 w-3 text-[#6B4C4C]" />
              <span className="text-[10px] text-[#7A6A60] uppercase tracking-wide">Total ACV</span>
            </div>
            <p className="text-[20px] font-[700] text-[#2A1F1A]">{formatCurrency(data.totalACV)}</p>
          </div>
          <div className="rounded-[14px] border-2 border-[#D97706] p-4 col-span-2 md:col-span-1"
            style={{ background: 'linear-gradient(135deg, #FEF3C7 0%, #FDE68A 40%, #FFF7ED 100%)', boxShadow: '0 4px 20px rgba(217,119,6,.18)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5 text-[#D97706]" />
                <span className="text-[10px] font-[700] text-[#92400E] uppercase tracking-wider">Q3 Progress</span>
              </div>
              <span className="text-[11px] font-[700] text-[#D97706] bg-white/70 rounded-full px-2 py-0.5">{q3Progress}%</span>
            </div>
            <div className="flex items-baseline gap-1 mb-2.5">
              <span className="text-[22px] font-[800] text-[#92400E]">{formatCurrency(data.q3.cumulative)}</span>
              <span className="text-[14px] font-[500] text-[#B45309]">/</span>
              <span className="text-[16px] font-[700] text-[#B45309]">{formatCurrency(q3Goal)}</span>
            </div>
            {/* Progress bar */}
            <div className="h-2 rounded-full bg-white/60 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${Math.min(parseFloat(q3Progress), 100)}%`, background: 'linear-gradient(90deg, #D97706, #F59E0B)' }}
              />
            </div>
            <p className="text-[10px] text-[#92400E] mt-1.5 font-[500]">{(100 - parseFloat(q3Progress)).toFixed(1)}% remaining to goal</p>
          </div>
        </div>

        {/* Monthly ACV bar chart */}
        <div className="mb-6">
          <p className="text-[12px] font-[600] text-[#2A1F1A] mb-3">Monthly Pipeline Added (Last 6 Months)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barCategoryGap="25%" margin={{ top: 20, right: 10, left: 10, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#7A6A60', fontFamily: 'DM Sans' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#7A6A60', fontFamily: 'DM Sans' }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => formatCurrency(v)} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(107,76,76,.05)' }} />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'DM Sans' }} iconType="circle" iconSize={8} />
              <ReferenceLine y={monthlyGoal} stroke="#D97706" strokeDasharray="4 4" strokeWidth={1.5}
                label={{ value: `Goal: ${formatCurrency(monthlyGoal)}/mo`, position: 'right', fontSize: 10, fill: '#D97706' }} />
              <Bar dataKey="Closed Won" stackId="a" fill="#16A34A" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Open Pipeline" stackId="a" fill="#2563EB" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="total" position="top"
                  formatter={(v: number) => v > 0 ? formatCurrency(v) : ''}
                  style={{ fontSize: 10, fill: '#2A1F1A', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pipeline Value by Channel (ARR per source) */}
        {data.bySourceValue && data.bySourceValue.length > 0 && (
          <div className="mb-6">
            <p className="text-[12px] font-[600] text-[#2A1F1A] mb-3">Pipeline Value by Channel</p>
            <div className="space-y-2">
              {data.bySourceValue.map(row => {
                const color = SOURCE_COLORS[row.source] || '#9CA3AF'
                const pct = data.totalACV > 0 ? (row.total / data.totalACV) * 100 : 0
                const isExpanded = expandedSource === row.source
                const hasDeals = row.deals && row.deals.length > 0
                return (
                  <div key={row.source}>
                    <button
                      type="button"
                      onClick={() => hasDeals && setExpandedSource(isExpanded ? null : row.source)}
                      className={cn(
                        'w-full text-left',
                        hasDeals && 'cursor-pointer hover:opacity-80',
                      )}
                    >
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="flex items-center gap-1.5 font-[500] text-[#2A1F1A]">
                          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: color }} />
                          {row.source}
                          <span className="text-[#7A6A60] font-[400]">({row.count} deal{row.count !== 1 ? 's' : ''})</span>
                          {hasDeals && (
                            <span className="text-[#7A6A60] text-[9px]">{isExpanded ? '▲' : '▼'}</span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          {row.won > 0 && (
                            <span className="text-[10px] text-[#16A34A] font-[600]">{formatCurrency(row.won)} won</span>
                          )}
                          <span className="font-[700] text-[#2A1F1A]">{formatCurrency(row.total)}</span>
                          <span className="text-[#7A6A60] w-[36px] text-right">{pct.toFixed(0)}%</span>
                        </div>
                      </div>
                      <div className="h-[6px] rounded-full bg-[#F2EDE8] overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: color, opacity: 0.85 }}
                        />
                      </div>
                    </button>
                    {isExpanded && hasDeals && (
                      <div className="mt-2 mb-1 rounded-[10px] border border-[#D4CBC0] bg-[#F9F5F1] overflow-hidden">
                        <table className="w-full text-[10.5px]">
                          <thead>
                            <tr className="border-b border-[#D4CBC0]">
                              <th className="text-left py-1.5 px-2.5 text-[#7A6A60] font-[500]">Deal</th>
                              <th className="text-left py-1.5 px-2 text-[#7A6A60] font-[500]">Company</th>
                              <th className="text-right py-1.5 px-2 text-[#7A6A60] font-[500]">Amount</th>
                              <th className="text-left py-1.5 px-2.5 text-[#7A6A60] font-[500]">Stage</th>
                            </tr>
                          </thead>
                          <tbody>
                            {row.deals.map((d, i) => (
                              <tr key={i} className="border-b border-[#F2EDE8] last:border-0">
                                <td className="py-1.5 px-2.5 text-[#2A1F1A] font-[500] max-w-[160px] truncate">{d.name}</td>
                                <td className="py-1.5 px-2 text-[#7A6A60] max-w-[120px] truncate">{d.company || '—'}</td>
                                <td className="py-1.5 px-2 text-right text-[#2A1F1A] font-[600]">{formatCurrency(d.amount)}</td>
                                <td className="py-1.5 px-2.5">
                                  <span className={cn(
                                    'inline-block px-1.5 py-0.5 rounded text-[9px]',
                                    d.stage === 'Closed Won'  && 'bg-green-100 text-green-700',
                                    d.stage === 'Proposal'    && 'bg-amber-100 text-amber-700',
                                    d.stage === 'Negotiation' && 'bg-blue-100 text-blue-700',
                                    !['Closed Won','Proposal','Negotiation'].includes(d.stage) && 'bg-gray-100 text-gray-600',
                                  )}>{d.stage}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Top deals table — includes Company and Source */}
        <div>
          <p className="text-[12px] font-[600] text-[#2A1F1A] mb-2">
            Top Opportunities — {filterLabel} ({data.topDeals.length} shown)
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[#D4CBC0]">
                  <th className="text-left py-1.5 pr-2 text-[#7A6A60] font-[500]">Deal</th>
                  <th className="text-left py-1.5 px-2 text-[#7A6A60] font-[500]">Company</th>
                  <th className="text-right py-1.5 px-2 text-[#7A6A60] font-[500]">ACV</th>
                  <th className="text-left py-1.5 px-2 text-[#7A6A60] font-[500]">Stage</th>
                  <th className="text-left py-1.5 px-2 text-[#7A6A60] font-[500]">Source</th>
                  <th className="text-left py-1.5 pl-2 text-[#7A6A60] font-[500]">Close Date</th>
                </tr>
              </thead>
              <tbody>
                {data.topDeals.map((deal, i) => (
                  <tr key={i} className="border-b border-[#F2EDE8] hover:bg-[#F9F5F1]">
                    <td className="py-1.5 pr-2 text-[#2A1F1A] font-[500] max-w-[140px] truncate">{deal.name}</td>
                    <td className="py-1.5 px-2 text-[#7A6A60] max-w-[120px] truncate">{deal.company || '—'}</td>
                    <td className="py-1.5 px-2 text-right text-[#2A1F1A] font-[600]">{formatCurrency(deal.amount)}</td>
                    <td className="py-1.5 px-2 text-[#7A6A60]">
                      <span className={cn(
                        'inline-block px-1.5 py-0.5 rounded text-[10px]',
                        deal.stage === 'Closed Won'  && 'bg-green-100 text-green-700',
                        deal.stage === 'Proposal'    && 'bg-amber-100 text-amber-700',
                        deal.stage === 'Negotiation' && 'bg-blue-100 text-blue-700',
                        !['Closed Won','Proposal','Negotiation'].includes(deal.stage) && 'bg-gray-100 text-gray-600',
                      )}>{deal.stage}</span>
                    </td>
                    <td className="py-1.5 px-2">
                      {deal.source ? (
                        <span className="flex items-center text-[#2A1F1A]">
                          {sourceDot(deal.source)}
                          {deal.source}
                        </span>
                      ) : <span className="text-[#D4CBC0]">—</span>}
                    </td>
                    <td className="py-1.5 pl-2 text-[#7A6A60]">
                      {deal.closeDate ? new Date(deal.closeDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
