'use client'

import { useMemo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList, PieChart, Pie, Legend,
} from 'recharts'
import type { WeekMetrics } from '@/hooks/useWeeklyMetrics'

const CARD = 'rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]'
const TICK = { fontSize: 11, fill: '#7A6A60' }
const GRID = { strokeDasharray: '3 3', stroke: '#D4CBC0', strokeOpacity: 0.5, vertical: false as const }
const COLORS       = ['#6B4C4C', '#C96A5A', '#8A6060', '#D97706', '#2563EB', '#16A34A', '#7C3AED', '#0891B2', '#7A6A60', '#DC2626', '#059669', '#4F46E5']
const STATUS_COLORS: Record<string, string> = {
  'OPEN':                          '#9CA3AF',
  'Working':                        '#D97706',
  'Stalled':                        '#EF4444',
  'Demo Booked':                    '#2563EB',
  'Demo Completed':                 '#16A34A',
  'Demo Completed - PLG':           '#059669',
  'Demo Completed - Disqualified':  '#6B7280',
  'Demo Completed - Ghosting':      '#F97316',
  'Demo no show':                   '#DC2626',
  'Demo Cancelled by Client':       '#B91C1C',
  'Junk Lead':                      '#E5E7EB',
  'UNQUALIFIED':                    '#D1D5DB',
  'Associated with a deal':         '#7C3AED',
  'New':                            '#9CA3AF',
}

function BarTip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="rounded-[14px] border border-[#D4CBC0] bg-white/95 px-4 py-3 shadow-[0_8px_32px_rgba(40,20,10,.10)]">
      <p className="text-[13px] font-[600] text-[#2A1F1A] mb-1">{d.name}</p>
      <p className="text-[13px] text-[#7A6A60]">{d.value.toLocaleString()} leads</p>
    </div>
  )
}

function PieTip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[14px] border border-[#D4CBC0] bg-white/95 px-3 py-2 shadow-[0_8px_32px_rgba(40,20,10,.10)]">
      <p className="text-[12px] font-[600] text-[#2A1F1A]">{payload[0].name}</p>
      <p className="text-[12px] text-[#7A6A60]">{payload[0].value} leads ({payload[0].payload.pct}%)</p>
    </div>
  )
}

type Props = {
  data: WeekMetrics
  formTypeBreakdown?: Record<string, { working: number; ads: number; website: number }>
  studioCount?: number
  statusBreakdown?: Record<string, number>
}

export function LeadsDomainBreakup({ data, formTypeBreakdown, studioCount = 0, statusBreakdown = {} }: Props) {
  // Form-type bar chart data (Agent Studio excluded — handled separately below)
  const chartData = useMemo(() => {
    const items: { name: string; value: number }[] = []
    for (const [key, entry] of Object.entries(data)) {
      if (!key.startsWith('leads_ft_')) continue
      const val = parseFloat(entry?.value ?? '')
      if (isNaN(val) || val === 0) continue
      const match = entry.notes?.match(/\(([^)]+)\)/)
      const name = match?.[1] || key.replace('leads_ft_', '').replace(/_/g, ' ')
      items.push({ name, value: val })
    }
    return items.sort((a, b) => b.value - a.value)
  }, [data])

  // Status breakdown pie chart data
  const statusData = useMemo(() => {
    const total = Object.values(statusBreakdown).reduce((s, v) => s + v, 0)
    return Object.entries(statusBreakdown)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name,
        value,
        pct: total > 0 ? Math.round((value / total) * 100) : 0,
        fill: STATUS_COLORS[name] || '#9CA3AF',
      }))
  }, [statusBreakdown])

  const totalLeads = chartData.reduce((s, d) => s + d.value, 0)

  if (chartData.length === 0 && studioCount === 0) {
    return (
      <div className={CARD}>
        <p className="eyebrow mb-4">Leads Breakup by Form Type</p>
        <p className="text-[13px] text-[#7A6A60]">No data yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Form type bar chart ─────────────────────────────────────────────── */}
      <div className={CARD}>
        <div className="flex items-start justify-between mb-4 gap-4 flex-wrap">
          <div>
            <p className="eyebrow">Leads by Form Type</p>
            <p className="text-[11px] text-[#7A6A60] mt-0.5">Agent Studio excluded from total</p>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-[#7A6A60]">
            <span>⚡ Working</span>
            <span>📢 Ads</span>
            <span>🌐 Website</span>
          </div>
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 40 + 40)}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 50, left: 8, bottom: 0 }}>
              <CartesianGrid {...GRID} horizontal={false} />
              <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" tick={TICK} axisLine={false} tickLine={false} width={120} />
              <Tooltip content={<BarTip />} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
                <LabelList
                  dataKey="value"
                  position="right"
                  style={{ fontSize: 11, fill: '#2A1F1A', fontWeight: 600 }}
                  formatter={(v: number) => v > 0 ? v.toLocaleString() : ''}
                />
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-[13px] text-[#7A6A60]">No non-studio leads this period</p>
        )}

        {/* Legend with breakdown */}
        <div className="mt-3 flex flex-wrap gap-3">
          {chartData.map((d, i) => {
            const bd = formTypeBreakdown ? formTypeBreakdown[d.name] : null
            return (
              <div key={d.name} className="flex items-center gap-1.5 text-[11px] text-[#7A6A60]">
                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                {d.name}: <span className="font-[600] text-[#2A1F1A]">{d.value.toLocaleString()}</span>
                {bd && (bd.working > 0 || bd.ads > 0 || bd.website > 0) && (
                  <span className="text-[9px] text-[#7A6A60] ml-1">
                    ({bd.working > 0 ? `⚡${bd.working}` : ''}
                    {bd.working > 0 && bd.ads > 0 ? ' · ' : ''}
                    {bd.ads > 0 ? `📢${bd.ads}` : ''}
                    {(bd.working > 0 || bd.ads > 0) && bd.website > 0 ? ` · 🌐${bd.website}` : bd.website > 0 ? `🌐${bd.website}` : ''})
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>



      {/* ── Status Breakdown ───────────────────────────────────────────────── */}
      {statusData.length > 0 && (
        <div className={CARD}>
          <p className="eyebrow mb-4">Lead Status Breakdown</p>
          <p className="text-[11px] text-[#7A6A60] mb-4">Distribution of hs_lead_status across non-demo, non-studio leads this period</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Pie */}
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip content={<PieTip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Legend table */}
            <div className="space-y-1.5">
              {statusData.map(d => (
                <div key={d.name} className="flex items-center justify-between text-[12px]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ background: d.fill }} />
                    <span className="text-[#2A1F1A] truncate">{d.name === 'OPEN' ? 'New' : d.name}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <span className="font-[600] text-[#2A1F1A]">{d.value}</span>
                    <span className="text-[#7A6A60] w-[32px] text-right">{d.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
