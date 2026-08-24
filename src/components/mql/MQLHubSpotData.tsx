'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, addWeeks, parseISO } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'

import { LeadDrawer, type LeadContact } from './LeadDrawer'
import { SourceFunnelTable } from './SourceFunnelTable'

type HubSpotMQLData = {
  total: number
  qualified: number
  high_priority: number
  medium_priority: number
  low_priority: number
  unknown_priority: number
  by_form_type: Record<string, number>
  by_source_category: Record<string, number>
  by_source_funnel?: Record<string, { total: number; mql: number; sql: number; opportunity: number; customer: number; working: number; pipelineValue: number }>
  funnel: {
    mqls: number
    meeting_booked: number
    demo_booked: number
    demo_completed: number
    demo_no_show: number
    sql: number
    opportunity: number
    customer: number
  }
  lifecycle_stage_funnel?: { total: number; mql_plus: number; sql_plus: number; opportunity_plus: number; customer: number }
  lead_status_funnel?: { total: number; working_plus: number; demo_booked_plus: number; demo_completed_plus: number; associated_with_deal: number }
  mql_status_breakdown?: { new: number; working: number; demo_booked: number; demo_completed: number; sql: number; junk: number }
  date_range: { start: string; end: string }
  contacts_by_priority?: {
    high: LeadContact[]
    medium: LeadContact[]
    low: LeadContact[]
    unknown: LeadContact[]
  }
}

type Props = {
  weekStart: string
  /** Explicit query start date (overrides weekStart-based calculation) */
  queryStart?: string
  /** Explicit query end date — exclusive (overrides weekStart + 1 week) */
  queryEnd?: string
  /** When true, requests pipeline $ per source (adds Pipeline $ column to the embedded Source Performance table). Only set this on the single primary data-fetch instance on the page — not on WoW/MTD/comparison callers — to avoid expensive N+1 deal lookups on every fetch. */
  includePipeline?: boolean
  /** When true, hides the embedded Source Performance table — used when the page renders its own standalone Source Performance table elsewhere to match the reference layout's section order. */
  hideSourceTable?: boolean
  onData?: (data: {
    total: number
    qualified: number
    qualified_mqls: number
    meeting_booked: number
    paid_mqls: number
    working_mqls: number
    book_demo_linkedin_ads: number
    book_demo_website: number
    stage_breakdown: Record<string, { working: number; linkedinAds: number; website: number; total: number }>
    mql_status_breakdown?: { new: number; working: number; demo_booked: number; demo_completed: number; sql: number; junk: number }
    funnel: HubSpotMQLData['funnel']
    lifecycle_stage_funnel: HubSpotMQLData['lifecycle_stage_funnel']
    lead_status_funnel: HubSpotMQLData['lead_status_funnel']
    contacts_by_priority: HubSpotMQLData['contacts_by_priority']
    by_source_category: Record<string, number>
    by_source_funnel: HubSpotMQLData['by_source_funnel']
  }) => void
}

const FORM_TYPE_ORDER = [
  'Book a Demo',
  'GSI and SI',
  'Accenture',
  'Email Form',
  'Playbook Download',
  'Contact Us',
  'Partner Form',
  'AWS Partner Form',
  'Booth Event',
  'Agent Studio',
  'Other',
]

const PRIORITY_COLORS: Record<string, string> = {
  'High': '#DC2626',
  'Medium': '#D97706',
  'Low': '#2563EB',
  'Unknown': '#9CA3AF',
}

const FORM_COLORS = ['#6B4C4C', '#7C3AED', '#E11D48', '#C96A5A', '#D97706', '#16A34A', '#2563EB', '#0891B2', '#D97706', '#9CA3AF', '#6B7280']

// Custom tooltip for recharts
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[10px] border border-[#D4CBC0] bg-white px-3 py-2 shadow-lg text-[12px]">
      <p className="font-[600] text-[#2A1F1A]">{label}</p>
      <p className="text-[#7A6A60]">{payload[0].value} MQLs</p>
    </div>
  )
}

export function MQLHubSpotData({ weekStart, queryStart, queryEnd, onData, includePipeline = false, hideSourceTable = false }: Props) {
  const [data, setData] = useState<HubSpotMQLData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  // Drawer state — clicking a priority bar opens a slide-over with that priority's leads
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerPriority, setDrawerPriority] = useState<string>('')
  const [drawerContacts, setDrawerContacts] = useState<LeadContact[]>([])

  // Use explicit query dates if provided, otherwise fall back to weekStart + 1 week
  const apiStart = queryStart || weekStart
  const apiEnd = queryEnd || format(addWeeks(parseISO(weekStart), 1), 'yyyy-MM-dd')

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/hubspot/mqls?start=${apiStart}&end=${apiEnd}${includePipeline ? '&includePipeline=1' : ''}&nocache=1`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
      setLastFetched(new Date())
      onData?.({
        total: json.total,
        qualified: json.qualified,
        qualified_mqls: json.qualified_mqls || 0,
        meeting_booked: json.funnel?.meeting_booked || 0,
        paid_mqls: json.paid_mqls || 0,
        working_mqls: json.working_mqls || 0,
        book_demo_linkedin_ads: json.book_demo_linkedin_ads || 0,
        book_demo_website: json.book_demo_website || 0,
        stage_breakdown: json.stage_breakdown || {},
        mql_status_breakdown: json.mql_status_breakdown,
        funnel: json.funnel,
        lifecycle_stage_funnel: json.lifecycle_stage_funnel,
        lead_status_funnel: json.lead_status_funnel,
        contacts_by_priority: json.contacts_by_priority,
        by_source_category: json.by_source_category || {},
        by_source_funnel: json.by_source_funnel,
      })
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }, [apiStart, apiEnd, onData, includePipeline])

  useEffect(() => { fetchData() }, [fetchData])

  // Click handler — maps bar label to the contacts_by_priority key
  const handlePriorityClick = (entry: { name: string }) => {
    if (!data?.contacts_by_priority) return
    const key = entry.name.toLowerCase() as 'high' | 'medium' | 'low' | 'unknown'
    setDrawerPriority(entry.name)
    setDrawerContacts(data.contacts_by_priority[key] || [])
    setDrawerOpen(true)
  }

  // Build chart data
  const priorityChartData = data ? [
    { name: 'High', value: data.high_priority },
    { name: 'Medium', value: data.medium_priority },
    { name: 'Low', value: data.low_priority },
    ...(data.unknown_priority > 0 ? [{ name: 'Unknown', value: data.unknown_priority }] : []),
  ] : []

  const formTypeChartData = data
    ? Object.entries(data.by_form_type)
        .sort(([a], [b]) => {
          const ai = FORM_TYPE_ORDER.indexOf(a)
          const bi = FORM_TYPE_ORDER.indexOf(b)
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
        })
        .map(([name, value]) => ({ name, value }))
    : []

  const sourceChartData = data
    ? Object.entries(data.by_source_category)
        .filter(([k]) => k && k !== 'Other')
        .sort((a, b) => b[1] - a[1])
        .map(([name, value]) => ({ name: name.length > 22 ? name.slice(0, 20) + '…' : name, fullName: name, value }))
    : []

  return (
    <div className="rounded-[20px] border border-[#D4CBC0] bg-white shadow-[0_4px_20px_rgba(40,20,10,.07)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#D4CBC0] bg-[#F9F5F1]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(107,76,76,.10)]">
            <Zap className="h-3.5 w-3.5 text-[#6B4C4C]" />
          </div>
          <div>
            <p className="eyebrow">Live from HubSpot · Book a Demo</p>
            <p className="text-[11px] text-[#7A6A60]">
              {apiStart} → {apiEnd} · excludes @lyzr.ai · total &amp; qualified auto-populate scorecards
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastFetched && (
            <span className="text-[10px] text-[#7A6A60]">
              {lastFetched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[#7A6A60] hover:bg-[#F2EDE8] transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 gap-2 text-[#7A6A60]">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-[13px]">Fetching from HubSpot…</span>
        </div>
      ) : error ? (
        <div className="px-5 py-8 text-center">
          <p className="text-[13px] text-[#DC2626]">Failed: {error}</p>
          <button onClick={fetchData} className="mt-2 text-[12px] text-[#6B4C4C] hover:underline">Retry</button>
        </div>
      ) : data ? (
        <div className="p-5">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">

            {/* Priority breakdown — vertical bar chart */}
            <div>
              <p className="eyebrow mb-4">By Priority</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={priorityChartData} barCategoryGap="30%" margin={{ top: 30, right: 0, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: '#7A6A60', fontFamily: 'DM Sans' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#7A6A60', fontFamily: 'DM Sans' }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(107,76,76,.05)' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} onClick={handlePriorityClick} style={{ cursor: 'pointer' }}>
                    <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: '#2A1F1A', fontWeight: 600 }} />
                    {priorityChartData.map((entry) => (
                      <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] ?? '#9CA3AF'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {data?.contacts_by_priority && (
                <p className="mt-1 text-[10px] text-[#7A6A60] text-center">Click a bar to see leads</p>
              )}
            </div>

            {/* By form type — vertical bar chart */}
            <div>
              <p className="eyebrow mb-4">By Form Type</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={formTypeChartData} barCategoryGap="30%" margin={{ top: 30, right: 0, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#7A6A60', fontFamily: 'DM Sans' }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={48}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#7A6A60', fontFamily: 'DM Sans' }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(107,76,76,.05)' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: '#2A1F1A', fontWeight: 600 }} />
                    {formTypeChartData.map((entry, i) => (
                      <Cell key={entry.name} fill={FORM_COLORS[i % FORM_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* By source/channel — vertical bar chart */}
            <div>
              <p className="eyebrow mb-4">By Source / Channel</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={sourceChartData} barCategoryGap="30%" margin={{ top: 30, right: 0, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#7A6A60', fontFamily: 'DM Sans' }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={52}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#7A6A60', fontFamily: 'DM Sans' }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(107,76,76,.05)' }} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: '#2A1F1A', fontWeight: 600 }} />
                    {sourceChartData.map((_, i) => (
                      <Cell key={i} fill={FORM_COLORS[(i + 3) % FORM_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

          </div>
        </div>
      ) : null}

      {/* Source → MQL → SQL → Opportunity breakdown table */}
      {!hideSourceTable && data?.by_source_funnel && (
        <SourceFunnelTable data={data.by_source_funnel} hasPipelineData={includePipeline} />
      )}

      {/* Lead drill-down drawer — opens when a priority bar is clicked */}
      <LeadDrawer
        open={drawerOpen}
        priority={drawerPriority}
        contacts={drawerContacts}
        dateRange={`${apiStart} → ${apiEnd}`}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  )
}
