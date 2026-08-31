'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList,
} from 'recharts'
import { format, subWeeks, addWeeks } from 'date-fns'

const CARD = 'rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]'
const TICK = { fontSize: 11, fill: '#7A6A60' }
const GRID = { strokeDasharray: '3 3', stroke: '#D4CBC0', strokeOpacity: 0.5, vertical: false as const }

// Matches PRIORITY_COLORS in MQLHubSpotData.tsx's "By Priority" bar chart, for visual consistency.
const PRIORITY_CONFIG = {
  high:   { label: 'High Priority',   field: 'high_priority',   color: '#DC2626' },
  medium: { label: 'Medium Priority', field: 'medium_priority', color: '#D97706' },
  low:    { label: 'Low Priority',    field: 'low_priority',    color: '#2563EB' },
} as const

function Tip({ active, payload, label, color }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[14px] border border-[#D4CBC0] bg-white/95 px-4 py-3 shadow-[0_8px_32px_rgba(40,20,10,.10)]">
      <p className="eyebrow mb-2">{label}</p>
      <div className="flex items-center gap-2 text-[13px] text-[#2A1F1A]">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <span className="text-[#7A6A60]">MQLs:</span>
        <span className="font-[600]">{payload[0]?.value?.toLocaleString?.() ?? payload[0]?.value}</span>
      </div>
    </div>
  )
}

type Props = {
  sectionKey: string
  weekStart: string
  priority: keyof typeof PRIORITY_CONFIG
}

export function MQLPriorityTrendChart({ weekStart, priority }: Props) {
  const cfg = PRIORITY_CONFIG[priority]

  // Build 8 week keys (vs. 6 for the other WoW charts — explicitly asked for an 8-week view here)
  const weekKeys = useMemo(() => {
    const DATA_START = '2026-03-02' // Start from March
    const r: string[] = []
    const base = new Date(weekStart + 'T00:00:00')
    for (let i = 7; i >= 0; i--) {
      const wk = format(subWeeks(base, i), 'yyyy-MM-dd')
      if (wk >= DATA_START) r.push(wk)
    }
    return r
  }, [weekStart])

  const [chartData, setChartData] = useState<{ week: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function fetchAll() {
      const promises = weekKeys.map(async (wk) => {
        const end = format(addWeeks(new Date(wk + 'T00:00:00'), 1), 'yyyy-MM-dd')
        try {
          const res = await fetch(`/api/hubspot/mqls?start=${wk}&end=${end}&nocache=1`)
          const data = await res.json()
          return { week: format(new Date(wk + 'T00:00:00'), 'MMM d'), count: data[cfg.field] || 0 }
        } catch {
          return { week: format(new Date(wk + 'T00:00:00'), 'MMM d'), count: 0 }
        }
      })

      const results = await Promise.all(promises)
      if (!cancelled) {
        setChartData(results)
        setLoading(false)
      }
    }

    fetchAll()
    return () => { cancelled = true }
  }, [weekKeys, cfg.field])

  const hasData = chartData.some(d => d.count > 0)

  if (loading) {
    return (
      <div className={CARD}>
        <p className="eyebrow mb-4">8-Week Trend — {cfg.label} MQLs</p>
        <p className="text-[13px] text-[#7A6A60]">Loading from HubSpot…</p>
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className={CARD}>
        <p className="eyebrow mb-4">8-Week Trend — {cfg.label} MQLs</p>
        <p className="text-[13px] text-[#7A6A60]">No data yet</p>
      </div>
    )
  }

  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">8-Week Trend — {cfg.label} MQLs</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 26, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="week" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} domain={['auto', (dataMax: number) => Math.ceil(dataMax * 1.15) || 1]} />
          <Tooltip content={<Tip color={cfg.color} />} />
          <Line
            type="monotone"
            dataKey="count"
            name={`${cfg.label} MQLs`}
            stroke={cfg.color}
            strokeWidth={2.5}
            dot={{ r: 5, fill: cfg.color, strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}
          >
            <LabelList dataKey="count" position="top" style={{ fontSize: 10, fill: cfg.color, fontWeight: 600 }} formatter={(v: number) => v > 0 ? v.toLocaleString() : ''} />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
