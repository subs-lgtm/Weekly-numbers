'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LabelList,
} from 'recharts'
import { format, subWeeks, addWeeks } from 'date-fns'
import { useWeeklyMetrics } from '@/hooks/useWeeklyMetrics'

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
  actualKey: string
  goalKey: string
  title: string
  actualLabel?: string
  goalLabel?: string
}

// HubSpot-powered version (only for leads page)
function HubSpotWoWChart({ weekStart, title, actualLabel = 'Actual Leads', goalLabel = 'Goal Leads' }: { weekStart: string; title: string; actualLabel?: string; goalLabel?: string }) {
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
          // Exclude Book a Demo forms and Agent Studio signups
          const excluded = (data.by_form_type?.['Book a Demo'] || 0) + 
                           (data.by_form_type?.['Email Form'] || 0) + 
                           (data.by_form_type?.['Pre-Built Agents'] || 0) +
                           (data.by_form_type?.['Agent Studio'] || 0)
          return { week: format(new Date(wk + 'T00:00:00'), 'MMM d'), [actualLabel]: (data.total || 0) - excluded, [goalLabel]: 0 }
        } catch {
          return { week: format(new Date(wk + 'T00:00:00'), 'MMM d'), [actualLabel]: 0, [goalLabel]: 0 }
        }
      })
      const results = await Promise.all(promises)
      if (!cancelled) { setChartData(results); setLoading(false) }
    }
    fetchAll()
    return () => { cancelled = true }
  }, [weekKeys, actualLabel, goalLabel])

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
          {chartData.some(d => (d[goalLabel] as number) > 0) && (
            <Line type="monotone" dataKey={goalLabel} stroke="#D4CBC0" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 4, fill: '#D4CBC0', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// Firestore-powered version (for all other pages)
function FirestoreWoWChart({ sectionKey, weekStart, actualKey, goalKey, title, actualLabel = 'Actual', goalLabel = 'Goal' }: Props) {
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

  const w0 = useWeeklyMetrics(sectionKey, weekKeys[0] ?? weekStart)
  const w1 = useWeeklyMetrics(sectionKey, weekKeys[1] ?? weekStart)
  const w2 = useWeeklyMetrics(sectionKey, weekKeys[2] ?? weekStart)
  const w3 = useWeeklyMetrics(sectionKey, weekKeys[3] ?? weekStart)
  const w4 = useWeeklyMetrics(sectionKey, weekKeys[4] ?? weekStart)
  const w5 = useWeeklyMetrics(sectionKey, weekKeys[5] ?? weekStart)
  const weeks = [w0, w1, w2, w3, w4, w5]

  const chartData = useMemo(() => {
    return weekKeys.map((wk, i) => {
      const d = weeks[i]?.data || {}
      const actual = parseFloat(d[actualKey]?.value ?? '')
      const goal = parseFloat(d[goalKey]?.value ?? '')
      return {
        week: format(new Date(wk + 'T00:00:00'), 'MMM d'),
        [actualLabel]: isNaN(actual) ? 0 : actual,
        [goalLabel]: isNaN(goal) ? 0 : goal,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKeys, w0.data, w1.data, w2.data, w3.data, w4.data, w5.data])

  const hasData = chartData.some(d => (d[actualLabel] as number) > 0 || (d[goalLabel] as number) > 0)

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
          <Line type="monotone" dataKey={goalLabel} stroke="#D4CBC0" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 4, fill: '#D4CBC0', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// Main export — routes to HubSpot or Firestore based on sectionKey
export function LeadsWoWChart(props: Props) {
  if (props.sectionKey === 'leads' && props.actualKey === 'leads_total') {
    return <HubSpotWoWChart weekStart={props.weekStart} title={props.title} actualLabel={props.actualLabel} goalLabel={props.goalLabel} />
  }
  return <FirestoreWoWChart {...props} />
}
