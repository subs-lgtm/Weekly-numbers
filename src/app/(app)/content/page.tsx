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
import { TrendingUp, TrendingDown, Minus, FileText, BookOpen, BarChart3, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TaskTextBoxes } from '@/components/shared/TaskTextBoxes'
import { useWeek } from '@/lib/week-context'
import type { WeekMetrics } from '@/hooks/useWeeklyMetrics'

type SC = { key: string; label: string; icon: React.ReactNode; ac: string; ab: string }

const CARDS: SC[] = [
  { key: 'blogs_published', label: 'Blogs Published', icon: <FileText className="h-4 w-4" />, ac: '#6B4C4C', ab: 'rgba(107,76,76,.08)' },
  { key: 'case_studies_published', label: 'Case Studies Published', icon: <BookOpen className="h-4 w-4" />, ac: '#2563EB', ab: 'rgba(37,99,235,.08)' },
  { key: 'blog_sessions', label: 'Blog Sessions (GA4)', icon: <BarChart3 className="h-4 w-4" />, ac: '#16A34A', ab: 'rgba(22,163,74,.08)' },
  { key: 'case_study_sessions', label: 'Case Studies (GA4)', icon: <BarChart3 className="h-4 w-4" />, ac: '#D97706', ab: 'rgba(217,119,6,.08)' },
  { key: 'leads_from_blogs', label: 'Leads from Blogs', icon: <Users className="h-4 w-4" />, ac: '#7C3AED', ab: 'rgba(124,58,237,.08)' },
  { key: 'leads_from_case_studies', label: 'Leads from Case Studies', icon: <Users className="h-4 w-4" />, ac: '#C96A5A', ab: 'rgba(201,106,90,.08)' },
]

function ScoreCards({ data, prevData }: { data: WeekMetrics; prevData: WeekMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
      {CARDS.map(card => {
        const val = data[card.key]?.value ?? ''
        const prev = prevData[card.key]?.value ?? ''
        const c = parseFloat(val), p = parseFloat(prev)
        const d = !isNaN(c) && !isNaN(p) && p > 0 ? { pct: Math.round(((c - p) / p) * 100), dir: c > p ? 'up' as const : c < p ? 'down' as const : 'flat' as const } : null
        const n = parseFloat(val)
        const fmt = !isNaN(n) ? (n >= 1000 ? `${(n/1000).toFixed(1)}k` : n.toLocaleString()) : '—'
        return (
          <div key={card.key} className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)] hover:shadow-[0_8px_40px_rgba(40,20,10,.13)] hover:-translate-y-1 transition-all duration-200">
            <div className="inline-flex items-center justify-center rounded-full p-2 mb-3" style={{ background: card.ab, color: card.ac }}>{card.icon}</div>
            <p className="eyebrow mb-2">{card.label}</p>
            <p className="font-['Playfair_Display'] font-[500] text-[1.6rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">{val ? fmt : '—'}</p>
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

function ContentPageInner({ weekStart }: { weekStart: string }) {
  const { user } = useAuth()
  const section = SECTION_MAP['content']
  const { data, loading, isReadOnly, saveMetric } = useRangeMetrics('content')
  const prevData = usePrevRangeMetrics('content')
  const { customMetrics, labelOverrides, loading: customLoading, addMetric, renameMetric } = useCustomMetrics('content')

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
              <p className="text-[14px] font-[600] text-[#2A1F1A]">Time to update Content numbers</p>
              <p className="text-[13px] text-[#7A6A60] mt-0.5">Enter blogs, case studies, sessions, and leads below.</p>
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

      <TaskTextBoxes sectionKey="content" weekStart={weekStart} lastWeekKey="tasks_last_week" thisWeekKey="tasks_this_week" />

      <InlineMetricTable sectionKey="content" metrics={overriddenMetrics} weekStart={weekStart} customMetrics={customMetrics} onAddMetric={handleAdd} onRenameMetric={handleRename} />

      {/* Playbooks Dashboard */}
      <div className="space-y-2">
        <h3 className="font-['DM_Sans'] text-[14px] font-[600] text-[#2A1F1A]">Playbook Lead Dashboard</h3>
        <div className="rounded-[20px] border border-[#D4CBC0] overflow-hidden shadow-[0_4px_20px_rgba(40,20,10,.07)]" style={{ height: 'calc(100vh - 280px)' }}>
          <iframe
            src="https://playbook-lead-dashboard.lovable.app/"
            className="w-full h-full"
            style={{ border: 'none', display: 'block' }}
            allow="fullscreen"
            title="Playbook Lead Dashboard"
          />
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  const { weekStart } = useWeek()
  const section = SECTION_MAP['content']
  return (
    <SectionShell title={section.label} description={section.description}>
      <ContentPageInner weekStart={weekStart} />
    </SectionShell>
  )
}
