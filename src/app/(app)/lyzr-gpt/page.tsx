'use client'

import { useCallback } from 'react'
import { SectionShell } from '@/components/SectionShell'
import { InlineMetricTable } from '@/components/InlineMetricTable'
import { LoadingScreen } from '@/components/LoadingScreen'
import { useCustomMetrics } from '@/hooks/useCustomMetrics'
import { SECTION_MAP } from '@/lib/metrics-config'
import { useAuth } from '@/lib/auth-context'
import { useRangeMetrics, usePrevRangeMetrics } from '@/hooks/useRangeMetrics'
import { ReadOnlyBanner } from '@/components/ReadOnlyBanner'
import { TrendingUp, TrendingDown, Minus, Users, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LeadsWoWChart } from '@/components/leads/LeadsWoWChart'
import { LeadsMoMChart } from '@/components/leads/LeadsMoMChart'
import { TaskTextBoxes } from '@/components/shared/TaskTextBoxes'
import { useWeek } from '@/lib/week-context'
import type { WeekMetrics } from '@/hooks/useWeeklyMetrics'

/* ── Scorecards ── */

function fmt(value: string, unit: 'number' | 'currency'): string {
  if (!value && value !== '0') return '—'
  const n = parseFloat(value)
  if (isNaN(n)) return value
  if (unit === 'currency') {
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
    return `$${n.toLocaleString()}`
  }
  return n.toLocaleString()
}

function ScoreCards({ data, prevData }: { data: WeekMetrics; prevData: WeekMetrics }) {
  const cards: { key: string; label: string; unit: 'number' | 'currency'; icon: React.ReactNode; ac: string; ab: string }[] = [
    { key: 'total_mqls', label: "Total MQL's", unit: 'number', icon: <Users className="h-4 w-4" />, ac: '#6B4C4C', ab: 'rgba(107,76,76,.08)' },
    { key: 'total_ad_spent', label: 'Total Ad Spent: Last Week', unit: 'currency', icon: <DollarSign className="h-4 w-4" />, ac: '#D97706', ab: 'rgba(217,119,6,.08)' },
  ]

  return (
    <div className="grid grid-cols-2 gap-4">
      {cards.map(card => {
        const val = data[card.key]?.value ?? ''
        const prev = prevData[card.key]?.value ?? ''
        const c = parseFloat(val), p = parseFloat(prev)
        const d = !isNaN(c) && !isNaN(p) && p > 0 ? { pct: Math.round(((c - p) / p) * 100), dir: c > p ? 'up' as const : c < p ? 'down' as const : 'flat' as const } : null
        return (
          <div key={card.key} className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)] hover:shadow-[0_8px_40px_rgba(40,20,10,.13)] hover:-translate-y-1 transition-all duration-200">
            <div className="inline-flex items-center justify-center rounded-full p-2 mb-3" style={{ background: card.ab, color: card.ac }}>{card.icon}</div>
            <p className="eyebrow mb-2">{card.label}</p>
            <p className="font-['Playfair_Display'] font-[500] text-[2rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">{val ? fmt(val, card.unit) : '—'}</p>
            {d && (
              <div className={cn('mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', d.dir === 'up' && 'delta-up', d.dir === 'down' && 'delta-down', d.dir === 'flat' && 'delta-flat')}>
                {d.dir === 'up' && <TrendingUp className="h-3 w-3" />}
                {d.dir === 'down' && <TrendingDown className="h-3 w-3" />}
                {d.dir === 'flat' && <Minus className="h-3 w-3" />}
                {d.dir === 'up' ? '+' : ''}{d.pct}% vs prev week
              </div>
            )}
            {prev && <p className="caption mt-1">Prev: {fmt(prev, card.unit)}</p>}
          </div>
        )
      })}
    </div>
  )
}

/* ── Page ── */

function LyzrGPTPageInner({ weekStart }: { weekStart: string }) {
  const { user } = useAuth()
  const section = SECTION_MAP['lyzr-gpt']
  const { data, loading, isReadOnly, saveMetric } = useRangeMetrics('lyzr-gpt')
  const prevData = usePrevRangeMetrics('lyzr-gpt')
  const { customMetrics, labelOverrides, loading: customLoading, addMetric, renameMetric } = useCustomMetrics('lyzr-gpt')

  const handleSave = useCallback(async (k: string, v: string, n: string) => { await saveMetric(k, v, n, user?.email ?? 'unknown') }, [saveMetric, user])
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
              <p className="text-[14px] font-[600] text-[#2A1F1A]">Time to update LyzrGPT numbers</p>
              <p className="text-[13px] text-[#7A6A60] mt-0.5">Enter MQLs and ad spend below.</p>
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

      {hasData && <ScoreCards data={data} prevData={prevData} />}

      {hasData && (
        <div className="grid gap-4 md:grid-cols-2">
          <LeadsWoWChart sectionKey="lyzr-gpt" weekStart={weekStart} actualKey="total_mqls" goalKey="goal_mqls" title="WoW Trend — Total MQL's Goals vs Actuals" actualLabel="Actual MQLs" goalLabel="Goal MQLs" />
          <LeadsMoMChart sectionKey="lyzr-gpt" weekStart={weekStart} actualKey="total_mqls" goalKey="goal_mqls" title="MoM Trend — Total MQL's Goals vs Actuals" actualLabel="Actual MQLs" goalLabel="Goal MQLs" />
        </div>
      )}

      {/* Task text boxes — always above the metric table */}
      <TaskTextBoxes sectionKey="lyzr-gpt" weekStart={weekStart} lastWeekKey="tasks_last_week" thisWeekKey="tasks_this_week" />

      {/* Metric table — always at the bottom */}
      <InlineMetricTable sectionKey="lyzr-gpt" metrics={overriddenMetrics} weekStart={weekStart} customMetrics={customMetrics} onAddMetric={handleAdd} onRenameMetric={handleRename} />
    </div>
  )
}

export default function Page() {
  const { weekStart } = useWeek()
  const section = SECTION_MAP['lyzr-gpt']
  return (
    <SectionShell title={section.label} description={section.description}>
      <LyzrGPTPageInner weekStart={weekStart} />
    </SectionShell>
  )
}
