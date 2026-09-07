'use client'

import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LabelList,
} from 'recharts'

const CARD = 'rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]'
const TICK = { fontSize: 11, fill: '#7A6A60' }
const GRID = { strokeDasharray: '3 3', stroke: '#D4CBC0', strokeOpacity: 0.5, vertical: false as const }
const fmtPct = (v: number) => `${v}%`

type DataPoint = {
  month: string
  'SQL → Opportunity %': number
  sql: number
  opportunity: number
}

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  const raw: DataPoint = p?.payload
  return (
    <div className="rounded-[14px] border border-[#D4CBC0] bg-white/95 px-4 py-3 shadow-[0_8px_32px_rgba(40,20,10,.10)] min-w-[190px]">
      <p className="eyebrow mb-2">{label}</p>
      <div className="flex items-center gap-2 text-[13px] text-[#2A1F1A]">
        <span className="h-2 w-2 rounded-full" style={{ background: '#C96A5A' }} />
        <span className="text-[#7A6A60]">Conversion:</span>
        <span className="font-[600]">{raw?.['SQL → Opportunity %']}%</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[12px] text-[#7A6A60]">
        <span className="ml-4">SQLs:</span>
        <span className="font-[500] text-[#2A1F1A]">{raw?.sql?.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-2 text-[12px] text-[#7A6A60]">
        <span className="ml-4">Opportunities:</span>
        <span className="font-[500] text-[#2A1F1A]">{raw?.opportunity?.toLocaleString()}</span>
      </div>
    </div>
  )
}

// sectionKey/weekStart kept in the prop signature for drop-in compatibility with how this
// component is mounted on the MQL page, but this chart is deliberately NOT tied to the page's
// week picker — see the route's own header comment for why (SQL->Opportunity doesn't move fast
// enough for a weekly view to be meaningful; monthly, trailing off the real current month, is).
type Props = {
  sectionKey: string
  weekStart: string
}

export function SQLToOppConversionChart({ sectionKey, weekStart }: Props) {
  const [chartData, setChartData] = useState<DataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function fetchAll() {
      try {
        // Both SQL and Opportunity come from HubSpot directly (not the SDR tracker sheet) —
        // Opportunity here means "marketing efforts driven Opportunities": Studio Deals
        // created that month with deal_source in {Direct/Outbound, Inbound, Marketing} and an
        // associated Book-a-Demo contact. See /api/hubspot/sql-to-opportunity-monthly's own
        // header comment for the full filter rationale (from a user-provided HubSpot filter
        // screenshot, 2026-09-07).
        const res = await fetch(`/api/hubspot/sql-to-opportunity-monthly?months=4&nocache=1`)
        const data = await res.json()
        const rows: DataPoint[] = (data.months || []).map((m: any) => ({
          month: m.label,
          'SQL → Opportunity %': m.rate,
          sql: m.sql,
          opportunity: m.opportunity,
        }))
        if (!cancelled) {
          setChartData(rows)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setChartData([])
          setLoading(false)
        }
      }
    }

    fetchAll()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className={CARD}>
        <p className="eyebrow mb-4">Monthly Trend — SQL → Opportunity %</p>
        <p className="text-[13px] text-[#7A6A60]">Loading from HubSpot…</p>
      </div>
    )
  }

  return (
    <div className={CARD}>
      <p className="eyebrow mb-1">Monthly Trend — SQL → Opportunity %</p>
      <p className="text-[12px] text-[#7A6A60] mb-4">Last 4 months · Hover for SQL &amp; marketing-driven Opportunity counts · from HubSpot</p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 36, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={fmtPct} domain={[0, (dataMax: number) => Math.min(Math.ceil(dataMax * 1.2), 100)]} />
          <Tooltip content={<Tip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#7A6A60', paddingTop: 8 }} />
          <Line
            type="monotone"
            dataKey="SQL → Opportunity %"
            stroke="#C96A5A"
            strokeWidth={2.5}
            dot={{ r: 5, fill: '#C96A5A', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}
          >
            <LabelList
              dataKey="SQL → Opportunity %"
              position="top"
              content={({ x, y, value, index }: any) => {
                const d = chartData[index]
                if (!d || d.sql === 0) return null
                return (
                  <g>
                    <text x={x} y={(y ?? 0) - 18} textAnchor="middle" fill="#C96A5A" fontSize={10} fontWeight={700}>
                      {value}%
                    </text>
                    <text x={x} y={(y ?? 0) - 6} textAnchor="middle" fill="#7A6A60" fontSize={9}>
                      {d.opportunity}/{d.sql}
                    </text>
                  </g>
                )
              }}
            />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
