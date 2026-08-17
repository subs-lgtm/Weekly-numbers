'use client'

import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { format, subWeeks } from 'date-fns'
import { useWeeklyMetrics } from '@/hooks/useWeeklyMetrics'

const CARD = 'rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]'
const TICK = { fontSize: 11, fill: '#7A6A60' }
const GRID = { strokeDasharray: '3 3', stroke: '#D4CBC0', strokeOpacity: 0.5, vertical: false as const }

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[14px] border border-[#D4CBC0] bg-white/95 px-4 py-3 shadow-[0_8px_32px_rgba(40,20,10,.10)]">
      <p className="eyebrow mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-[13px] text-[#2A1F1A]">
          <span className="h-2 w-2 rounded-full" style={{ background: p.stroke }} />
          <span className="text-[#7A6A60]">{p.name}:</span>
          <span className="font-[600]">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  )
}

type Props = { sectionKey: string; weekStart: string }

export function ArchitectSubsChart({ sectionKey, weekStart }: Props) {
  const wks = useMemo(() => {
    const DATA_START = '2026-03-03' // Start from March 2026
    const r: string[] = []
    const b = new Date(weekStart + 'T00:00:00')
    for (let i = 5; i >= 0; i--) {
      const wk = format(subWeeks(b, i), 'yyyy-MM-dd')
      if (wk >= DATA_START) r.push(wk)
    }
    return r
  }, [weekStart])

  const w0 = useWeeklyMetrics(sectionKey, wks[0] ?? weekStart)
  const w1 = useWeeklyMetrics(sectionKey, wks[1] ?? weekStart)
  const w2 = useWeeklyMetrics(sectionKey, wks[2] ?? weekStart)
  const w3 = useWeeklyMetrics(sectionKey, wks[3] ?? weekStart)
  const w4 = useWeeklyMetrics(sectionKey, wks[4] ?? weekStart)
  const w5 = useWeeklyMetrics(sectionKey, wks[5] ?? weekStart)
  const weeks = [w0, w1, w2, w3, w4, w5]

  const chartData = useMemo(() => wks.map((wk, i) => {
    const d = weeks[i].data
    const a = parseFloat(d['total_paid_subs']?.value ?? '')
    const g = parseFloat(d['goal_paid_subs']?.value ?? '')
    return { week: format(new Date(wk + 'T00:00:00'), 'MMM d'), 'Actual Subs': isNaN(a) ? 0 : a, 'Goal Subs': isNaN(g) ? 0 : g }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [wks, w0.data, w1.data, w2.data, w3.data, w4.data, w5.data])

  const hasData = chartData.some(d => d['Actual Subs'] > 0 || d['Goal Subs'] > 0)
  if (!hasData) return <div className={CARD}><p className="eyebrow mb-4">WoW — Paid Subscriptions</p><p className="text-[13px] text-[#7A6A60]">No data yet</p></div>

  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">WoW — Total Paid Subscriptions Goals vs Actuals</p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="week" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} />
          <Tooltip content={<Tip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#7A6A60', paddingTop: 8 }} />
          <Line type="monotone" dataKey="Actual Subs" stroke="#6B4C4C" strokeWidth={2.5} dot={{ r: 5, fill: '#6B4C4C', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }} />
          <Line type="monotone" dataKey="Goal Subs" stroke="#D4CBC0" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 4, fill: '#D4CBC0', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
