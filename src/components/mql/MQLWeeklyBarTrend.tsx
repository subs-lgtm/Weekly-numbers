'use client'

/**
 * MQLWeeklyBarTrend
 *
 * Bar-chart variant of the weekly MQL trend — matches the reference HTML's
 * "8-Week MQL Trend" section (div-based bar-chart, color-coded green when the
 * week hit the weekly goal, red/rose when it missed).
 *
 * Reuses the same /api/hubspot/mqls per-week fetch pattern as MQLWoWChart,
 * kept as a separate component since the reference uses a plain bar chart
 * here (not the recharts line chart already used elsewhere on the page).
 */

import { useEffect, useMemo, useState } from 'react'
import { format, subWeeks, addWeeks } from 'date-fns'

type Props = { weekStart: string; weeklyGoal?: number }

export function MQLWeeklyBarTrend({ weekStart, weeklyGoal = 100 }: Props) {
  const weekKeys = useMemo(() => {
    const DATA_START = '2026-03-02'
    const r: string[] = []
    const base = new Date(weekStart + 'T00:00:00')
    for (let i = 7; i >= 0; i--) {
      const wk = format(subWeeks(base, i), 'yyyy-MM-dd')
      if (wk >= DATA_START) r.push(wk)
    }
    return r
  }, [weekStart])

  const [bars, setBars] = useState<{ label: string; value: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all(weekKeys.map(async wk => {
      const end = format(addWeeks(new Date(wk + 'T00:00:00'), 1), 'yyyy-MM-dd')
      try {
        const res = await fetch(`/api/hubspot/mqls?start=${wk}&end=${end}`)
        const data = await res.json()
        return { label: format(new Date(wk + 'T00:00:00'), 'MMM d'), value: data.total || 0 }
      } catch {
        return { label: format(new Date(wk + 'T00:00:00'), 'MMM d'), value: 0 }
      }
    })).then(results => { if (!cancelled) { setBars(results); setLoading(false) } })
    return () => { cancelled = true }
  }, [weekKeys])

  const maxVal = Math.max(...bars.map(b => b.value), weeklyGoal, 1)

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">8-Week MQL Trend</span>
        <span className="card-note">Actual vs. weekly goal of {weeklyGoal}</span>
      </div>
      {loading ? (
        <p className="text-[13px] text-[#7A6A60]">Loading from HubSpot…</p>
      ) : (
        <div className="bar-chart">
          {bars.map(b => {
            const heightPct = Math.max((b.value / maxVal) * 100, b.value > 0 ? 3 : 0)
            const pctOfGoal = weeklyGoal > 0 ? b.value / weeklyGoal : 0
            const color = pctOfGoal >= 1 ? '#3E7A55' : pctOfGoal < 0.7 ? '#BE4A3C' : '#D9A390'
            return (
              <div className="bar-col" key={b.label}>
                <div className="bar-val">{b.value}</div>
                <div className="bar" style={{ height: `${heightPct}%`, background: color }} />
                <div className="bar-lbl">{b.label}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
