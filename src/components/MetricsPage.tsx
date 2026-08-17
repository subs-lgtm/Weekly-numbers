'use client'

import { useCallback } from 'react'
import { SectionShell } from '@/components/SectionShell'
import { InlineMetricTable } from '@/components/InlineMetricTable'
import { MetricCard } from '@/components/MetricCard'
import { SectionCharts } from '@/components/SectionCharts'
import { LoadingScreen } from '@/components/LoadingScreen'
import { ReadOnlyBanner } from '@/components/ReadOnlyBanner'
import { useRangeMetrics, usePrevRangeMetrics } from '@/hooks/useRangeMetrics'
import { useCustomMetrics } from '@/hooks/useCustomMetrics'
import { SECTION_MAP } from '@/lib/metrics-config'
import { useAuth } from '@/lib/auth-context'
import { useWeek } from '@/lib/week-context'

type Props = { sectionKey: string }

function MetricsPageInner({ sectionKey }: { sectionKey: string }) {
  const { user } = useAuth()
  const { weekStart } = useWeek()
  const section = SECTION_MAP[sectionKey]
  const { data, loading, isReadOnly, saveMetric } = useRangeMetrics(sectionKey)
  const prevData = usePrevRangeMetrics(sectionKey)
  const { customMetrics, labelOverrides, loading: customLoading, addMetric, renameMetric } = useCustomMetrics(sectionKey)

  const handleSave = useCallback(
    async (metricKey: string, value: string, notes: string) => {
      await saveMetric(metricKey, value, notes, user?.email ?? 'unknown')
    },
    [saveMetric, user]
  )

  const handleAddMetric = useCallback(
    async (label: string, unit: string) => {
      await addMetric(label, unit, user?.email ?? 'unknown')
    },
    [addMetric, user]
  )

  const handleRenameMetric = useCallback(
    async (metricKey: string, newLabel: string) => {
      await renameMetric(metricKey, newLabel)
    },
    [renameMetric]
  )

  if (loading || customLoading) return <LoadingScreen />

  const overriddenMetrics = section.metrics.map(m => {
    const override = labelOverrides[m.key]
    return override ? { ...m, label: override } : m
  })

  const allMetrics = [...overriddenMetrics, ...customMetrics]
  const numericMetrics = allMetrics.filter(m => m.unit !== 'text').slice(0, 4)
  const hasData = Object.keys(data).length > 0 && Object.values(data).some(d => d.value && d.value !== '')
  const filledCount = Object.values(data).filter(d => d.value && d.value !== '').length
  const totalCount = allMetrics.length

  return (
    <div className="space-y-6">
      {/* Read-only banner for month/custom mode */}
      <ReadOnlyBanner />

      {/* Empty state — only in week mode */}
      {!hasData && !isReadOnly && (
        <div className="rounded-[20px] border border-[#C96A5A]/30 bg-[rgba(201,106,90,.06)] p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[rgba(201,106,90,.12)] mt-0.5">
              <span className="text-[16px]">📝</span>
            </div>
            <div>
              <p className="text-[14px] font-[600] text-[#2A1F1A]">Time to update your numbers</p>
              <p className="text-[13px] text-[#7A6A60] mt-0.5">
                Enter this week's {section.label.toLowerCase()} metrics below. Saves automatically and syncs in real-time.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* No data in read-only mode */}
      {!hasData && isReadOnly && (
        <div className="rounded-[20px] border border-[#D4CBC0] bg-[#F9F5F1] p-8 text-center">
          <p className="text-[14px] text-[#7A6A60]">No data found for this period.</p>
        </div>
      )}

      {/* Progress */}
      {hasData && !isReadOnly && filledCount < totalCount && (
        <div className="flex items-center gap-3 px-1">
          <div className="flex-1 h-1.5 rounded-full bg-[#F2EDE8] overflow-hidden">
            <div className="h-full rounded-full bg-[#6B4C4C] transition-all duration-500" style={{ width: `${Math.round((filledCount / totalCount) * 100)}%` }} />
          </div>
          <span className="text-[12px] text-[#7A6A60] shrink-0">{filledCount}/{totalCount} filled</span>
        </div>
      )}

      {/* Table first when empty (week mode only) */}
      {!hasData && !isReadOnly && (
        <InlineMetricTable sectionKey={sectionKey} metrics={overriddenMetrics} weekStart={weekStart} customMetrics={customMetrics} onAddMetric={handleAddMetric} onRenameMetric={handleRenameMetric} />
      )}

      {/* Stat cards */}
      {hasData && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {numericMetrics.map(m => (
            <MetricCard key={m.key} metric={m} value={data[m.key]?.value ?? ''} prevValue={prevData[m.key]?.value ?? ''} />
          ))}
        </div>
      )}

      {/* Charts */}
      {hasData && (
        <SectionCharts sectionKey={sectionKey} weekStart={weekStart} data={data} customMetrics={customMetrics} />
      )}

      {/* Edit table — only in week mode */}
      {hasData && !isReadOnly && (
        <InlineMetricTable sectionKey={sectionKey} metrics={overriddenMetrics} weekStart={weekStart} customMetrics={customMetrics} onAddMetric={handleAddMetric} onRenameMetric={handleRenameMetric} />
      )}
    </div>
  )
}

export function MetricsPage({ sectionKey }: Props) {
  const section = SECTION_MAP[sectionKey]
  if (!section) return <div className="p-6 text-[13px] text-[#7A6A60]">Section not found: {sectionKey}</div>

  return (
    <SectionShell title={section.label} description={section.description}>
      <MetricsPageInner sectionKey={sectionKey} />
    </SectionShell>
  )
}
