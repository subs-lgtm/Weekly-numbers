'use client'

import { useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { format, subWeeks } from 'date-fns'
import { useWeeklyMetrics } from '@/hooks/useWeeklyMetrics'

const CARD = 'rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]'
const TICK = { fontSize: 11, fill: '#7A6A60' }
const GRID = { strokeDasharray: '3 3', stroke: '#D4CBC0', strokeOpacity: 0.5, vertical: false as const }
const fmtY = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(0)}k` : `$${v}`
const fmtNum = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[14px] border border-[#D4CBC0] bg-white/95 px-4 py-3 shadow-[0_8px_32px_rgba(40,20,10,.10)]">
      <p className="eyebrow mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-[13px] text-[#2A1F1A]">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.fill }} />
          <span className="text-[#7A6A60]">{p.name}:</span>
          <span className="font-[600]">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  )
}

type Props = { sectionKey: string; weekStart: string }

export function AdsCharts({ sectionKey, weekStart }: Props) {
  // Build last 4 week keys
  const weekKeys = useMemo(() => {
    const r: string[] = []
    const b = new Date(weekStart + 'T00:00:00')
    for (let i = 3; i >= 0; i--) r.push(format(subWeeks(b, i), 'yyyy-MM-dd'))
    return r
  }, [weekStart])

  const w0 = useWeeklyMetrics(sectionKey, weekKeys[0])
  const w1 = useWeeklyMetrics(sectionKey, weekKeys[1])
  const w2 = useWeeklyMetrics(sectionKey, weekKeys[2])
  const w3 = useWeeklyMetrics(sectionKey, weekKeys[3])
  const weeks = [w0, w1, w2, w3]

  const chartData = useMemo(() => weekKeys.map((wk, i) => {
    const d = weeks[i].data
    const mqls = parseFloat(d['total_mqls']?.value ?? '') || 0
    const spend = parseFloat(d['total_spend']?.value ?? '') || 0
    const costPerMql = parseFloat(d['cost_per_mql']?.value ?? '') || (mqls > 0 && spend > 0 ? Math.round(spend / mqls) : 0)
    const google = parseFloat(d['spend_google']?.value ?? '') || 0
    const linkedin = parseFloat(d['spend_linkedin']?.value ?? '') || 0
    const meta = parseFloat(d['spend_meta']?.value ?? '') || 0

    // Estimate MQLs per channel proportionally if not entered separately
    const totalChannelSpend = google + linkedin + meta
    const googleMqls = totalChannelSpend > 0 && mqls > 0 ? Math.round((google / totalChannelSpend) * mqls) : 0
    const linkedinMqls = totalChannelSpend > 0 && mqls > 0 ? Math.round((linkedin / totalChannelSpend) * mqls) : 0
    const metaMqls = totalChannelSpend > 0 && mqls > 0 ? Math.round((meta / totalChannelSpend) * mqls) : 0

    return {
      week: format(new Date(wk + 'T00:00:00'), 'MMM d'),
      'Total MQLs': mqls,
      'Cost/MQL': costPerMql,
      'Google Spend': google,
      'LinkedIn Spend': linkedin,
      'Meta Spend': meta,
      'Google MQLs': googleMqls,
      'LinkedIn MQLs': linkedinMqls,
      'Meta MQLs': metaMqls,
      'Google CPM': google > 0 && googleMqls > 0 ? Math.round(google / googleMqls) : 0,
      'LinkedIn CPM': linkedin > 0 && linkedinMqls > 0 ? Math.round(linkedin / linkedinMqls) : 0,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [weekKeys, w0.data, w1.data, w2.data, w3.data])

  const hasData = chartData.some(d => d['Total MQLs'] > 0 || d['Cost/MQL'] > 0)
  if (!hasData) return null

  const hasCostData = chartData.some(d => d['Cost/MQL'] > 0)
  const hasChannelData = chartData.some(d => d['Google Spend'] > 0 || d['LinkedIn Spend'] > 0)

  return (
    <div className="space-y-4">
      {/* Row 1: MQLs trend + Cost/MQL trend */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* MQLs from Ads — last 4 weeks */}
        <div className={CARD}>
          <p className="eyebrow mb-4">MQLs from Ads — Last 4 Weeks</p>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="week" tick={TICK} axisLine={false} tickLine={false} />
              <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={fmtNum} />
              <Tooltip content={<Tip />} />
              <Line
                type="monotone"
                dataKey="Total MQLs"
                stroke="#6B4C4C"
                strokeWidth={2.5}
                dot={{ r: 5, fill: '#6B4C4C', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Cost per MQL — last 4 weeks */}
        {hasCostData && (
          <div className={CARD}>
            <p className="eyebrow mb-4">Cost Per MQL — Last 4 Weeks</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="week" tick={TICK} axisLine={false} tickLine={false} />
                <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={fmtY} />
                <Tooltip content={<Tip />} />
                <Line
                  type="monotone"
                  dataKey="Cost/MQL"
                  stroke="#C96A5A"
                  strokeWidth={2.5}
                  dot={{ r: 5, fill: '#C96A5A', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Row 2: Channel-wise spend + MQLs */}
      {hasChannelData && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* Channel spend breakdown */}
          <div className={CARD}>
            <p className="eyebrow mb-4">Spend by Channel — Last 4 Weeks</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="week" tick={TICK} axisLine={false} tickLine={false} />
                <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={fmtY} />
                <Tooltip content={<Tip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#7A6A60', paddingTop: 8 }} />
                <Bar dataKey="Google Spend" fill="#16A34A" radius={[4, 4, 0, 0]} barSize={18} />
                <Bar dataKey="LinkedIn Spend" fill="#2563EB" radius={[4, 4, 0, 0]} barSize={18} />
                <Bar dataKey="Meta Spend" fill="#7C3AED" radius={[4, 4, 0, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Channel MQL cost comparison */}
          <div className={CARD}>
            <p className="eyebrow mb-4">Cost Per MQL by Channel</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="week" tick={TICK} axisLine={false} tickLine={false} />
                <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={fmtY} />
                <Tooltip content={<Tip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#7A6A60', paddingTop: 8 }} />
                <Bar dataKey="Google CPM" name="Google Cost/MQL" fill="#16A34A" radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="LinkedIn CPM" name="LinkedIn Cost/MQL" fill="#2563EB" radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
            <p className="caption mt-2">Estimated from spend ÷ proportional MQLs</p>
          </div>
        </div>
      )}
    </div>
  )
}
