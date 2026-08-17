'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LabelList,
} from 'recharts'
import { format, subWeeks, addWeeks } from 'date-fns'

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
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.stroke }} />
          <span className="text-[#7A6A60]">{p.name}:</span>
          <span className="font-[600]">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  )
}

type Props = {
  weekStart: string
  title: string
  actualLabel?: string
}

// HubSpot-powered — same pattern as LeadsWoWChart's HubSpotWoWChart, but tracks
// only the Agent Studio form-type count instead of excluding it.
export function AgentStudioWoWChart({ weekStart, title, actualLabel = 'Studio Leads' }: Props) {
  const weekKeys = useMemo(() => {
    const DATA_START = '2026-03-03'
    const r: string[] = []
    const base = new Date(weekStart + 'T00:00:00')
    for (let i = 5; i >= 0; i--) {
      const wk = format(subWeeks(base, i), 'yyyy-MM-dd')
      if (wk >= DATA_START) r.push(wk)
    }
    return r
  }, [weekStart])

  const [chartData, setChartData] = useState<{ week: string; [key: string]: string | number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    async function fetchAll() {
      const promises = weekKeys.map(async (wk) => {
        const end = format(addWeeks(new Date(wk + 'T00:00:00'), 1), 'yyyy-MM-dd')
        try {
          const res = await fetch(`/api/hubspot/mqls?start=${wk}&end=${end}&mode=all`)
          const data = await res.json()
          return { week: format(new Date(wk + 'T00:00:00'), 'MMM d'), [actualLabel]: data.by_form_type?.['Agent Studio'] || 0 }
        } catch {
          return { week: format(new Date(wk + 'T00:00:00'), 'MMM d'), [actualLabel]: 0 }
        }
      })
      const results = await Promise.all(promises)
      if (!cancelled) { setChartData(results); setLoading(false) }
    }
    fetchAll()
    return () => { cancelled = true }
  }, [weekKeys, actualLabel])

  const hasData = chartData.some(d => (d[actualLabel] as number) > 0)

  if (loading) return <div className={CARD}><p className="eyebrow mb-4">{title}</p><p className="text-[13px] text-[#7A6A60]">Loading from HubSpot…</p></div>
  if (!hasData) return <div className={CARD}><p className="eyebrow mb-4">{title}</p><p className="text-[13px] text-[#7A6A60]">No data yet</p></div>

  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 30, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="week" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={fmtY} domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.12)]} />
          <Tooltip content={<Tip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#7A6A60', paddingTop: 8 }} />
          <Line type="monotone" dataKey={actualLabel} stroke="#6B4C4C" strokeWidth={2.5} dot={{ r: 5, fill: '#6B4C4C', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}>
            <LabelList dataKey={actualLabel} position="top" style={{ fontSize: 10, fill: '#6B4C4C', fontWeight: 600 }} formatter={(v: number) => v > 0 ? v.toLocaleString() : ''} />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
