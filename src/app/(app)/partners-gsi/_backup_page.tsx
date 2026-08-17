'use client'

import { useState, useCallback, useMemo } from 'react'
import { SectionShell } from '@/components/SectionShell'
import { InlineMetricTable } from '@/components/InlineMetricTable'
import { LoadingScreen } from '@/components/LoadingScreen'
import { weekKey } from '@/hooks/useWeeklyMetrics'
import { useCustomMetrics } from '@/hooks/useCustomMetrics'
import { SECTION_MAP } from '@/lib/metrics-config'
import { useAuth } from '@/lib/auth-context'
import { useRangeMetrics, usePrevRangeMetrics } from '@/hooks/useRangeMetrics'
import { ReadOnlyBanner } from '@/components/ReadOnlyBanner'
import { useWeeklyMetrics } from '@/hooks/useWeeklyMetrics'
import { TrendingUp, TrendingDown, Minus, MessageSquare, Calendar, Infinity, DollarSign, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LeadsMoMChart } from '@/components/leads/LeadsMoMChart'
import { TaskTextBoxes } from '@/components/shared/TaskTextBoxes'
import { format, subMonths, startOfMonth, addWeeks, startOfWeek, isBefore, isAfter } from 'date-fns'
import type { WeekMetrics } from '@/hooks/useWeeklyMetrics'

function fmt(value: string | number, unit: 'number' | 'currency'): string {
  const v = typeof value === 'number' ? String(value) : value
  if (!v && v !== '0') return '—'
  const n = parseFloat(v)
  if (isNaN(n)) return v
  if (unit === 'currency') { return n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : `${n.toLocaleString()}` }
  return n.toLocaleString()
}

function deltaCalc(cur: number, prev: number) {
  if (isNaN(cur) || isNaN(prev) || prev === 0) return null
  const pct = Math.round(((cur - prev) / prev) * 100)
  return { pct, dir: pct > 0 ? 'up' as const : pct < 0 ? 'down' as const : 'flat' as const }
}

function weekKeysForMonth(year: number, month: number): string[] {
  const monthStart = new Date(year, month, 1)
  const monthEnd = new Date(year, month + 1, 0)
  const keys: string[] = []
  let cursor = startOfWeek(monthStart, { weekStartsOn: 1 })
  if (isBefore(cursor, monthStart)) cursor = addWeeks(cursor, 1)
  while (!isAfter(cursor, monthEnd)) { keys.push(format(cursor, 'yyyy-MM-dd')); cursor = addWeeks(cursor, 1) }
  return keys
}

function ScoreCards({ data, prevData, momConversations }: { data: WeekMetrics; prevData: WeekMetrics; momConversations: number }) {
  const convos = parseFloat(data['conversations_started']?.value ?? '') || 0
  const prevConvos = parseFloat(prevData['conversations_started']?.value ?? '') || 0
  const lifetime = parseFloat(data['lifetime_conversations']?.value ?? '') || 0

  const cards: { label: string; value: number; unit: 'number' | 'currency'; d: ReturnType<typeof deltaCalc>; icon: React.ReactNode; ac: string; ab: string; sub?: string }[] = [
    { label: 'Conversations Started', value: convos, unit: 'number', d: deltaCalc(convos, prevConvos), icon: <MessageSquare className="h-4 w-4" />, ac: '#6B4C4C', ab: 'rgba(107,76,76,.08)' },
    { label: 'MoM Conversations', value: momConversations, unit: 'number', d: null, icon: <Calendar className="h-4 w-4" />, ac: '#16A34A', ab: 'rgba(22,163,74,.08)', sub: 'Auto-calculated' },
    { label: 'Lifetime Conversations', value: lifetime, unit: 'number', d: null, icon: <Infinity className="h-4 w-4" />, ac: '#2563EB', ab: 'rgba(37,99,235,.08)' },
    { label: 'Potential Pipeline', value: parseFloat(data['potential_pipeline']?.value ?? '') || 0, unit: 'currency', d: deltaCalc(parseFloat(data['potential_pipeline']?.value ?? '') || 0, parseFloat(prevData['potential_pipeline']?.value ?? '') || 0), icon: <DollarSign className="h-4 w-4" />, ac: '#D97706', ab: 'rgba(217,119,6,.08)' },
    { label: 'Top Funnel', value: parseFloat(data['top_funnel_leads']?.value ?? '') || 0, unit: 'number', d: deltaCalc(parseFloat(data['top_funnel_leads']?.value ?? '') || 0, parseFloat(prevData['top_funnel_leads']?.value ?? '') || 0), icon: <Filter className="h-4 w-4" />, ac: '#7C3AED', ab: 'rgba(124,58,237,.08)' },
    { label: 'Middle Funnel', value: parseFloat(data['middle_funnel_leads']?.value ?? '') || 0, unit: 'number', d: deltaCalc(parseFloat(data['middle_funnel_leads']?.value ?? '') || 0, parseFloat(prevData['middle_funnel_leads']?.value ?? '') || 0), icon: <Filter className="h-4 w-4" />, ac: '#0891B2', ab: 'rgba(8,145,178,.08)' },
    { label: 'Bottom Funnel', value: parseFloat(data['bottom_funnel_leads']?.value ?? '') || 0, unit: 'number', d: deltaCalc(parseFloat(data['bottom_funnel_leads']?.value ?? '') || 0, parseFloat(prevData['bottom_funnel_leads']?.value ?? '') || 0), icon: <Filter className="h-4 w-4" />, ac: '#C96A5A', ab: 'rgba(201,106,90,.08)' },
    { label: 'Ad Spend', value: parseFloat(data['ad_spend']?.value ?? '') || 0, unit: 'currency', d: deltaCalc(parseFloat(data['ad_spend']?.value ?? '') || 0, parseFloat(prevData['ad_spend']?.value ?? '') || 0), icon: <DollarSign className="h-4 w-4" />, ac: '#DC2626', ab: 'rgba(220,38,38,.08)' },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map(card => (
        <div key={card.label} className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)] hover:shadow-[0_8px_40px_rgba(40,20,10,.13)] hover:-translate-y-1 transition-all duration-200">
          <div className="inline-flex items-center justify-center rounded-full p-2 mb-3" style={{ background: card.ab, color: card.ac }}>{card.icon}</div>
          <p className="eyebrow mb-2">{card.label}</p>
          <p className="font-['Playfair_Display'] font-[500] text-[1.5rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">{card.value > 0 ? fmt(card.value, card.unit) : '—'}</p>
          {card.d && (
            <div className={cn('mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', card.d.dir === 'up' && 'delta-up', card.d.dir === 'down' && 'delta-down', card.d.dir === 'flat' && 'delta-flat')}>
              {card.d.dir === 'up' && <TrendingUp className="h-3 w-3" />}{card.d.dir === 'down' && <TrendingDown className="h-3 w-3" />}{card.d.dir === 'flat' && <Minus className="h-3 w-3" />}
              {card.d.pct > 0 ? '+' : ''}{card.d.pct}%
            </div>
          )}
          {card.sub && <p className="caption mt-1 italic">{card.sub}</p>}
        </div>
      ))}
    </div>
  )
}

function GSIPageInner({ weekStart }: { weekStart: string }) {
  const { user } = useAuth()
  const section = SECTION_MAP['partners-gsi']
  const { data, loading, isReadOnly, saveMetric } = useRangeMetrics('partners-gsi')
  const prevData = usePrevRangeMetrics('partners-gsi')
  const { customMetrics, labelOverrides, loading: customLoading, addMetric, renameMetric } = useCustomMetrics('partners-gsi')

  const selected = useMemo(() => new Date(weekStart + 'T00:00:00'), [weekStart])
  const currentMonthWeeks = useMemo(() => weekKeysForMonth(selected.getFullYear(), selected.getMonth()), [selected])
  const padded = useMemo(() => { const p = [...currentMonthWeeks]; while (p.length < 6) p.push(p[p.length - 1] || weekStart); return p }, [currentMonthWeeks, weekStart])

  const m0 = useWeeklyMetrics('partners-gsi', padded[0])
  const m1 = useWeeklyMetrics('partners-gsi', padded[1])
  const m2 = useWeeklyMetrics('partners-gsi', padded[2])
  const m3 = useWeeklyMetrics('partners-gsi', padded[3])
  const m4 = useWeeklyMetrics('partners-gsi', padded[4])
  const m5 = useWeeklyMetrics('partners-gsi', padded[5])
  const mAll = [m0, m1, m2, m3, m4, m5]

  const momConversations = useMemo(() => {
    let total = 0
    const seen = new Set<string>()
    currentMonthWeeks.forEach((wk, i) => {
      if (seen.has(wk)) return; seen.add(wk)
      const idx = padded.indexOf(wk)
      if (idx >= 0) { const n = parseFloat(mAll[idx].data['conversations_started']?.value ?? ''); if (!isNaN(n)) total += n }
    })
    return total
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonthWeeks, padded, m0.data, m1.data, m2.data, m3.data, m4.data, m5.data])

  const handleAdd = useCallback(async (l: string, u: string) => { await addMetric(l, u, user?.email ?? 'unknown') }, [addMetric, user])
  const handleRename = useCallback(async (k: string, l: string) => { await renameMetric(k, l) }, [renameMetric])

  if (loading || customLoading) return <LoadingScreen />

  const overriddenMetrics = section.metrics.map(m => { const o = labelOverrides[m.key]; return o ? { ...m, label: o } : m })
  const allMetrics = [...overriddenMetrics, ...customMetrics]
  const hasData = Object.keys(data).length > 0 && Object.values(data).some(d => d.value && d.value !== '')
  const filledCount = Object.values(data).filter(d => d.value && d.value !== '').length

  return (
    <div className="space-y-6">
      <ReadOnlyBanner />
      {!hasData && !isReadOnly && (
        <div className="rounded-[20px] border border-[#C96A5A]/30 bg-[rgba(201,106,90,.06)] p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(201,106,90,.12)] mt-0.5"><span className="text-[16px]">📝</span></div>
            <div>
              <p className="text-[14px] font-[600] text-[#2A1F1A]">Time to update GSI & SI numbers</p>
              <p className="text-[13px] text-[#7A6A60] mt-0.5">Enter conversations, pipeline, funnel leads, and ad spend below.</p>
            </div>
          </div>
        </div>
      )}
      {hasData && filledCount < allMetrics.length && (
        <div className="flex items-center gap-3 px-1">
          <div className="flex-1 h-1.5 rounded-full bg-[#F2EDE8] overflow-hidden">
            <div className="h-full rounded-full bg-[#6B4C4C] transition-all duration-500" style={{ width: `${Math.round((filledCount / allMetrics.length) * 100)}%` }} />
          </div>
          <span className="text-[12px] text-[#7A6A60] shrink-0">{filledCount}/{allMetrics.length} filled</span>
        </div>
      )}
      {hasData && <ScoreCards data={data} prevData={prevData} momConversations={momConversations} />}
      {hasData && (
        <LeadsMoMChart sectionKey="partners-gsi" weekStart={weekStart} actualKey="conversations_started" goalKey="goal_conversations" title="MoM — Conversations Started Goals vs Actuals" actualLabel="Actual" goalLabel="Goal" />
      )}
      <TaskTextBoxes sectionKey="partners-gsi" weekStart={weekStart} lastWeekKey="tasks_last_week" thisWeekKey="tasks_this_week" />
      <InlineMetricTable sectionKey="partners-gsi" metrics={overriddenMetrics} weekStart={weekStart} customMetrics={customMetrics} onAddMetric={handleAdd} onRenameMetric={handleRename} />
    </div>
  )
}

export default function Page() {
  const [weekStart, setWeekStart] = useState(weekKey())
  const section = SECTION_MAP['partners-gsi']
  return (
    <SectionShell title={section.label} description={section.description}>
      <GSIPageInner weekStart={weekStart} />
    </SectionShell>
  )
}
