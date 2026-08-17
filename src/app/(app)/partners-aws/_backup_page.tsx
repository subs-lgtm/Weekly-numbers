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
import { TrendingUp, TrendingDown, Minus, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { format, subWeeks } from 'date-fns'
import { TaskTextBoxes } from '@/components/shared/TaskTextBoxes'
import type { WeekMetrics } from '@/hooks/useWeeklyMetrics'

const CARD = 'rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]'
const TICK = { fontSize: 11, fill: '#7A6A60' }
const GRID_S = { strokeDasharray: '3 3', stroke: '#D4CBC0', strokeOpacity: 0.5, vertical: false as const }

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[14px] border border-[#D4CBC0] bg-white/95 px-4 py-3 shadow-[0_8px_32px_rgba(40,20,10,.10)]">
      <p className="eyebrow mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-[13px] text-[#2A1F1A]">
          <span className="h-2 w-2 rounded-full" style={{ background: p.fill }} />
          <span className="text-[#7A6A60]">{p.name}:</span>
          <span className="font-[600]">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  )
}

function MQLsBarChart({ sectionKey, weekStart }: { sectionKey: string; weekStart: string }) {
  const wks = useMemo(() => {
    const r: string[] = []
    const b = new Date(weekStart + 'T00:00:00')
    for (let i = 5; i >= 0; i--) r.push(format(subWeeks(b, i), 'yyyy-MM-dd'))
    return r
  }, [weekStart])

  const w0 = useWeeklyMetrics(sectionKey, wks[0])
  const w1 = useWeeklyMetrics(sectionKey, wks[1])
  const w2 = useWeeklyMetrics(sectionKey, wks[2])
  const w3 = useWeeklyMetrics(sectionKey, wks[3])
  const w4 = useWeeklyMetrics(sectionKey, wks[4])
  const w5 = useWeeklyMetrics(sectionKey, wks[5])
  const weeks = [w0, w1, w2, w3, w4, w5]

  const chartData = useMemo(() => wks.map((wk, i) => {
    const d = weeks[i].data
    const a = parseFloat(d['total_mqls']?.value ?? ''); const g = parseFloat(d['goal_mqls']?.value ?? '')
    return { week: format(new Date(wk + 'T00:00:00'), 'MMM d'), Actual: isNaN(a) ? 0 : a, Goal: isNaN(g) ? 0 : g }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [wks, w0.data, w1.data, w2.data, w3.data, w4.data, w5.data])

  const hasData = chartData.some(d => d.Actual > 0 || d.Goal > 0)
  if (!hasData) return <div className={CARD}><p className="eyebrow mb-4">WoW — Total MQL's Goals vs Actuals</p><p className="text-[13px] text-[#7A6A60]">No data yet</p></div>

  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">WoW — Total MQL's Goals vs Actuals</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid {...GRID_S} />
          <XAxis dataKey="week" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} />
          <Tooltip content={<Tip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#7A6A60', paddingTop: 8 }} />
          <Bar dataKey="Actual" fill="#6B4C4C" radius={[4, 4, 0, 0]} barSize={24} />
          <Bar dataKey="Goal" fill="#D4CBC0" radius={[4, 4, 0, 0]} barSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function AWSPageInner({ weekStart }: { weekStart: string }) {
  const { user } = useAuth()
  const section = SECTION_MAP['partners-aws']
  const { data, loading, isReadOnly, saveMetric } = useRangeMetrics('partners-aws')
  const prevData = usePrevRangeMetrics('partners-aws')
  const { customMetrics, labelOverrides, loading: customLoading, addMetric, renameMetric } = useCustomMetrics('partners-aws')

  const handleAdd = useCallback(async (l: string, u: string) => { await addMetric(l, u, user?.email ?? 'unknown') }, [addMetric, user])
  const handleRename = useCallback(async (k: string, l: string) => { await renameMetric(k, l) }, [renameMetric])

  if (loading || customLoading) return <LoadingScreen />

  const overriddenMetrics = section.metrics.map(m => { const o = labelOverrides[m.key]; return o ? { ...m, label: o } : m })
  const allMetrics = [...overriddenMetrics, ...customMetrics]
  const hasData = Object.keys(data).length > 0 && Object.values(data).some(d => d.value && d.value !== '')
  const filledCount = Object.values(data).filter(d => d.value && d.value !== '').length

  const val = data['total_mqls']?.value ?? ''
  const prev = prevData['total_mqls']?.value ?? ''
  const c = parseFloat(val), p = parseFloat(prev)
  const d = !isNaN(c) && !isNaN(p) && p > 0 ? { pct: Math.round(((c - p) / p) * 100), dir: c > p ? 'up' as const : c < p ? 'down' as const : 'flat' as const } : null

  return (
    <div className="space-y-6">
      <ReadOnlyBanner />

      {!hasData && !isReadOnly && (
        <div className="rounded-[20px] border border-[#C96A5A]/30 bg-[rgba(201,106,90,.06)] p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(201,106,90,.12)] mt-0.5"><span className="text-[16px]">📝</span></div>
            <div>
              <p className="text-[14px] font-[600] text-[#2A1F1A]">Time to update AWS & Hyperscalers numbers</p>
              <p className="text-[13px] text-[#7A6A60] mt-0.5">Enter MQLs and goals below.</p>
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

      {hasData && (
        <div className="max-w-xs">
          <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
            <div className="inline-flex items-center justify-center rounded-full p-2 mb-3 bg-[rgba(107,76,76,.08)] text-[#6B4C4C]"><Users className="h-4 w-4" /></div>
            <p className="eyebrow mb-2">Total MQL's</p>
            <p className="font-['Playfair_Display'] font-[500] text-[2rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">{val ? parseFloat(val).toLocaleString() : '—'}</p>
            {d && (
              <div className={cn('mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', d.dir === 'up' && 'delta-up', d.dir === 'down' && 'delta-down', d.dir === 'flat' && 'delta-flat')}>
                {d.dir === 'up' && <TrendingUp className="h-3 w-3" />}{d.dir === 'down' && <TrendingDown className="h-3 w-3" />}{d.dir === 'flat' && <Minus className="h-3 w-3" />}
                {d.pct > 0 ? '+' : ''}{d.pct}% WoW
              </div>
            )}
            {prev && <p className="caption mt-1">Prev: {parseFloat(prev).toLocaleString()}</p>}
          </div>
        </div>
      )}

      {hasData && <MQLsBarChart sectionKey="partners-aws" weekStart={weekStart} />}

      <TaskTextBoxes sectionKey="partners-aws" weekStart={weekStart} lastWeekKey="tasks_last_week" thisWeekKey="tasks_this_week" />

      <InlineMetricTable sectionKey="partners-aws" metrics={overriddenMetrics} weekStart={weekStart} customMetrics={customMetrics} onAddMetric={handleAdd} onRenameMetric={handleRename} />
    </div>
  )
}

export default function Page() {
  const [weekStart, setWeekStart] = useState(weekKey())
  const section = SECTION_MAP['partners-aws']
  return (
    <SectionShell title={section.label} description={section.description}>
      <AWSPageInner weekStart={weekStart} />
    </SectionShell>
  )
}
