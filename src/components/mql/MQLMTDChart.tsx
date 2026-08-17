'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LabelList,
} from 'recharts'
import { format, subMonths, startOfMonth, endOfMonth, addDays } from 'date-fns'
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

export function MQLMTDChart({ sectionKey, weekStart }: Props) {
  const [chartData, setChartData] = useState<{ month: string; 'Actual MQLs': number; 'Goal MQLs': number }[]>([])
  const [loading, setLoading] = useState(true)
  const [monthlyGoal, setMonthlyGoal] = useState<number>(400)

  const monthsConfig = useMemo(() => {
    const selected = new Date(weekStart + 'T00:00:00')
    const months: { label: string; start: string; end: string }[] = []
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(startOfMonth(selected), i)
      const monthKey = format(m, 'yyyy-MM')
      if (monthKey < '2026-03') continue // Only show from March 2026
      const mStart = format(m, 'yyyy-MM-dd')
      const mEnd = format(addDays(endOfMonth(m), 1), 'yyyy-MM-dd')
      months.push({ label: format(m, 'MMM yyyy'), start: mStart, end: mEnd })
    }
    return months
  }, [weekStart])

  // Load monthly goal from Firestore
  useEffect(() => {
    const db = getDb()
    getDoc(doc(db, 'goals', 'current'))
      .then(snap => {
        if (snap.exists()) {
          const data = snap.data()
          const val = parseFloat(data.monthly_mqls)
          if (!isNaN(val) && val > 0) {
            setMonthlyGoal(val)
          }
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function fetchAll() {
      // Fetch all months in parallel
      const promises = monthsConfig.map(async (m) => {
        try {
          const res = await fetch(`/api/hubspot/mqls?start=${m.start}&end=${m.end}`)
          const data = await res.json()
          return { month: m.label, 'Actual MQLs': data.total || 0, 'Goal MQLs': monthlyGoal }
        } catch {
          return { month: m.label, 'Actual MQLs': 0, 'Goal MQLs': monthlyGoal }
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
  }, [monthsConfig, monthlyGoal])

  const hasData = chartData.some(d => d['Actual MQLs'] > 0)

  if (loading) {
    return (
      <div className={CARD}>
        <p className="eyebrow mb-4">MoM Trend — MQLs Goals vs Actuals</p>
        <p className="text-[13px] text-[#7A6A60]">Loading from HubSpot…</p>
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className={CARD}>
        <p className="eyebrow mb-4">MoM Trend — MQLs Goals vs Actuals</p>
        <p className="text-[13px] text-[#7A6A60]">No data yet — enter MQL numbers to see the monthly trend</p>
      </div>
    )
  }

  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">MoM Trend — MQLs Goals vs Actuals</p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 30, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
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
            stroke="#C96A5A"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={{ r: 4, fill: '#C96A5A', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
