'use client'

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, LabelList,
  ResponsiveContainer,
} from 'recharts'
import { MetricBadge } from './MetricBadge'
import type { Cohort } from './CohortFunnelTable'

const TICK = { fontSize: 11, fill: '#7A6A60' }
const GRID = { strokeDasharray: '3 3', stroke: '#D4CBC0', strokeOpacity: 0.5, vertical: false as const }

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[14px] border border-[#D4CBC0] bg-white/95 px-4 py-3 shadow-[0_8px_32px_rgba(40,20,10,.10)]">
      <p className="eyebrow mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-[13px] text-[#2A1F1A]">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.stroke }} />
          <span className="font-[600]">{typeof p.value === 'number' ? `${p.value.toFixed(0)}%` : '—'}</span>
        </div>
      ))}
    </div>
  )
}

function TrendLine({ title, dataKey, color, data, loading }: {
  title: string; dataKey: string; color: string; data: any[]; loading: boolean
}) {
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">{title}</span>
        <MetricBadge kind="cohort" />
      </div>
      {loading ? (
        <p className="text-[13px] text-[#7A6A60]">Loading…</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 26, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" tick={TICK} axisLine={false} tickLine={false} />
            <YAxis tick={TICK} axisLine={false} tickLine={false} unit="%" domain={[0, (max: number) => Math.ceil((max || 10) * 1.2)]} />
            <Tooltip content={<Tip />} />
            <Line
              type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5}
              dot={{ r: 5, fill: color, strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 7 }}
            >
              <LabelList dataKey={dataKey} position="top" style={{ fontSize: 10, fill: color, fontWeight: 600 }} formatter={(v: number) => v != null ? `${v.toFixed(0)}%` : ''} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export function ConversionTrendCharts({ cohorts, loading }: { cohorts: Cohort[]; loading: boolean }) {
  const data = cohorts.map(c => ({
    label: c.label,
    mqlToSql: c.mqlToSql.pct,
    sqlToOpp: c.sqlToOpportunity.pct,
    oppToCustomer: c.opportunityToCustomer.pct,
  }))

  return (
    <div className="row-3">
      <TrendLine title="MQL → SQL Trend" dataKey="mqlToSql" color="#4A7C7C" data={data} loading={loading} />
      <TrendLine title="SQL → Opportunity Trend" dataKey="sqlToOpp" color="#C96A5A" data={data} loading={loading} />
      <TrendLine title="Opportunity → Customer Trend" dataKey="oppToCustomer" color="#3E7A55" data={data} loading={loading} />
    </div>
  )
}
