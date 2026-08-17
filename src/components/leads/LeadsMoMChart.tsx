'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LabelList,
} from 'recharts'
import { format, subMonths, startOfMonth, endOfMonth, addDays, addWeeks, startOfWeek, isBefore, isAfter } from 'date-fns'
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
function HubSpotMoMChart({ weekStart, title, actualLabel = 'Actual Leads', goalLabel = 'Goal Leads' }: { weekStart: string; title: string; actualLabel?: string; goalLabel?: string }) {
  const [chartData, setChartData] = useState<{ month: string; [key: string]: string | number }[]>([])
  const [loading, setLoading] = useState(true)

  const monthsConfig = useMemo(() => {
    const selected = new Date(weekStart + 'T00:00:00')
    const months: { label: string; start: string; end: string }[] = []
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(startOfMonth(selected), i)
      const monthKey = format(m, 'yyyy-MM')
      if (monthKey < '2026-03') continue
      const mStart = format(m, 'yyyy-MM-dd')
      const mEnd = format(addDays(endOfMonth(m), 1), 'yyyy-MM-dd')
      months.push({ label: format(m, 'MMM yyyy'), start: mStart, end: mEnd })
    }
    return months
  }, [weekStart])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    async function fetchAll() {
      const promises = monthsConfig.map(async (m) => {
        try {
          const res = await fetch(`/api/hubspot/mqls?start=${m.start}&end=${m.end}&mode=all`)
          const data = await res.json()
          // Exclude Book a Demo forms and Agent Studio signups
          const excluded = (data.by_form_type?.['Book a Demo'] || 0) + 
                           (data.by_form_type?.['Email Form'] || 0) + 
                           (data.by_form_type?.['Pre-Built Agents'] || 0) +
                           (data.by_form_type?.['Agent Studio'] || 0)
          return { month: m.label, [actualLabel]: (data.total || 0) - excluded, [goalLabel]: 0 }
        } catch {
          return { month: m.label, [actualLabel]: 0, [goalLabel]: 0 }
        }
      })
      const results = await Promise.all(promises)
      if (!cancelled) { setChartData(results); setLoading(false) }
    }
    fetchAll()
    return () => { cancelled = true }
  }, [monthsConfig, actualLabel, goalLabel])

  const hasData = chartData.some(d => (d[actualLabel] as number) > 0)

  if (loading) return <div className={CARD}><p className="eyebrow mb-4">{title}</p><p className="text-[13px] text-[#7A6A60]">Loading from HubSpot…</p></div>
  if (!hasData) return <div className={CARD}><p className="eyebrow mb-4">{title}</p><p className="text-[13px] text-[#7A6A60]">No data yet</p></div>

  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 30, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={fmtY} domain={['auto', (dataMax: number) => Math.ceil(dataMax * 1.12)]} />
          <Tooltip content={<Tip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#7A6A60', paddingTop: 8 }} />
          <Line type="monotone" dataKey={actualLabel} stroke="#6B4C4C" strokeWidth={2.5} dot={{ r: 5, fill: '#6B4C4C', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}>
            <LabelList dataKey={actualLabel} position="top" style={{ fontSize: 10, fill: '#6B4C4C', fontWeight: 600 }} formatter={(v: number) => v > 0 ? v.toLocaleString() : ''} />
          </Line>
          {chartData.some(d => (d[goalLabel] as number) > 0) && (
            <Line type="monotone" dataKey={goalLabel} stroke="#C96A5A" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 4, fill: '#C96A5A', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// Firestore-powered version (for all other pages)
function weekKeysForMonth(year: number, month: number): string[] {
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0)
  const keys: string[] = []
  let cursor = startOfWeek(monthStart, { weekStartsOn: 1 })
  if (isBefore(cursor, monthStart)) cursor = addWeeks(cursor, 1)
  while (!isAfter(cursor, monthEnd)) { keys.push(format(cursor, 'yyyy-MM-dd')); cursor = addWeeks(cursor, 1) }
  return keys
}

function FirestoreMoMChart({ sectionKey, weekStart, actualKey, goalKey, title, actualLabel = 'Actual', goalLabel = 'Goal' }: Props) {
  const monthsConfig = useMemo(() => {
    const selected = new Date(weekStart + 'T00:00:00')
    const months: { label: string; weekKeys: string[] }[] = []
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(startOfMonth(selected), i)
      const monthKey = format(m, 'yyyy-MM')
      if (monthKey < '2026-03') continue
      months.push({ label: format(m, 'MMM yyyy'), weekKeys: weekKeysForMonth(m.getFullYear(), m.getMonth()) })
    }
    return months
  }, [weekStart])

  const allWeekKeys = useMemo(() => {
    const set = new Set<string>()
    monthsConfig.forEach(m => m.weekKeys.forEach(wk => set.add(wk)))
    return [...set].sort()
  }, [monthsConfig])

  const padded = useMemo(() => { const p = [...allWeekKeys]; while (p.length < 28) p.push(p[p.length - 1] || weekStart); return p }, [allWeekKeys, weekStart])

  const w00 = useWeeklyMetrics(sectionKey, padded[0]); const w01 = useWeeklyMetrics(sectionKey, padded[1])
  const w02 = useWeeklyMetrics(sectionKey, padded[2]); const w03 = useWeeklyMetrics(sectionKey, padded[3])
  const w04 = useWeeklyMetrics(sectionKey, padded[4]); const w05 = useWeeklyMetrics(sectionKey, padded[5])
  const w06 = useWeeklyMetrics(sectionKey, padded[6]); const w07 = useWeeklyMetrics(sectionKey, padded[7])
  const w08 = useWeeklyMetrics(sectionKey, padded[8]); const w09 = useWeeklyMetrics(sectionKey, padded[9])
  const w10 = useWeeklyMetrics(sectionKey, padded[10]); const w11 = useWeeklyMetrics(sectionKey, padded[11])

  const allW = [w00,w01,w02,w03,w04,w05,w06,w07,w08,w09,w10,w11]

  const weekDataMap = useMemo(() => {
    const map: Record<string, Record<string, { value: string }>> = {}
    padded.slice(0, 12).forEach((wk, i) => { if (!map[wk]) map[wk] = allW[i].data })
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [padded, w00.data,w01.data,w02.data,w03.data,w04.data,w05.data,w06.data,w07.data,w08.data,w09.data,w10.data,w11.data])

  const chartData = useMemo(() => {
    return monthsConfig.map(({ label, weekKeys }) => {
      let totalActual = 0, totalGoal = 0
      weekKeys.forEach(wk => {
        const d = weekDataMap[wk]
        if (d) {
          const a = parseFloat(d[actualKey]?.value ?? ''); if (!isNaN(a)) totalActual += a
          const g = parseFloat(d[goalKey]?.value ?? ''); if (!isNaN(g)) totalGoal += g
        }
      })
      return { month: label, [actualLabel]: totalActual, [goalLabel]: totalGoal }
    })
  }, [monthsConfig, weekDataMap, actualKey, goalKey, actualLabel, goalLabel])

  const hasData = chartData.some(d => (d[actualLabel] as number) > 0 || (d[goalLabel] as number) > 0)

  if (!hasData) return <div className={CARD}><p className="eyebrow mb-4">{title}</p><p className="text-[13px] text-[#7A6A60]">No data yet</p></div>

  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 30, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={fmtY} domain={['auto', (dataMax: number) => Math.ceil(dataMax * 1.12)]} />
          <Tooltip content={<Tip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#7A6A60', paddingTop: 8 }} />
          <Line type="monotone" dataKey={actualLabel} stroke="#6B4C4C" strokeWidth={2.5} dot={{ r: 5, fill: '#6B4C4C', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}>
            <LabelList dataKey={actualLabel} position="top" style={{ fontSize: 10, fill: '#6B4C4C', fontWeight: 600 }} formatter={(v: number) => v > 0 ? v.toLocaleString() : ''} />
          </Line>
          <Line type="monotone" dataKey={goalLabel} stroke="#C96A5A" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 4, fill: '#C96A5A', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// Main export — routes to HubSpot or Firestore based on sectionKey
export function LeadsMoMChart(props: Props) {
  if (props.sectionKey === 'leads' && props.actualKey === 'leads_total') {
    return <HubSpotMoMChart weekStart={props.weekStart} title={props.title} actualLabel={props.actualLabel} goalLabel={props.goalLabel} />
  }
  return <FirestoreMoMChart {...props} />
}
