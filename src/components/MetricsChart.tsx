'use client'

import { useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Bar, Cell,
  PieChart, Pie, RadialBarChart, RadialBar,
} from 'recharts'
import { format, subWeeks } from 'date-fns'
import { useWeeklyMetrics } from '@/hooks/useWeeklyMetrics'
import type { MetricDef } from '@/lib/metrics-config'

const C = ['#6B4C4C', '#C96A5A', '#8A6060', '#4ADE80', '#D97706', '#7A6A60']
const CARD = 'rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]'
const TICK = { fontSize: 11, fill: '#7A6A60' }
const GRID = { strokeDasharray: '3 3', stroke: '#D4CBC0', strokeOpacity: 0.5, vertical: false as const }
const fmtY = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[14px] border border-[#D4CBC0] bg-white/95 px-4 py-3 shadow-[0_8px_32px_rgba(40,20,10,.10)]">
      <p className="eyebrow mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-[13px] text-[#2A1F1A]">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.fill }} />
          <span className="text-[#7A6A60]">{p.name}:</span>
          <span className="font-[600]">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  )
}

function useMultiWeek(sk: string, ws: string, ms: MetricDef[]) {
  const wks = useMemo(() => {
    const DATA_START = '2026-03-03' // Start from March 2026
    const r: string[] = []
    const b = new Date(ws + 'T00:00:00')
    for (let i = 5; i >= 0; i--) {
      const wk = format(subWeeks(b, i), 'yyyy-MM-dd')
      if (wk >= DATA_START) r.push(wk)
    }
    return r
  }, [ws])
  const w0 = useWeeklyMetrics(sk, wks[0])
  const w1 = useWeeklyMetrics(sk, wks[1])
  const w2 = useWeeklyMetrics(sk, wks[2])
  const w3 = useWeeklyMetrics(sk, wks[3])
  const w4 = useWeeklyMetrics(sk, wks[4])
  const w5 = useWeeklyMetrics(sk, wks[5])
  const wd = [w0, w1, w2, w3, w4, w5]
  return useMemo(() => wks.map((w, i) => {
    const e: Record<string, string | number> = { week: format(new Date(w + 'T00:00:00'), 'MMM d') }
    ms.forEach(m => { const n = parseFloat(wd[i].data[m.key]?.value ?? ''); e[m.key] = isNaN(n) ? 0 : n })
    return e
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [wks, w0.data, w1.data, w2.data, w3.data, w4.data, w5.data])
}

export function MetricsChart({ sectionKey, weekStart, metrics }: { sectionKey: string; weekStart: string; metrics: MetricDef[] }) {
  const cd = useMultiWeek(sectionKey, weekStart, metrics)
  const am = metrics.filter(m => cd.some(d => (d[m.key] as number) > 0))
  if (am.length === 0) return null
  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">6-Week Trend</p>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={cd} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <defs>
            {am.map((m, i) => (
              <linearGradient key={m.key} id={`g-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C[i % C.length]} stopOpacity={0.18} />
                <stop offset="95%" stopColor={C[i % C.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="week" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={fmtY} />
          <Tooltip content={<Tip />} />
          {am.length > 1 && <Legend wrapperStyle={{ fontSize: 11, color: '#7A6A60', paddingTop: 8 }} />}
          {am.map((m, i) => (
            <Area key={m.key} type="monotone" dataKey={m.key} name={m.label}
              stroke={C[i % C.length]} strokeWidth={2} fill={`url(#g-${m.key})`}
              dot={{ r: 3, fill: C[i % C.length], strokeWidth: 0 }} activeDot={{ r: 5, strokeWidth: 0 }} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

type D = Record<string, { value: string; notes: string; updatedBy: string }>

export function SourceBreakdownBar({ data, keys, title = 'Lead Source Breakdown' }: { data: D; keys: { key: string; label: string }[]; title?: string }) {
  const cd = useMemo(() => {
    const e: Record<string, string | number> = { name: 'Sources' }
    let has = false
    keys.forEach(k => { const n = parseFloat(data[k.key]?.value ?? ''); e[k.key] = isNaN(n) ? 0 : n; if (!isNaN(n) && n > 0) has = true })
    return has ? [e] : null
  }, [data, keys])
  if (!cd) return <div className={CARD}><p className="eyebrow mb-4">{title}</p><p className="text-[13px] text-[#7A6A60]">No data yet</p></div>
  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={80}>
        <BarChart data={cd} layout="vertical" margin={{ top: 0, right: 4, left: -16, bottom: 0 }}>
          <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" hide />
          <Tooltip content={<Tip />} />
          {keys.map((k, i) => <Bar key={k.key} dataKey={k.key} name={k.label} stackId="a" fill={C[i % C.length]} radius={i === 0 ? [4, 0, 0, 4] : i === keys.length - 1 ? [0, 4, 4, 0] : 0} />)}
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-3">
        {keys.map((k, i) => { const v = parseFloat(data[k.key]?.value ?? ''); return (
          <div key={k.key} className="flex items-center gap-1.5 text-[11px] text-[#7A6A60]">
            <span className="h-2 w-2 rounded-full" style={{ background: C[i % C.length] }} />
            {k.label}: <span className="font-[600] text-[#2A1F1A]">{isNaN(v) ? 0 : v.toLocaleString()}</span>
          </div>
        )})}
      </div>
    </div>
  )
}

export function FunnelChart({ data, stages, title = 'Conversion Funnel' }: { data: D; stages: { key: string; label: string }[]; title?: string }) {
  const cd = useMemo(() => {
    const items = stages.map((s, i) => { const n = parseFloat(data[s.key]?.value ?? ''); return { name: s.label, value: isNaN(n) ? 0 : n, fill: C[i % C.length] } })
    return items.some(d => d.value > 0) ? items : null
  }, [data, stages])
  if (!cd) return <div className={CARD}><p className="eyebrow mb-4">{title}</p><p className="text-[13px] text-[#7A6A60]">No data yet</p></div>
  const mx = Math.max(...cd.map(d => d.value), 1)
  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">{title}</p>
      <div className="space-y-2.5">
        {cd.map((s, i) => {
          const pct = Math.max((s.value / mx) * 100, 4)
          return (
            <div key={s.name}>
              <div className="mb-1 flex items-center justify-between text-[12px]">
                <span className="text-[#7A6A60]">{s.name}</span>
                <span className="font-[600] text-[#2A1F1A]">{s.value.toLocaleString()}</span>
              </div>
              <div className="h-6 w-full overflow-hidden rounded-full bg-[#F5F0EB]">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: s.fill }} />
              </div>
              {i < cd.length - 1 && s.value > 0 && cd[i + 1].value > 0 && (
                <p className="mt-0.5 text-right text-[10px] text-[#7A6A60]">{((cd[i + 1].value / s.value) * 100).toFixed(1)}% conversion</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function GoalsVsActualsBar({ data, pairs, title = 'Goals vs Actuals' }: { data: D; pairs: { actualKey: string; goalKey: string; label: string }[]; title?: string }) {
  const cd = useMemo(() => {
    let has = false
    const items = pairs.map(p => {
      const a = parseFloat(data[p.actualKey]?.value ?? ''); const g = parseFloat(data[p.goalKey]?.value ?? '')
      const av = isNaN(a) ? 0 : a; const gv = isNaN(g) ? 0 : g
      if (av > 0 || gv > 0) has = true
      return { name: p.label, Actual: av, Goal: gv }
    })
    return has ? items : null
  }, [data, pairs])
  if (!cd) return <div className={CARD}><p className="eyebrow mb-4">{title}</p><p className="text-[13px] text-[#7A6A60]">No data yet</p></div>
  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={cd} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="name" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={fmtY} />
          <Tooltip content={<Tip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#7A6A60', paddingTop: 8 }} />
          <Bar dataKey="Actual" fill="#6B4C4C" radius={[4, 4, 0, 0]} barSize={28} />
          <Bar dataKey="Goal" fill="#D4CBC0" radius={[4, 4, 0, 0]} barSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function DonutChart({ value, label, title }: { value: number; label: string; title?: string }) {
  const cl = Math.max(0, Math.min(100, value))
  const cd = useMemo(() => [{ name: label, value: cl }, { name: 'Remaining', value: 100 - cl }], [cl, label])
  if (value === 0 || isNaN(value)) return <div className={CARD}>{title && <p className="eyebrow mb-4">{title}</p>}<p className="text-[13px] text-[#7A6A60]">No data yet</p></div>
  return (
    <div className={CARD}>
      {title && <p className="eyebrow mb-4">{title}</p>}
      <div className="flex items-center gap-4">
        <div className="relative h-[120px] w-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={cd} cx="50%" cy="50%" innerRadius={36} outerRadius={52} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                <Cell fill="#6B4C4C" />
                <Cell fill="#F5F0EB" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[1.3rem] font-[600] text-[#2A1F1A]">{cl}%</span>
          </div>
        </div>
        <div>
          <p className="text-[13px] font-[600] text-[#2A1F1A]">{label}</p>
          <p className="text-[11px] text-[#7A6A60]">{cl}% of 100%</p>
        </div>
      </div>
    </div>
  )
}

export function RadialGauge({ value, label, title }: { value: number; label: string; title?: string }) {
  const cl = Math.max(0, Math.min(100, value))
  const cd = useMemo(() => [{ name: label, value: cl, fill: cl >= 70 ? '#4ADE80' : cl >= 40 ? '#D97706' : '#C96A5A' }], [cl, label])
  if (value === 0 || isNaN(value)) return <div className={CARD}>{title && <p className="eyebrow mb-4">{title}</p>}<p className="text-[13px] text-[#7A6A60]">No data yet</p></div>
  return (
    <div className={CARD}>
      {title && <p className="eyebrow mb-4">{title}</p>}
      <div className="flex items-center gap-4">
        <div className="relative h-[120px] w-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" startAngle={180} endAngle={0} data={cd} barSize={10}>
              <RadialBar dataKey="value" cornerRadius={5} background={{ fill: '#F5F0EB' }} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center pt-3">
            <span className="text-[1.3rem] font-[600] text-[#2A1F1A]">{cl}%</span>
          </div>
        </div>
        <div>
          <p className="text-[13px] font-[600] text-[#2A1F1A]">{label}</p>
          <p className="text-[11px] text-[#7A6A60]">{cl >= 70 ? 'On track' : cl >= 40 ? 'Needs attention' : 'Below target'}</p>
        </div>
      </div>
    </div>
  )
}
