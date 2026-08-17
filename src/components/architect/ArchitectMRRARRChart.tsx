'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { format, subMonths, startOfMonth, addWeeks, startOfWeek, isBefore, isAfter } from 'date-fns'
import { useWeeklyMetrics } from '@/hooks/useWeeklyMetrics'

const CARD = 'rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]'
const TICK = { fontSize: 11, fill: '#7A6A60' }
const GRID = { strokeDasharray: '3 3', stroke: '#D4CBC0', strokeOpacity: 0.5, vertical: false as const }
const fmtY = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`)

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[14px] border border-[#D4CBC0] bg-white/95 px-4 py-3 shadow-[0_8px_32px_rgba(40,20,10,.10)]">
      <p className="eyebrow mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-[13px] text-[#2A1F1A]">
          <span className="h-2 w-2 rounded-full" style={{ background: p.fill }} />
          <span className="text-[#7A6A60]">{p.name}:</span>
          <span className="font-[600]">${typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  )
}

function weekKeysForMonth(year: number, month: number): string[] {
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0)
  const keys: string[] = []
  let cursor = startOfWeek(monthStart, { weekStartsOn: 1 })
  if (isBefore(cursor, monthStart)) cursor = addWeeks(cursor, 1)
  while (!isAfter(cursor, monthEnd)) {
    keys.push(format(cursor, 'yyyy-MM-dd'))
    cursor = addWeeks(cursor, 1)
  }
  return keys
}

type Props = { sectionKey: string; weekStart: string }

export function ArchitectMRRARRChart({ sectionKey, weekStart }: Props) {
  const monthsConfig = useMemo(() => {
    const DATA_START_MONTH = '2026-03' // Start from March 2026
    const selected = new Date(weekStart + 'T00:00:00')
    const months: { label: string; weekKeys: string[] }[] = []
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(startOfMonth(selected), i)
      const monthKey = format(m, 'yyyy-MM')
      if (monthKey >= DATA_START_MONTH) {
        months.push({ label: format(m, 'MMM'), weekKeys: weekKeysForMonth(m.getFullYear(), m.getMonth()) })
      }
    }
    return months
  }, [weekStart])

  const allWeekKeys = useMemo(() => {
    const set = new Set<string>()
    monthsConfig.forEach(m => m.weekKeys.forEach(wk => set.add(wk)))
    return [...set].sort()
  }, [monthsConfig])

  const padded = useMemo(() => {
    const p = [...allWeekKeys]
    while (p.length < 28) p.push(p[p.length - 1] || weekStart)
    return p
  }, [allWeekKeys, weekStart])

  // 28 fixed hooks
  const w00 = useWeeklyMetrics(sectionKey, padded[0])
  const w01 = useWeeklyMetrics(sectionKey, padded[1])
  const w02 = useWeeklyMetrics(sectionKey, padded[2])
  const w03 = useWeeklyMetrics(sectionKey, padded[3])
  const w04 = useWeeklyMetrics(sectionKey, padded[4])
  const w05 = useWeeklyMetrics(sectionKey, padded[5])
  const w06 = useWeeklyMetrics(sectionKey, padded[6])
  const w07 = useWeeklyMetrics(sectionKey, padded[7])
  const w08 = useWeeklyMetrics(sectionKey, padded[8])
  const w09 = useWeeklyMetrics(sectionKey, padded[9])
  const w10 = useWeeklyMetrics(sectionKey, padded[10])
  const w11 = useWeeklyMetrics(sectionKey, padded[11])
  const w12 = useWeeklyMetrics(sectionKey, padded[12])
  const w13 = useWeeklyMetrics(sectionKey, padded[13])
  const w14 = useWeeklyMetrics(sectionKey, padded[14])
  const w15 = useWeeklyMetrics(sectionKey, padded[15])
  const w16 = useWeeklyMetrics(sectionKey, padded[16])
  const w17 = useWeeklyMetrics(sectionKey, padded[17])
  const w18 = useWeeklyMetrics(sectionKey, padded[18])
  const w19 = useWeeklyMetrics(sectionKey, padded[19])
  const w20 = useWeeklyMetrics(sectionKey, padded[20])
  const w21 = useWeeklyMetrics(sectionKey, padded[21])
  const w22 = useWeeklyMetrics(sectionKey, padded[22])
  const w23 = useWeeklyMetrics(sectionKey, padded[23])
  const w24 = useWeeklyMetrics(sectionKey, padded[24])
  const w25 = useWeeklyMetrics(sectionKey, padded[25])
  const w26 = useWeeklyMetrics(sectionKey, padded[26])
  const w27 = useWeeklyMetrics(sectionKey, padded[27])

  const allW = [w00,w01,w02,w03,w04,w05,w06,w07,w08,w09,w10,w11,w12,w13,w14,w15,w16,w17,w18,w19,w20,w21,w22,w23,w24,w25,w26,w27]

  const weekDataMap = useMemo(() => {
    const map: Record<string, Record<string, { value: string }>> = {}
    padded.forEach((wk, i) => { if (!map[wk]) map[wk] = allW[i].data })
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [padded, w00.data,w01.data,w02.data,w03.data,w04.data,w05.data,w06.data,w07.data,w08.data,w09.data,w10.data,w11.data,w12.data,w13.data,w14.data,w15.data,w16.data,w17.data,w18.data,w19.data,w20.data,w21.data,w22.data,w23.data,w24.data,w25.data,w26.data,w27.data])

  // For MRR/ARR, take the LAST week's value in each month (latest snapshot)
  const chartData = useMemo(() => monthsConfig.map(({ label, weekKeys }) => {
    let mrr = 0, goalMrr = 0, arr = 0, goalArr = 0
    // Use last week in month as the snapshot
    const lastWk = weekKeys[weekKeys.length - 1]
    if (lastWk) {
      const d = weekDataMap[lastWk]
      if (d) {
        const m = parseFloat(d['mrr']?.value ?? ''); if (!isNaN(m)) mrr = m
        const gm = parseFloat(d['goal_mrr']?.value ?? ''); if (!isNaN(gm)) goalMrr = gm
        const a = parseFloat(d['arr']?.value ?? ''); if (!isNaN(a)) arr = a
        const ga = parseFloat(d['goal_arr']?.value ?? ''); if (!isNaN(ga)) goalArr = ga
      }
    }
    return { month: label, 'MRR Actual': mrr, 'MRR Goal': goalMrr, 'ARR Actual': arr, 'ARR Goal': goalArr }
  }), [monthsConfig, weekDataMap])

  const hasMRR = chartData.some(d => d['MRR Actual'] > 0 || d['MRR Goal'] > 0)
  const hasARR = chartData.some(d => d['ARR Actual'] > 0 || d['ARR Goal'] > 0)

  if (!hasMRR && !hasARR) return <div className={CARD}><p className="eyebrow mb-4">MoM — MRR & ARR</p><p className="text-[13px] text-[#7A6A60]">No data yet</p></div>

  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">MoM — MRR & ARR Goals vs Actuals</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={fmtY} />
          <Tooltip content={<Tip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#7A6A60', paddingTop: 8 }} />
          {hasMRR && <Bar dataKey="MRR Actual" fill="#16A34A" radius={[4, 4, 0, 0]} barSize={16} />}
          {hasMRR && <Bar dataKey="MRR Goal" fill="#BBF7D0" radius={[4, 4, 0, 0]} barSize={16} />}
          {hasARR && <Bar dataKey="ARR Actual" fill="#D97706" radius={[4, 4, 0, 0]} barSize={16} />}
          {hasARR && <Bar dataKey="ARR Goal" fill="#FDE68A" radius={[4, 4, 0, 0]} barSize={16} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
