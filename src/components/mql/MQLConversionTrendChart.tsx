'use client'

/**
 * MQLConversionTrendChart
 *
 * MQL → SQL conversion % over the last 8 weeks — matches the reference HTML's
 * "Conversion Trend" section (raw SVG polyline chart, not recharts, to match
 * the exact reference visual style: viewBox 0 0 760 210 with 5 gridlines).
 */

import { useEffect, useMemo, useState } from 'react'
import { format, subWeeks, addWeeks } from 'date-fns'

type Props = { weekStart: string }

const VB_WIDTH = 760
const VB_HEIGHT = 210
const CHART_LEFT = 30
const CHART_RIGHT = 730
const CHART_TOP = 20
const CHART_BOTTOM = 190

export function MQLConversionTrendChart({ weekStart }: Props) {
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

  const [points, setPoints] = useState<{ label: string; pct: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all(weekKeys.map(async wk => {
      const end = format(addWeeks(new Date(wk + 'T00:00:00'), 1), 'yyyy-MM-dd')
      try {
        const res = await fetch(`/api/hubspot/mqls?start=${wk}&end=${end}`)
        const data = await res.json()
        const total = data.total || 0
        const sql = data.funnel?.sql || 0
        return { label: format(new Date(wk + 'T00:00:00'), 'MMM d'), pct: total > 0 ? Math.round((sql / total) * 100) : 0 }
      } catch {
        return { label: format(new Date(wk + 'T00:00:00'), 'MMM d'), pct: 0 }
      }
    })).then(results => { if (!cancelled) { setPoints(results); setLoading(false) } })
    return () => { cancelled = true }
  }, [weekKeys])

  const maxPct = Math.max(...points.map(p => p.pct), 10)

  const coords = points.map((p, i) => {
    const x = points.length > 1 ? CHART_LEFT + (i / (points.length - 1)) * (CHART_RIGHT - CHART_LEFT) : CHART_LEFT
    const y = CHART_BOTTOM - (p.pct / maxPct) * (CHART_BOTTOM - CHART_TOP)
    return { x, y, ...p }
  })

  const polyline = coords.map(c => `${c.x.toFixed(0)},${c.y.toFixed(0)}`).join(' ')

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Conversion Trend</span>
        <span className="card-note">MQL → SQL % over last 8 weeks</span>
      </div>
      {loading ? (
        <p className="text-[13px] text-[#7A6A60]">Loading from HubSpot…</p>
      ) : (
        <>
          <svg className="linechart" viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: 'auto', display: 'block' }}>
            <line x1={CHART_LEFT} y1="20" x2={CHART_RIGHT} y2="20" stroke="#EEE7DC" strokeWidth="1" />
            <line x1={CHART_LEFT} y1="67" x2={CHART_RIGHT} y2="67" stroke="#EEE7DC" strokeWidth="1" />
            <line x1={CHART_LEFT} y1="114" x2={CHART_RIGHT} y2="114" stroke="#EEE7DC" strokeWidth="1" />
            <line x1={CHART_LEFT} y1="161" x2={CHART_RIGHT} y2="161" stroke="#EEE7DC" strokeWidth="1" />
            <line x1={CHART_LEFT} y1={CHART_BOTTOM} x2={CHART_RIGHT} y2={CHART_BOTTOM} stroke="#E5DDD1" strokeWidth="1" />
            <polyline points={polyline} fill="none" stroke="#3D5A8C" strokeWidth="2.6" />
            <g fill="#3D5A8C">
              {coords.map(c => <circle key={c.label} cx={c.x} cy={c.y} r="3.2" />)}
            </g>
            <g fontFamily="DM Sans" fontSize="10" fill="#8B8074">
              {coords.map(c => <text key={c.label} x={c.x} y="204" textAnchor="middle">{c.label}</text>)}
            </g>
          </svg>
          <div className="legend"><span><i style={{ background: '#3D5A8C' }} />MQL → SQL %</span></div>
        </>
      )}
    </div>
  )
}
