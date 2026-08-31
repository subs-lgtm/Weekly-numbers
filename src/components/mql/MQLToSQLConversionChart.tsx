'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, LabelList,
} from 'recharts'
import { format, subWeeks, addWeeks } from 'date-fns'

const CARD = 'rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]'
const TICK = { fontSize: 11, fill: '#7A6A60' }
const GRID = { strokeDasharray: '3 3', stroke: '#D4CBC0', strokeOpacity: 0.5, vertical: false as const }
const fmtPct = (v: number) => `${v}%`

type DataPoint = {
  week: string
  'MQL → SQL %': number
  mqls: number
  sql: number
}

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  const raw: DataPoint = p?.payload
  return (
    <div className="rounded-[14px] border border-[#D4CBC0] bg-white/95 px-4 py-3 shadow-[0_8px_32px_rgba(40,20,10,.10)] min-w-[160px]">
      <p className="eyebrow mb-2">{label}</p>
      <div className="flex items-center gap-2 text-[13px] text-[#2A1F1A]">
        <span className="h-2 w-2 rounded-full" style={{ background: '#4A7C7C' }} />
        <span className="text-[#7A6A60]">Conversion:</span>
        <span className="font-[600]">{raw?.['MQL → SQL %']}%</span>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[12px] text-[#7A6A60]">
        <span className="ml-4">MQLs:</span>
        <span className="font-[500] text-[#2A1F1A]">{raw?.mqls?.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-2 text-[12px] text-[#7A6A60]">
        <span className="ml-4">SQLs:</span>
        <span className="font-[500] text-[#2A1F1A]">{raw?.sql?.toLocaleString()}</span>
      </div>
    </div>
  )
}

type Props = {
  sectionKey: string
  weekStart: string
}

export function MQLToSQLConversionChart({ sectionKey, weekStart }: Props) {
  const weekKeys = useMemo(() => {
    const DATA_START = '2026-03-02'
    const r: string[] = []
    const base = new Date(weekStart + 'T00:00:00')
    for (let i = 5; i >= 0; i--) {
      const wk = format(subWeeks(base, i), 'yyyy-MM-dd')
      if (wk >= DATA_START) r.push(wk)
    }
    return r
  }, [weekStart])

  const [chartData, setChartData] = useState<DataPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function fetchAll() {
      const promises = weekKeys.map(async (wk) => {
        const end = format(addWeeks(new Date(wk + 'T00:00:00'), 1), 'yyyy-MM-dd')
        try {
          // MQL total still comes from HubSpot (unchanged). SQL count comes from the SDR
          // tracker sheet instead of HubSpot's lifecyclestage — SDRs mark a lead SQL there
          // directly, often before (or without ever) updating the matching HubSpot property,
          // so the sheet is the more complete source for this specific number.
          const [mqlRes, sqlRes] = await Promise.all([
            fetch(`/api/hubspot/mqls?start=${wk}&end=${end}&nocache=1`),
            fetch(`/api/sdr-sql-tracker?start=${wk}&end=${end}`),
          ])
          const mqlData = await mqlRes.json()
          const sqlData = await sqlRes.json()
          const mqls = mqlData.total || 0
          const sql = sqlData.sql || 0
          const rate = mqls > 0 ? Math.round((sql / mqls) * 100) : 0
          return { week: format(new Date(wk + 'T00:00:00'), 'MMM d'), 'MQL → SQL %': rate, mqls, sql }
        } catch {
          return { week: format(new Date(wk + 'T00:00:00'), 'MMM d'), 'MQL → SQL %': 0, mqls: 0, sql: 0 }
        }
      })

      const results = await Promise.all(promises)
      if (!cancelled) {
        setChartData(results)
        setLoading(false)
      }
    }

    fetchAll()
    return () => { cancelled = true }
  }, [weekKeys])

  if (loading) {
    return (
      <div className={CARD}>
        <p className="eyebrow mb-4">WoW Trend — MQL → SQL %</p>
        <p className="text-[13px] text-[#7A6A60]">Loading from HubSpot &amp; SDR tracker…</p>
      </div>
    )
  }

  return (
    <div className={CARD}>
      <p className="eyebrow mb-1">WoW Trend — MQL → SQL %</p>
      <p className="text-[12px] text-[#7A6A60] mb-4">Hover each point for MQL &amp; SQL counts · SQL from SDR tracker sheet</p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 36, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis dataKey="week" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={fmtPct} domain={[0, (dataMax: number) => Math.min(Math.ceil(dataMax * 1.2), 100)]} />
          <Tooltip content={<Tip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#7A6A60', paddingTop: 8 }} />
          <Line
            type="monotone"
            dataKey="MQL → SQL %"
            stroke="#4A7C7C"
            strokeWidth={2.5}
            dot={{ r: 5, fill: '#4A7C7C', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}
          >
            <LabelList
              dataKey="MQL → SQL %"
              position="top"
              content={({ x, y, value, index }: any) => {
                const d = chartData[index]
                if (!d || d.mqls === 0) return null
                return (
                  <g>
                    <text x={x} y={(y ?? 0) - 18} textAnchor="middle" fill="#4A7C7C" fontSize={10} fontWeight={700}>
                      {value}%
                    </text>
                    <text x={x} y={(y ?? 0) - 6} textAnchor="middle" fill="#7A6A60" fontSize={9}>
                      {d.sql}/{d.mqls}
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
