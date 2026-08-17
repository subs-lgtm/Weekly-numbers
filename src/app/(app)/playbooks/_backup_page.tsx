// BACKUP — original playbooks page before iframe replacement
// To restore: rename this file to page.tsx and delete the current page.tsx
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
import { TrendingUp, TrendingDown, Minus, Users, DollarSign, Calculator } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts'
import { LeadsWoWChart } from '@/components/leads/LeadsWoWChart'
import { LeadsMoMChart } from '@/components/leads/LeadsMoMChart'
import { TaskTextBoxes } from '@/components/shared/TaskTextBoxes'
import type { WeekMetrics } from '@/hooks/useWeeklyMetrics'

function fmtVal(value: string, unit: 'number' | 'currency'): string {
  if (!value && value !== '0') return '—'
  const n = parseFloat(value)
  if (isNaN(n)) return value
  if (unit === 'currency') { if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`; return `${n.toLocaleString()}` }
  return n.toLocaleString()
}

function ScoreCards({ data, prevData }: { data: WeekMetrics; prevData: WeekMetrics }) {
  const cards: { key: string; label: string; icon: React.ReactNode; unit: 'number' | 'currency'; ac: string; ab: string }[] = [
    { key: 'total_leads', label: 'Total Leads', icon: <Users className="h-4 w-4" />, unit: 'number', ac: '#6B4C4C', ab: 'rgba(107,76,76,.08)' },
    { key: 'total_ad_spent', label: 'Total Ad Spent', icon: <DollarSign className="h-4 w-4" />, unit: 'currency', ac: '#D97706', ab: 'rgba(217,119,6,.08)' },
    { key: 'cost_per_lead', label: 'Cost Per Playbook Lead', icon: <Calculator className="h-4 w-4" />, unit: 'currency', ac: '#2563EB', ab: 'rgba(37,99,235,.08)' },
  ]
  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map(card => {
        const val = data[card.key]?.value ?? ''
        const prev = prevData[card.key]?.value ?? ''
        const c = parseFloat(val), p = parseFloat(prev)
        const d = !isNaN(c) && !isNaN(p) && p > 0 ? { pct: Math.round(((c - p) / p) * 100), dir: c > p ? 'up' as const : c < p ? 'down' as const : 'flat' as const } : null
        return (
          <div key={card.key} className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)] hover:shadow-[0_8px_40px_rgba(40,20,10,.13)] hover:-translate-y-1 transition-all duration-200">
            <div className="inline-flex items-center justify-center rounded-full p-2 mb-3" style={{ background: card.ab, color: card.ac }}>{card.icon}</div>
            <p className="eyebrow mb-2">{card.label}</p>
            <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">{val ? fmtVal(val, card.unit) : '—'}</p>
            {d && (
              <div className={cn('mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', d.dir === 'up' && 'delta-up', d.dir === 'down' && 'delta-down', d.dir === 'flat' && 'delta-flat')}>
                {d.dir === 'up' && <TrendingUp className="h-3 w-3" />}{d.dir === 'down' && <TrendingDown className="h-3 w-3" />}{d.dir === 'flat' && <Minus className="h-3 w-3" />}
                {d.pct > 0 ? '+' : ''}{d.pct}% WoW
              </div>
            )}
            {prev && <p className="caption mt-1">Prev: {fmtVal(prev, card.unit)}</p>}
          </div>
        )
      })}
    </div>
  )
}

function PlaybooksPageInner({ weekStart }: { weekStart: string }) {
  const { user } = useAuth()
  const section = SECTION_MAP['playbooks']
  const { data, loading, isReadOnly, saveMetric } = useRangeMetrics('playbooks')
  const prevData = usePrevRangeMetrics('playbooks')
  const { customMetrics, labelOverrides, loading: customLoading, addMetric, renameMetric } = useCustomMetrics('playbooks')

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
              <p className="text-[14px] font-[600] text-[#2A1F1A]">Time to update Playbooks numbers</p>
              <p className="text-[13px] text-[#7A6A60] mt-0.5">Enter leads, ad spend, and top playbooks below.</p>
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
          <LeadsWoWChart sectionKey="playbooks" weekStart={weekStart} actualKey="total_leads" goalKey="goal_leads" title="WoW — Playbook Leads Goals vs Actuals" actualLabel="Actual Leads" goalLabel="Goal Leads" />
          <LeadsMoMChart sectionKey="playbooks" weekStart={weekStart} actualKey="total_leads" goalKey="goal_leads" title="MoM — Playbook Leads Goals vs Actuals" actualLabel="Actual Leads" goalLabel="Goal Leads" />
        </div>
      )}
      <TaskTextBoxes sectionKey="playbooks" weekStart={weekStart} lastWeekKey="tasks_last_week" thisWeekKey="tasks_this_week" />
      <InlineMetricTable sectionKey="playbooks" metrics={overriddenMetrics} weekStart={weekStart} customMetrics={customMetrics} onAddMetric={handleAdd} onRenameMetric={handleRename} />
    </div>
  )
}

export default function Page() {
  const [weekStart, setWeekStart] = useState(weekKey())
  const section = SECTION_MAP['playbooks']
  return (
    <SectionShell title={section.label} description={section.description}>
      <PlaybooksPageInner weekStart={weekStart} />
    </SectionShell>
  )
}
