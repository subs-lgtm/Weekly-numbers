'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, Users, Clock, TrendingUp, AlertTriangle, Calendar, ArrowRight } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts'
import { useWeek } from '@/lib/week-context'

type PerformanceData = {
  funnel: {
    working: number
    demoBooked: number
    demoViaWorking: number
    demoDirect: number
    demoCompleted: number
    opportunity: number
    oppViaWorking: number
    oppDirect: number
    customer: number
    custViaWorking: number
    custDirect: number
    totalEntered: number
    workingToDemoRate: number
    workingToOppRate: number
  }
  aging: {
    buckets: Record<string, number>
    avgDays: number
    medianDays: number
    over30: number
    over60: number
    totalWorking: number
  }
  cohorts: {
    week: string
    entered: number
    demoBooked: number
    demoConversionRate: number
    opportunity: number
    customer: number
    avgDaysToDemo: number | null
  }[]
  meta: {
    lookbackDays: number
    generatedAt: string
    stageConfig: Record<string, string>
  }
}

const FUNNEL_COLORS = ['#6B4C4C', '#C96A5A', '#D97706', '#16A34A', '#2563EB']
const AGING_COLORS: Record<string, string> = {
  '0-7': '#16A34A',
  '8-14': '#65A30D',
  '15-30': '#D97706',
  '31-60': '#EA580C',
  '60+': '#DC2626',
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[10px] border border-[#D4CBC0] bg-white px-3 py-2 shadow-lg text-[12px]">
      <p className="font-[600] text-[#2A1F1A]">{payload[0].payload.name || payload[0].payload.week}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-[#7A6A60]">{p.name || p.dataKey}: {p.value}{p.dataKey?.includes('Rate') ? '%' : ''}</p>
      ))}
    </div>
  )
}

export function WorkingFunnel() {
  const { queryStart, queryEnd } = useWeek()
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/hubspot/working-leads-performance?lookback=90`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [queryStart, queryEnd])

  if (loading) {
    return (
      <div className="rounded-[20px] border border-[#D4CBC0] bg-[#F9F5F1] p-6">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-[#6B4C4C] border-t-transparent rounded-full animate-spin" />
          <span className="text-[13px] text-[#7A6A60]">Loading Working Leads Performance…</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-[20px] border border-red-200 bg-red-50 p-6">
        <p className="text-[13px] text-red-600">Error: {error}</p>
        <button onClick={fetchData} className="mt-2 text-[12px] text-[#6B4C4C] underline">Retry</button>
      </div>
    )
  }

  if (!data) return null

  const { funnel, aging, cohorts } = data

  // Build funnel chart data — show "via Working" as main bars, "direct" as lighter
  const funnelChartData = [
    { name: 'Working', value: funnel.working, direct: 0 },
    { name: 'Demo Booked', value: funnel.demoViaWorking, direct: funnel.demoDirect },
    { name: 'Opportunity', value: funnel.oppViaWorking, direct: funnel.oppDirect },
    { name: 'Customer', value: funnel.custViaWorking, direct: funnel.custDirect },
  ]

  // Aging chart data
  const agingChartData = Object.entries(aging.buckets).map(([name, value]) => ({ name: name + ' days', bucket: name, value }))

  // Cohort chart data (conversion rate trend)
  const cohortChartData = cohorts.map(c => ({
    week: c.week.slice(5), // "MM-DD" for compactness
    fullWeek: c.week,
    entered: c.entered,
    demoConversionRate: c.demoConversionRate,
    demoBooked: c.demoBooked,
  }))

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[16px] font-[600] text-[#2A1F1A]">Working Leads Performance</h3>
          <p className="text-[12px] text-[#7A6A60] mt-0.5">Last 90 days · Are leads progressing, stuck, or improving?</p>
        </div>
        <button onClick={fetchData} className="p-1.5 rounded-lg hover:bg-[#F3ECE4] transition-colors" title="Refresh">
          <RefreshCw className="w-3.5 h-3.5 text-[#7A6A60]" />
        </button>
      </div>

      {/* ==================== SECTION 1: FUNNEL KPIs ==================== */}
      <div className="rounded-[16px] border border-[#D4CBC0] bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-[#6B4C4C]" />
          <p className="text-[13px] font-[600] text-[#2A1F1A]">Working Leads Funnel</p>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="rounded-[12px] bg-[#F9F5F1] p-3">
            <p className="text-[11px] text-[#7A6A60] mb-1">Total Working</p>
            <p className="text-[22px] font-[700] text-[#2A1F1A]">{funnel.working}</p>
          </div>
          <div className="rounded-[12px] bg-[#F9F5F1] p-3">
            <p className="text-[11px] text-[#7A6A60] mb-1">Working → Demo Rate</p>
            <p className="text-[22px] font-[700] text-[#C96A5A]">{funnel.workingToDemoRate}%</p>
          </div>
          <div className="rounded-[12px] bg-[#F9F5F1] p-3">
            <p className="text-[11px] text-[#7A6A60] mb-1">Demo (via Working)</p>
            <p className="text-[22px] font-[700] text-[#D97706]">{funnel.demoViaWorking}</p>
            <p className="text-[10px] text-[#7A6A60]">{funnel.demoDirect} direct (skipped Working)</p>
          </div>
          <div className="rounded-[12px] bg-[#F9F5F1] p-3">
            <p className="text-[11px] text-[#7A6A60] mb-1">Opp (via Working)</p>
            <p className="text-[22px] font-[700] text-[#16A34A]">{funnel.oppViaWorking}</p>
            <p className="text-[10px] text-[#7A6A60]">{funnel.oppDirect} direct (skipped Working)</p>
          </div>
        </div>

        {/* Funnel bar chart — stacked: via Working (solid) + direct (lighter) */}
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={funnelChartData} layout="vertical" margin={{ left: 10, right: 80, top: 5, bottom: 5 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: '#7A6A60' }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" stackId="a" radius={[0, 0, 0, 0]} barSize={24} name="Via Working">
              {funnelChartData.map((_, i) => (
                <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
              ))}
              <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: '#2A1F1A', fontWeight: 600 }} />
            </Bar>
            <Bar dataKey="direct" stackId="a" radius={[0, 6, 6, 0]} barSize={24} name="Direct (skipped)" fill="#E8E0D8" opacity={0.6}>
              <LabelList dataKey="direct" position="right" style={{ fontSize: 10, fill: '#7A6A60' }} formatter={(v: number) => v > 0 ? `+${v}` : ''} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Conversion flow — via Working only */}
        <div className="flex items-center justify-center gap-2 mt-3 text-[11px] text-[#7A6A60]">
          <span className="font-[600] text-[#2A1F1A]">{funnel.working}</span>
          <ArrowRight className="w-3 h-3" />
          <span className="font-[600] text-[#C96A5A]">{funnel.demoViaWorking} ({funnel.workingToDemoRate}%)</span>
          <ArrowRight className="w-3 h-3" />
          <span className="font-[600] text-[#16A34A]">{funnel.oppViaWorking} ({funnel.workingToOppRate}%)</span>
          <ArrowRight className="w-3 h-3" />
          <span className="font-[600] text-[#2563EB]">{funnel.custViaWorking}</span>
        </div>
        <p className="text-center text-[10px] text-[#7A6A60] mt-1">Only leads that went through Working → shown above. Direct skips shown in lighter bars.</p>

        {/* Legend explanation */}
        <div className="mt-4 rounded-[10px] bg-[#F9F5F1] border border-[#E8E0D8] p-3">
          <div className="grid grid-cols-2 gap-3 text-[11px]">
            <div className="flex items-start gap-2">
              <div className="w-3 h-3 rounded-[3px] bg-[#6B4C4C] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-[600] text-[#2A1F1A]">Via Working (SDR-worked)</p>
                <p className="text-[#7A6A60]">Lead was assigned to an SDR, marked as Working, then progressed to Demo/Opp. This reflects SDR performance.</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="w-3 h-3 rounded-[3px] bg-[#E8E0D8] mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-[600] text-[#2A1F1A]">Direct (skipped Working)</p>
                <p className="text-[#7A6A60]">Lead went straight from Open to Demo Booked — booked via calendar link or senior rep action, without SDR involvement.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== SECTION 2: AGING ==================== */}
      <div className="rounded-[16px] border border-[#D4CBC0] bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-[#D97706]" />
          <p className="text-[13px] font-[600] text-[#2A1F1A]">Working Lead Aging</p>
          <span className="text-[11px] text-[#7A6A60] ml-auto">How long leads sit in Working</span>
        </div>

        {/* Aging KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <div className="rounded-[12px] bg-[#F9F5F1] p-3">
            <p className="text-[11px] text-[#7A6A60] mb-1">Avg Days in Working</p>
            <p className="text-[20px] font-[700] text-[#2A1F1A]">{aging.avgDays}</p>
          </div>
          <div className="rounded-[12px] bg-[#F9F5F1] p-3">
            <p className="text-[11px] text-[#7A6A60] mb-1">Median Days</p>
            <p className="text-[20px] font-[700] text-[#2A1F1A]">{aging.medianDays}</p>
          </div>
          <div className="rounded-[12px] bg-[#F9F5F1] p-3">
            <p className="text-[11px] text-[#7A6A60] mb-1">Total Working</p>
            <p className="text-[20px] font-[700] text-[#2A1F1A]">{aging.totalWorking}</p>
          </div>
          <div className="rounded-[12px] bg-[rgba(234,88,12,0.08)] border border-[rgba(234,88,12,0.2)] p-3">
            <p className="text-[11px] text-[#EA580C] mb-1">Stale (&gt;30 days)</p>
            <p className="text-[20px] font-[700] text-[#EA580C]">{aging.over30}</p>
          </div>
          <div className="rounded-[12px] bg-[rgba(220,38,38,0.06)] border border-[rgba(220,38,38,0.2)] p-3">
            <p className="text-[11px] text-[#DC2626] mb-1">Critical (&gt;60 days)</p>
            <p className="text-[20px] font-[700] text-[#DC2626]">{aging.over60}</p>
          </div>
        </div>

        {/* Aging bucket chart */}
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={agingChartData} margin={{ top: 25, right: 10, left: 10, bottom: 5 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#7A6A60' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
              {agingChartData.map((entry) => (
                <Cell key={entry.bucket} fill={AGING_COLORS[entry.bucket] || '#9CA3AF'} />
              ))}
              <LabelList dataKey="value" position="top" style={{ fontSize: 12, fill: '#2A1F1A', fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Warning callout if too many stale leads */}
        {aging.over30 > 10 && (
          <div className="mt-3 flex items-start gap-2 rounded-[10px] bg-[rgba(234,88,12,0.06)] border border-[rgba(234,88,12,0.15)] p-3">
            <AlertTriangle className="w-4 h-4 text-[#EA580C] mt-0.5 flex-shrink-0" />
            <p className="text-[12px] text-[#EA580C]">
              <strong>{aging.over30} leads</strong> have been in Working for over 30 days without progressing. Consider re-engaging or disqualifying stale leads.
            </p>
          </div>
        )}
      </div>

      {/* ==================== SECTION 3: WEEKLY COHORT ==================== */}
      <div className="rounded-[16px] border border-[#D4CBC0] bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-4 h-4 text-[#2563EB]" />
          <p className="text-[13px] font-[600] text-[#2A1F1A]">Weekly Cohort Analysis</p>
          <span className="text-[11px] text-[#7A6A60] ml-auto">Are newer cohorts converting better?</span>
        </div>

        {/* Cohort conversion rate trend line */}
        {cohortChartData.length > 2 && (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={cohortChartData} margin={{ top: 10, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D8" />
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#7A6A60' }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#7A6A60' }} unit="%" domain={[0, 'auto']} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#7A6A60' }} domain={[0, 'auto']} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="left" type="monotone" dataKey="demoConversionRate" name="Demo Conv. %" stroke="#C96A5A" strokeWidth={2} dot={{ r: 4 }}>
                <LabelList dataKey="demoConversionRate" position="top" style={{ fontSize: 10, fill: '#C96A5A', fontWeight: 600 }} formatter={(v: number) => `${v}%`} />
              </Line>
              <Line yAxisId="right" type="monotone" dataKey="entered" name="Leads Entered" stroke="#6B4C4C" strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 3 }}>
                <LabelList dataKey="entered" position="bottom" style={{ fontSize: 10, fill: '#6B4C4C', fontWeight: 500 }} />
              </Line>
            </LineChart>
          </ResponsiveContainer>
        )}

        {/* Cohort table */}
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[#E8E0D8] text-[#7A6A60]">
                <th className="text-left py-2 px-2 font-[500]">Week</th>
                <th className="text-center py-2 px-2 font-[500]">Entered Working</th>
                <th className="text-center py-2 px-2 font-[500]">Demo Booked</th>
                <th className="text-center py-2 px-2 font-[500]">Demo Conv. %</th>
                <th className="text-center py-2 px-2 font-[500]">Opportunity</th>
                <th className="text-center py-2 px-2 font-[500]">Avg Days to Demo</th>
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c, i) => (
                <tr key={c.week} className={`border-b border-[#F3ECE4] ${i === cohorts.length - 1 ? 'bg-[#F9F5F1]' : ''}`}>
                  <td className="py-2 px-2 font-[500] text-[#2A1F1A]">{c.week}</td>
                  <td className="py-2 px-2 text-center text-[#2A1F1A]">{c.entered}</td>
                  <td className="py-2 px-2 text-center font-[600] text-[#D97706]">{c.demoBooked}</td>
                  <td className="py-2 px-2 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-[600] ${
                      c.demoConversionRate >= 30 ? 'bg-[rgba(22,163,74,0.1)] text-[#16A34A]' :
                      c.demoConversionRate >= 15 ? 'bg-[rgba(217,119,6,0.1)] text-[#D97706]' :
                      'bg-[rgba(220,38,38,0.06)] text-[#DC2626]'
                    }`}>
                      {c.demoConversionRate}%
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center text-[#2A1F1A]">{c.opportunity}</td>
                  <td className="py-2 px-2 text-center text-[#7A6A60]">{c.avgDaysToDemo !== null ? `${c.avgDaysToDemo}d` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
