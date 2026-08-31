'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'
import { MetricBadge } from './MetricBadge'
import type { Cohort } from './CohortFunnelTable'

const TICK = { fontSize: 11, fill: '#7A6A60' }
const GRID = { strokeDasharray: '3 3', stroke: '#D4CBC0', strokeOpacity: 0.5, vertical: false as const }

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0)
  return (
    <div className="rounded-[14px] border border-[#D4CBC0] bg-white/95 px-4 py-3 shadow-[0_8px_32px_rgba(40,20,10,.10)]">
      <p className="eyebrow mb-2">{label} · {total.toLocaleString()} Opportunities (fixed)</p>
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

export function OpportunityCohortOutcomeChart({ cohorts, loading }: { cohorts: Cohort[]; loading: boolean }) {
  const data = cohorts.map(c => ({
    label: c.label,
    Won: c.opportunityCohort.won,
    'Still Open': c.opportunityCohort.stillOpen,
    Lost: c.opportunityCohort.lost,
  }))

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Opportunity Cohort Outcome</span>
        <MetricBadge kind="cohort" />
      </div>
      <p className="card-note mb-3">Of each month's Book-a-Demo cohort, contacts currently at Opportunity stage or beyond — split Won/Still Open/Lost. Same cohort as the funnel table above; Lost is detected via each contact's associated deal, since HubSpot doesn't revert lifecycle stage when a deal is lost.</p>
      {loading ? (
        <p className="text-[13px] text-[#7A6A60]">Loading…</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
            <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<Tip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Won" stackId="opp" fill="#3E7A55" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Still Open" stackId="opp" fill="#B9822E" />
            <Bar dataKey="Lost" stackId="opp" fill="#BE4A3C" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
