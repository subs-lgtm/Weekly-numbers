'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LabelList,
} from 'recharts'
import { format, subWeeks, addWeeks } from 'date-fns'
import { getDb } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

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
  sectionKey: string
  weekStart: string
}

export function MQLWoWChart({ sectionKey, weekStart }: Props) {
  // Build 6 week keys
  const weekKeys = useMemo(() => {
    const DATA_START = '2026-03-02' // Start from March
    const r: string[] = []
    const base = new Date(weekStart + 'T00:00:00')
    for (let i = 5; i >= 0; i--) {
      const wk = format(subWeeks(base, i), 'yyyy-MM-dd')
      if (wk >= DATA_START) r.push(wk)
    }
    return r
  }, [weekStart])

  const [chartData, setChartData] = useState<{ week: string; 'Actual MQLs': number; 'Goal MQLs': number }[]>([])
  const [loading, setLoading] = useState(true)
  const [weeklyGoal, setWeeklyGoal] = useState<number>(100)

  // Load weekly goal from Firestore
  useEffect(() => {
    const db = getDb()
    getDoc(doc(db, 'goals', 'current'))
      .then(snap => {
        if (snap.exists()) {
          const data = snap.data()
          const val = parseFloat(data.weekly_mqls)
          if (!isNaN(val) && val > 0) {
            setWeeklyGoal(val)
          }
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function fetchAll() {
      // Fetch all weeks in parallel
      const promises = weekKeys.map(async (wk) => {
        const end = format(addWeeks(new Date(wk + 'T00:00:00'), 1), 'yyyy-MM-dd')
        try {
          const res = await fetch(`/api/hubspot/mqls?start=${wk}&end=${end}&nocache=1`)
          const data = await res.json()
          return {
            week: format(new Date(wk + 'T00:00:00'), 'MMM d'),
            'Actual MQLs': data.total || 0,
            'Goal MQLs': weeklyGoal,
          }
        } catch {
          return { week: format(new Date(wk + 'T00:00:00'), 'MMM d'), 'Actual MQLs': 0, 'Goal MQLs': weeklyGoal }
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
  }, [weekKeys, weeklyGoal])

  const hasData = chartData.some(d => d['Actual MQLs'] > 0)

  if (loading) {
    return (
      <div className={CARD}>
        <p className="eyebrow mb-4">WoW Trend — MQLs Goals vs Actuals</p>
        <p className="text-[13px] text-[#7A6A60]">Loading from HubSpot…</p>
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className={CARD}>
        <p className="eyebrow mb-4">WoW Trend — MQLs Goals vs Actuals</p>
        <p className="text-[13px] text-[#7A6A60]">No data yet — enter MQL numbers to see the trend</p>
      </div>
    )
  }

  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">WoW Trend — MQLs Goals vs Actuals</p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 30, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="week" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={fmtY} domain={['auto', (dataMax: number) => Math.ceil(dataMax * 1.12)]} />
          <Tooltip content={<Tip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#7A6A60', paddingTop: 8 }} />
          <Line
            type="monotone"
            dataKey="Actual MQLs"
            stroke="#6B4C4C"
            strokeWidth={2.5}
            dot={{ r: 5, fill: '#6B4C4C', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}
          >
            <LabelList dataKey="Actual MQLs" position="top" style={{ fontSize: 10, fill: '#6B4C4C', fontWeight: 600 }} formatter={(v: number) => v > 0 ? v.toLocaleString() : ''} />
          </Line>
          <Line
            type="monotone"
            dataKey="Goal MQLs"
            stroke="#D4CBC0"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={{ r: 4, fill: '#D4CBC0', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
