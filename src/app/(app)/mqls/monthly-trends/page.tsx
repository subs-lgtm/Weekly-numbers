'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { format, subMonths, startOfMonth, addDays, endOfMonth } from 'date-fns'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LabelList,
} from 'recharts'
import { ArrowLeft } from 'lucide-react'
import { SectionShell } from '@/components/SectionShell'
import { useWeek } from '@/lib/week-context'

const CARD = 'rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]'
const TICK = { fontSize: 11, fill: '#7A6A60' }
const GRID = { strokeDasharray: '3 3', stroke: '#D4CBC0', strokeOpacity: 0.5, vertical: false as const }
const DATA_START = '2026-03' // matches the floor used elsewhere on the MQL page

type MonthConfig = { label: string; start: string; end: string }

type MonthRow = {
  month: string
  mqls: number
  sql: number
  opp: number
  high: number
  medium: number
  low: number
}

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[14px] border border-[#D4CBC0] bg-white/95 px-4 py-3 shadow-[0_8px_32px_rgba(40,20,10,.10)]">
      <p className="eyebrow mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-[13px] text-[#2A1F1A]">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.stroke }} />
          <span className="text-[#7A6A60]">{p.name}:</span>
          <span className="font-[600]">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  )
}

function TrendCard({
  title, dataKey, color, data, loading,
}: {
  title: string
  dataKey: string
  color: string
  data: MonthRow[]
  loading: boolean
}) {
  if (loading) {
    return (
      <div className={CARD}>
        <p className="eyebrow mb-4">{title}</p>
        <p className="text-[13px] text-[#7A6A60]">Loading…</p>
      </div>
    )
  }
  const hasData = data.some(d => (d as any)[dataKey] > 0)
  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">{title}</p>
      {!hasData ? (
        <p className="text-[13px] text-[#7A6A60]">No data yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 26, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
            <YAxis tick={TICK} axisLine={false} tickLine={false} allowDecimals={false} domain={['auto', (dataMax: number) => Math.ceil(dataMax * 1.15) || 1]} />
            <Tooltip content={<Tip />} />
            <Line
              type="monotone"
              dataKey={dataKey}
              name={title}
              stroke={color}
              strokeWidth={2.5}
              dot={{ r: 5, fill: color, strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}
            >
              <LabelList dataKey={dataKey} position="top" style={{ fontSize: 10, fill: color, fontWeight: 600 }} formatter={(v: number) => v > 0 ? v.toLocaleString() : ''} />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

export default function MQLMonthlyTrendsPage() {
  const { weekStart } = useWeek()
  const [data, setData] = useState<MonthRow[]>([])
  const [loading, setLoading] = useState(true)

  const monthsConfig = useMemo<MonthConfig[]>(() => {
    const selected = new Date(weekStart + 'T00:00:00')
    const months: MonthConfig[] = []
    for (let i = 3; i >= 0; i--) {
      const m = subMonths(startOfMonth(selected), i)
      const monthKey = format(m, 'yyyy-MM')
      if (monthKey < DATA_START) continue
      months.push({
        label: format(m, 'MMM yyyy'),
        start: format(m, 'yyyy-MM-dd'),
        end: format(addDays(endOfMonth(m), 1), 'yyyy-MM-dd'),
      })
    }
    return months
  }, [weekStart])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function fetchAll() {
      const rows = await Promise.all(monthsConfig.map(async (m) => {
        try {
          // MQLs, SQLs, Opportunities, and priority all come from HubSpot here — unlike the
          // WoW trend charts on the main MQL page, which deliberately source SQL/Opportunity
          // from the SDR tracker sheet instead (see MQLToSQLConversionChart.tsx /
          // SQLToOppConversionChart.tsx). Keep this page HubSpot-only per explicit instruction.
          const res = await fetch(`/api/hubspot/mqls?start=${m.start}&end=${m.end}&nocache=1`)
          const mqlData = await res.json()
          return {
            month: m.label,
            mqls: mqlData.total || 0,
            sql: mqlData.funnel?.sql || 0,
            opp: mqlData.funnel?.opportunity || 0,
            high: mqlData.high_priority || 0,
            medium: mqlData.medium_priority || 0,
            low: mqlData.low_priority || 0,
          }
        } catch {
          return { month: m.label, mqls: 0, sql: 0, opp: 0, high: 0, medium: 0, low: 0 }
        }
      }))
      if (!cancelled) {
        setData(rows)
        setLoading(false)
      }
    }

    fetchAll()
    return () => { cancelled = true }
  }, [monthsConfig])

  return (
    <SectionShell
      title="MQL Monthly Trends"
      description="Month-on-month view — MQLs, SQLs, Opportunities, and priority mix, last 4 months"
    >
      <div className="space-y-4">
        <Link href="/mqls" className="inline-flex items-center gap-1.5 text-[13px] text-[#6B4C4C] hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to MQLs
        </Link>
        <div className="row-3">
          <TrendCard title="MoM — MQLs" dataKey="mqls" color="#6B4C4C" data={data} loading={loading} />
          <TrendCard title="MoM — SQLs" dataKey="sql" color="#4A7C7C" data={data} loading={loading} />
          <TrendCard title="MoM — Opportunities" dataKey="opp" color="#C96A5A" data={data} loading={loading} />
        </div>
        <div className="row-3">
          <TrendCard title="MoM — High Priority MQLs" dataKey="high" color="#DC2626" data={data} loading={loading} />
          <TrendCard title="MoM — Medium Priority MQLs" dataKey="medium" color="#D97706" data={data} loading={loading} />
          <TrendCard title="MoM — Low Priority MQLs" dataKey="low" color="#2563EB" data={data} loading={loading} />
        </div>
      </div>
    </SectionShell>
  )
}
