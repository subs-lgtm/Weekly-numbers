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
  maturity: string
  ageDays: number
}

const IMMATURE = new Set(['Too Early to Judge', 'Developing'])

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  const raw: DataPoint = p?.payload
  const dim = IMMATURE.has(raw?.maturity)
  return (
    <div className="rounded-[14px] border border-[#D4CBC0] bg-white/95 px-4 py-3 shadow-[0_8px_32px_rgba(40,20,10,.10)] min-w-[190px]">
      <p className="eyebrow mb-2">{label}</p>
      <div className="flex items-center gap-2 text-[13px] text-[#2A1F1A]">
        <span className="h-2 w-2 rounded-full" style={{ background: '#C96A5A' }} />
        <span className="text-[#7A6A60]">Eventual conversion:</span>
        <span className="font-[600]">{raw?.['SQL → Opportunity %']}%</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[12px] text-[#7A6A60]">
        <span className="ml-4">SQL cohort:</span>
        <span className="font-[500] text-[#2A1F1A]">{raw?.sql?.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-2 text-[12px] text-[#7A6A60]">
        <span className="ml-4">Reached Opportunity:</span>
        <span className="font-[500] text-[#2A1F1A]">{raw?.opportunity?.toLocaleString()}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[11px]" style={{ color: dim ? '#B9822E' : '#7A6A60' }}>
        <span className="ml-4">{raw?.maturity} ({raw?.ageDays}d)</span>
      </div>
      {dim && (
        <p className="mt-1.5 text-[10.5px] text-[#B9822E]">Still early — this cohort hasn&apos;t had much time to convert yet.</p>
      )}
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
        // True cohort rate as of 2026-09-21 (rewritten — see the route's own header comment for
        // the full "why," including live-data proof of the old same-month-coincidence bug):
        // SQL is a FIXED cohort — contacts created that month, Book a Demo, who ever reached SQL
        // stage or beyond. Opportunity is EVENTUAL — of that same fixed cohort, how many have
        // since gotten an actual marketing-driven Studio deal, regardless of when that deal was
        // created. A recent month's rate will read low simply because it hasn't had time to
        // convert yet — see `maturity`/`ageDays` below, same convention as the Executive
        // Dashboard's Cohort Funnel Table.
        const res = await fetch(`/api/hubspot/sql-to-opportunity-monthly?months=4&nocache=1`)
        const data = await res.json()
        const rows: DataPoint[] = (data.months || []).map((m: any) => ({
          month: m.label,
          'SQL → Opportunity %': m.rate,
          sql: m.sql,
          opportunity: m.opportunity,
          maturity: m.maturity,
          ageDays: m.ageDays,
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
      <p className="eyebrow mb-1">Monthly Trend — SQL → Opportunity % (Eventual, Cohort-Based)</p>
      <p className="text-[12px] text-[#7A6A60] mb-4">Last 4 months · Of each month&apos;s SQL cohort, % that eventually got a marketing-driven deal · dimmed points are still-immature cohorts · from HubSpot</p>
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
            dot={({ cx, cy, index }: any) => {
              const d = chartData[index]
              const dim = d && IMMATURE.has(d.maturity)
              return <circle key={`dot-${index}`} cx={cx} cy={cy} r={5} fill="#C96A5A" strokeWidth={2} stroke="#fff" opacity={dim ? 0.45 : 1} />
            }}
            activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}
          >
            <LabelList
              dataKey="SQL → Opportunity %"
              position="top"
              content={({ x, y, value, index }: any) => {
                const d = chartData[index]
                if (!d || d.sql === 0) return null
                const dim = IMMATURE.has(d.maturity)
                return (
                  <g opacity={dim ? 0.55 : 1}>
                    <text x={x} y={(y ?? 0) - 18} textAnchor="middle" fill="#C96A5A" fontSize={10} fontWeight={700}>
                      {value}%{dim ? '*' : ''}
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
      {chartData.some(d => IMMATURE.has(d.maturity)) && (
        <p className="mt-1 text-[10.5px] text-[#B9822E]">* Still-immature cohort (0–60 days old) — rate will keep rising as more of that month&apos;s SQLs convert. Don&apos;t compare directly against mature months.</p>
      )}
    </div>
  )
}
