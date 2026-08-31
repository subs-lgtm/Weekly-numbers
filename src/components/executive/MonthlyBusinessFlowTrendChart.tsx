'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { MetricBadge } from './MetricBadge'

export type FlowTrendPoint = {
  month: string
  label: string
  mqlsCreated: number
  sqlsCreated: number
  opportunitiesCreated: number
  customersWon: number
}

const TICK = { fontSize: 11, fill: '#7A6A60' }
const GRID = { strokeDasharray: '3 3', stroke: '#D4CBC0', strokeOpacity: 0.5, vertical: false as const }
const SERIES: Array<{ key: keyof FlowTrendPoint; name: string; color: string }> = [
  { key: 'mqlsCreated', name: 'MQLs Created', color: '#6B4C4C' },
  { key: 'sqlsCreated', name: 'SQLs Created', color: '#4A7C7C' },
  { key: 'opportunitiesCreated', name: 'Opportunities Created', color: '#C96A5A' },
  { key: 'customersWon', name: 'Customers Won', color: '#3E7A55' },
]

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[14px] border border-[#D4CBC0] bg-white/95 px-4 py-3 shadow-[0_8px_32px_rgba(40,20,10,.10)]">
      <p className="eyebrow mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-[13px] text-[#2A1F1A]">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-[#7A6A60]">{p.name}:</span>
          <span className="font-[600]">{p.value?.toLocaleString?.() ?? p.value}</span>
        </div>
      ))}
    </div>
  )
}

export function MonthlyBusinessFlowTrendChart({ points, loading }: { points: FlowTrendPoint[]; loading: boolean }) {
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Monthly Business Flow Trend</span>
        <MetricBadge kind="flow" />
      </div>
      {loading ? (
        <p className="text-[13px] text-[#7A6A60]">Loading…</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={points} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
            <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<Tip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {SERIES.map(s => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2.25}
                dot={{ r: 3.5, fill: s.color, strokeWidth: 1.5, stroke: '#fff' }}
                activeDot={{ r: 5.5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
