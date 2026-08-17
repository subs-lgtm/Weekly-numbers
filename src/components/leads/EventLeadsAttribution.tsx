'use client'

import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LabelList,
} from 'recharts'

const CARD = 'rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]'
const TICK = { fontSize: 11, fill: '#7A6A60' }
const GRID = { strokeDasharray: '3 3', stroke: '#D4CBC0', strokeOpacity: 0.5 }
const COLORS = ['#6B4C4C','#C96A5A','#8A6060','#D97706','#2563EB','#16A34A','#7C3AED','#0891B2','#DC2626','#059669','#4F46E5','#DB2777']

const INTENT_COLOR: Record<string, string> = {
  Hot:  '#C96A5A',
  Warm: '#D97706',
  Cool: '#2563EB',
  '—':  '#D4CBC0',
}

function Tip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div className="rounded-[14px] border border-[#D4CBC0] bg-white/95 px-4 py-3 shadow-[0_8px_32px_rgba(40,20,10,.10)]">
      <p className="text-[13px] font-[600] text-[#2A1F1A] mb-1">{d.name}</p>
      <p className="text-[13px] text-[#7A6A60]">{d.value.toLocaleString()} leads</p>
    </div>
  )
}

function MiniChart({
  title, data, colorFn,
}: {
  title: string
  data: { name: string; value: number }[]
  colorFn?: (name: string, i: number) => string
}) {
  if (!data.length) return null
  const height = Math.max(180, data.length * 36 + 40)
  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">{title}</p>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, left: 8, bottom: 0 }}>
          <CartesianGrid {...GRID} horizontal={false} vertical={false} />
          <XAxis type="number" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" tick={TICK} axisLine={false} tickLine={false} width={140} />
          <Tooltip content={<Tip />} cursor={{ fill: '#F9F5F1' }} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
            <LabelList
              dataKey="value"
              position="right"
              style={{ fontSize: 11, fill: '#2A1F1A', fontWeight: 600 }}
              formatter={(v: number) => v > 0 ? v : ''}
            />
            {data.map((d, i) => (
              <Cell key={i} fill={colorFn ? colorFn(d.name, i) : COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

type EventData = {
  total: number
  by_event: Record<string, number>
  by_intent_level: Record<string, number>
  by_meeting_outcome: Record<string, number>
  by_meeting_type: Record<string, number>
  date_filtered: boolean
  date_range: string | null
}

export function EventLeadsAttribution({ queryStart, queryEnd }: { queryStart: string; queryEnd: string }) {
  const [data, setData] = useState<EventData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/hubspot/event-leads?start=${queryStart}&end=${queryEnd}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [queryStart, queryEnd])

  if (loading) {
    return (
      <div className={CARD}>
        <p className="eyebrow mb-1">Event Leads Attribution</p>
        <p className="text-[13px] text-[#7A6A60] mt-2">Loading…</p>
      </div>
    )
  }
  if (!data || data.total === 0) return null

  const byEvent   = Object.entries(data.by_event).sort((a,b) => b[1]-a[1]).map(([name,value]) => ({ name, value }))
  const byIntent  = Object.entries(data.by_intent_level).sort((a,b) => b[1]-a[1]).map(([name,value]) => ({ name, value }))
  const byOutcome = Object.entries(data.by_meeting_outcome).filter(([k]) => k !== '—').sort((a,b) => b[1]-a[1]).map(([name,value]) => ({ name, value }))
  const byType    = Object.entries(data.by_meeting_type).filter(([k]) => k !== '—').sort((a,b) => b[1]-a[1]).map(([name,value]) => ({ name, value }))

  const meetingDateNote = data.date_filtered
    ? `Meeting outcomes filtered by date range (${data.date_range}). Leads with no meeting date always shown.`
    : 'Showing all event leads'

  return (
    <div className="space-y-4">
      {/* Header card */}
      <div className={CARD}>
        <div className="flex items-center justify-between">
          <div>
            <p className="eyebrow">Event Leads Attribution</p>
            <p className="text-[13px] text-[#7A6A60] mt-0.5">
              All event leads — attendance data is all-time, meeting outcomes synced to selected date range
            </p>
          </div>
          <div className="text-right">
            <p className="text-[32px] font-[700] text-[#2A1F1A] leading-none">{data.total.toLocaleString()}</p>
            <p className="text-[12px] text-[#7A6A60] mt-1">total event leads</p>
          </div>
        </div>
      </div>

      {/* By Event — full width, all-time */}
      <MiniChart title="By Event (all-time)" data={byEvent} />

      {/* Intent — all-time */}
      <div className="grid gap-4 md:grid-cols-2">
        {byIntent.length > 0 && (
          <MiniChart
            title="By Intent Level (all-time)"
            data={byIntent}
            colorFn={(name) => INTENT_COLOR[name] || '#D4CBC0'}
          />
        )}
        {byOutcome.length > 0 && (
          <div>
            <MiniChart title={`By Meeting Outcome`} data={byOutcome} />
            <p className="text-[11px] text-[#7A6A60] mt-1 px-1">{meetingDateNote}</p>
          </div>
        )}
      </div>

      {/* Meeting type — date-filtered */}
      {byType.length > 0 && (
        <div>
          <MiniChart title="By Meeting Type" data={byType} />
          <p className="text-[11px] text-[#7A6A60] mt-1 px-1">{meetingDateNote}</p>
        </div>
      )}
    </div>
  )
}
