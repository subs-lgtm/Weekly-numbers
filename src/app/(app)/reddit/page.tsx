'use client'

import { useMemo, useCallback } from 'react'
import { SectionShell } from '@/components/SectionShell'
import { InlineMetricTable } from '@/components/InlineMetricTable'
import { LoadingScreen } from '@/components/LoadingScreen'
import { useCustomMetrics } from '@/hooks/useCustomMetrics'
import { useWeeklyMetrics } from '@/hooks/useWeeklyMetrics'
import { SECTION_MAP } from '@/lib/metrics-config'
import { useAuth } from '@/lib/auth-context'
import { useRangeMetrics, usePrevRangeMetrics } from '@/hooks/useRangeMetrics'
import { useWeek } from '@/lib/week-context'
import { ReadOnlyBanner } from '@/components/ReadOnlyBanner'
import { TrendingUp, TrendingDown, Minus, FileText, Eye, MessageCircle, ThumbsUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TaskTextBoxes } from '@/components/shared/TaskTextBoxes'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { format, subWeeks } from 'date-fns'
import type { WeekMetrics } from '@/hooks/useWeeklyMetrics'

const CARD = 'rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]'
const TICK = { fontSize: 11, fill: '#7A6A60' }
const GRID_S = { strokeDasharray: '3 3', stroke: '#D4CBC0', strokeOpacity: 0.5, vertical: false as const }
const fmtY = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))

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

/* ── Score Cards ── */

function ScoreCards({ data, prevData }: { data: WeekMetrics; prevData: WeekMetrics }) {
  const cards: { key: string; label: string; icon: React.ReactNode; ac: string; ab: string }[] = [
    { key: 'total_posts', label: 'Total Posts', icon: <FileText className="h-4 w-4" />, ac: '#6B4C4C', ab: 'rgba(107,76,76,.08)' },
    { key: 'total_views', label: 'Total Views', icon: <Eye className="h-4 w-4" />, ac: '#2563EB', ab: 'rgba(37,99,235,.08)' },
    { key: 'total_comments', label: 'Total Comments', icon: <MessageCircle className="h-4 w-4" />, ac: '#D97706', ab: 'rgba(217,119,6,.08)' },
    { key: 'total_upvotes', label: 'Total Upvotes', icon: <ThumbsUp className="h-4 w-4" />, ac: '#16A34A', ab: 'rgba(22,163,74,.08)' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(card => {
        const val = data[card.key]?.value ?? ''
        const prev = prevData[card.key]?.value ?? ''
        const c = parseFloat(val), p = parseFloat(prev)
        const d = !isNaN(c) && !isNaN(p) && p > 0
          ? { pct: Math.round(((c - p) / p) * 100), dir: c > p ? 'up' as const : c < p ? 'down' as const : 'flat' as const }
          : null
        return (
          <div key={card.key} className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)] hover:shadow-[0_8px_40px_rgba(40,20,10,.13)] hover:-translate-y-1 transition-all duration-200">
            <div className="inline-flex items-center justify-center rounded-full p-2 mb-3" style={{ background: card.ab, color: card.ac }}>{card.icon}</div>
            <p className="eyebrow mb-2">{card.label}</p>
            <p className="font-['Playfair_Display'] font-[500] text-[2rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">{val ? parseFloat(val).toLocaleString() : '—'}</p>
            {d && (
              <div className={cn('mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', d.dir === 'up' && 'delta-up', d.dir === 'down' && 'delta-down', d.dir === 'flat' && 'delta-flat')}>
                {d.dir === 'up' && <TrendingUp className="h-3 w-3" />}{d.dir === 'down' && <TrendingDown className="h-3 w-3" />}{d.dir === 'flat' && <Minus className="h-3 w-3" />}
                {d.pct > 0 ? '+' : ''}{d.pct}% WoW
              </div>
            )}
            {prev && <p className="caption mt-1">Prev: {parseFloat(prev).toLocaleString()}</p>}
          </div>
        )
      })}
    </div>
  )
}

/* ── WoW Line Chart — Posts Goals vs Actuals ── */

function PostsWoWChart({ weekStart }: { weekStart: string }) {
  const weekKeys = useMemo(() => {
    const DATA_START = '2026-03-03'
    const r: string[] = []
    const base = new Date(weekStart + 'T00:00:00')
    for (let i = 5; i >= 0; i--) {
      const wk = format(subWeeks(base, i), 'yyyy-MM-dd')
      if (wk >= DATA_START) r.push(wk)
    }
    return r
  }, [weekStart])

  const w0 = useWeeklyMetrics('reddit', weekKeys[0] ?? weekStart)
  const w1 = useWeeklyMetrics('reddit', weekKeys[1] ?? weekStart)
  const w2 = useWeeklyMetrics('reddit', weekKeys[2] ?? weekStart)
  const w3 = useWeeklyMetrics('reddit', weekKeys[3] ?? weekStart)
  const w4 = useWeeklyMetrics('reddit', weekKeys[4] ?? weekStart)
  const w5 = useWeeklyMetrics('reddit', weekKeys[5] ?? weekStart)
  const weeks = [w0, w1, w2, w3, w4, w5]

  const chartData = useMemo(() => {
    return weekKeys.map((wk, i) => {
      const d = weeks[i]?.data || {}
      const actual = parseFloat(d['total_posts']?.value ?? '')
      const goal = parseFloat(d['goal_posts']?.value ?? '')
      return {
        week: format(new Date(wk + 'T00:00:00'), 'MMM d'),
        'Actual Posts': isNaN(actual) ? 0 : actual,
        'Goal Posts': isNaN(goal) ? 0 : goal,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKeys, w0.data, w1.data, w2.data, w3.data, w4.data, w5.data])

  const hasData = chartData.some(d => d['Actual Posts'] > 0 || d['Goal Posts'] > 0)
  if (!hasData) return <div className={CARD}><p className="eyebrow mb-4">WoW — Posts Goals vs Actuals</p><p className="text-[13px] text-[#7A6A60]">No data yet</p></div>

  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">WoW — Posts Goals vs Actuals (6 Weeks)</p>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid {...GRID_S} />
          <XAxis dataKey="week" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={fmtY} />
          <Tooltip content={<Tip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#7A6A60', paddingTop: 8 }} />
          <Line type="monotone" dataKey="Actual Posts" stroke="#6B4C4C" strokeWidth={2.5} dot={{ r: 5, fill: '#6B4C4C', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }} />
          <Line type="monotone" dataKey="Goal Posts" stroke="#D4CBC0" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 4, fill: '#D4CBC0', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ── Bar Chart — Views, Comments, Upvotes per Week ── */

function EngagementBarChart({ weekStart }: { weekStart: string }) {
  const weekKeys = useMemo(() => {
    const DATA_START = '2026-03-03'
    const r: string[] = []
    const base = new Date(weekStart + 'T00:00:00')
    for (let i = 5; i >= 0; i--) {
      const wk = format(subWeeks(base, i), 'yyyy-MM-dd')
      if (wk >= DATA_START) r.push(wk)
    }
    return r
  }, [weekStart])

  const w0 = useWeeklyMetrics('reddit', weekKeys[0] ?? weekStart)
  const w1 = useWeeklyMetrics('reddit', weekKeys[1] ?? weekStart)
  const w2 = useWeeklyMetrics('reddit', weekKeys[2] ?? weekStart)
  const w3 = useWeeklyMetrics('reddit', weekKeys[3] ?? weekStart)
  const w4 = useWeeklyMetrics('reddit', weekKeys[4] ?? weekStart)
  const w5 = useWeeklyMetrics('reddit', weekKeys[5] ?? weekStart)
  const weeks = [w0, w1, w2, w3, w4, w5]

  const chartData = useMemo(() => {
    return weekKeys.map((wk, i) => {
      const d = weeks[i]?.data || {}
      const views = parseFloat(d['total_views']?.value ?? '')
      const comments = parseFloat(d['total_comments']?.value ?? '')
      const upvotes = parseFloat(d['total_upvotes']?.value ?? '')
      return {
        week: format(new Date(wk + 'T00:00:00'), 'MMM d'),
        Views: isNaN(views) ? 0 : views,
        Comments: isNaN(comments) ? 0 : comments,
        Upvotes: isNaN(upvotes) ? 0 : upvotes,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekKeys, w0.data, w1.data, w2.data, w3.data, w4.data, w5.data])

  const hasData = chartData.some(d => d.Views > 0 || d.Comments > 0 || d.Upvotes > 0)
  if (!hasData) return <div className={CARD}><p className="eyebrow mb-4">Engagement Breakdown (Views, Comments, Upvotes)</p><p className="text-[13px] text-[#7A6A60]">No data yet</p></div>

  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">Engagement Breakdown — Views, Comments, Upvotes (6 Weeks)</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid {...GRID_S} />
          <XAxis dataKey="week" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={fmtY} />
          <Tooltip content={<Tip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#7A6A60', paddingTop: 8 }} />
          <Bar dataKey="Views" fill="#2563EB" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Comments" fill="#D97706" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Upvotes" fill="#16A34A" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

/* ── Page Inner ── */

function RedditPageInner({ weekStart }: { weekStart: string }) {
  const { user } = useAuth()
  const section = SECTION_MAP['reddit']
  const { data, loading, isReadOnly } = useRangeMetrics('reddit')
  const prevData = usePrevRangeMetrics('reddit')
  const { customMetrics, labelOverrides, loading: customLoading, addMetric, renameMetric } = useCustomMetrics('reddit')

  const handleAdd = useCallback(async (l: string, u: string) => { await addMetric(l, u, user?.email ?? 'unknown') }, [addMetric, user])
  const handleRename = useCallback(async (k: string, l: string) => { await renameMetric(k, l) }, [renameMetric])

  if (loading || customLoading) return <LoadingScreen />

  const overriddenMetrics = section.metrics.map(m => { const o = labelOverrides[m.key]; return o ? { ...m, label: o } : m })
  const allMetrics = [...overriddenMetrics, ...customMetrics]
  const hasData = Object.keys(data).length > 0 && Object.values(data).some(d => d.value && d.value !== '')
  const filledCount = Object.values(data).filter(d => d.value && d.value !== '').length

  return (
    <div className="space-y-6">
      {/* Read-only banner for month/custom mode */}
      <ReadOnlyBanner />

      {!hasData && !isReadOnly && (
        <div className="rounded-[20px] border border-[#C96A5A]/30 bg-[rgba(201,106,90,.06)] p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(201,106,90,.12)] mt-0.5"><span className="text-[16px]">📝</span></div>
            <div>
              <p className="text-[14px] font-[600] text-[#2A1F1A]">Time to update Reddit numbers</p>
              <p className="text-[13px] text-[#7A6A60] mt-0.5">Enter posts, views, comments, and upvotes below.</p>
            </div>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {hasData && filledCount < allMetrics.length && (
        <div className="flex items-center gap-3 px-1">
          <div className="flex-1 h-1.5 rounded-full bg-[#F2EDE8] overflow-hidden">
            <div className="h-full rounded-full bg-[#6B4C4C] transition-all duration-500" style={{ width: `${Math.round((filledCount / allMetrics.length) * 100)}%` }} />
          </div>
          <span className="text-[12px] text-[#7A6A60] shrink-0">{filledCount}/{allMetrics.length} filled</span>
        </div>
      )}

      {/* Scorecards */}
      {hasData && <ScoreCards data={data} prevData={prevData} />}

      {/* WoW Line Chart — Posts goals vs actuals */}
      {hasData && <PostsWoWChart weekStart={weekStart} />}

      {/* Bar Chart — Views, Comments, Upvotes breakdown */}
      {hasData && <EngagementBarChart weekStart={weekStart} />}

      {/* Inline metric table for manual entry — at the bottom after charts */}
      <InlineMetricTable sectionKey="reddit" metrics={overriddenMetrics} weekStart={weekStart} customMetrics={customMetrics} onAddMetric={handleAdd} onRenameMetric={handleRename} />

      {/* Tasks */}
      <TaskTextBoxes sectionKey="reddit" weekStart={weekStart} />
    </div>
  )
}

/* ── Page Export ── */

export default function Page() {
  const { weekStart } = useWeek()
  const section = SECTION_MAP['reddit']

  return (
    <SectionShell title={section.label} description={section.description}>
      <RedditPageInner weekStart={weekStart} />
    </SectionShell>
  )
}
