'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
  ResponsiveContainer, Cell,
} from 'recharts'
import { MetricBadge } from './MetricBadge'

const TICK = { fontSize: 11, fill: '#7A6A60' }
const GRID = { strokeDasharray: '3 3', stroke: '#D4CBC0', strokeOpacity: 0.5, vertical: false as const }
const COLORS = ['#6B4C4C', '#8A6152', '#C96A5A', '#B9822E', '#3D5A8C', '#4A7C7C', '#6B4C8C', '#8B8074']

const fmtMoney = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n}`

function Tip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]?.payload
  if (!p) return null
  return (
    <div className="rounded-[14px] border border-[#D4CBC0] bg-white/95 px-4 py-3 shadow-[0_8px_32px_rgba(40,20,10,.10)]">
      <p className="eyebrow mb-2">{p.stage}</p>
      <p className="text-[13px] text-[#2A1F1A]"><span className="text-[#7A6A60]">Value:</span> <span className="font-[600]">{fmtMoney(p.value)}</span></p>
      <p className="text-[13px] text-[#2A1F1A]"><span className="text-[#7A6A60]">Deals:</span> <span className="font-[600]">{p.count}</span></p>
    </div>
  )
}

export function PipelineStageDistributionChart({
  stageDistribution, loading,
}: {
  stageDistribution: Array<{ stage: string; count: number; value: number }>
  loading: boolean
}) {
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Current Pipeline Stage Distribution</span>
        <MetricBadge kind="snapshot" />
      </div>
      {loading ? (
        <p className="text-[13px] text-[#7A6A60]">Loading…</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={stageDistribution} margin={{ top: 20, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="stage" tick={TICK} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={60} />
            <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={fmtMoney} />
            <Tooltip content={<Tip />} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {stageDistribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              <LabelList dataKey="count" position="top" formatter={(v: number) => `${v}`} style={{ fontSize: 10, fill: '#7A6A60', fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
