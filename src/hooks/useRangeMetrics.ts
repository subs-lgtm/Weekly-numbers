'use client'

/**
 * useRangeMetrics — drop-in replacement for useWeeklyMetrics that respects the global date range.
 *
 * - In week mode: delegates to useWeeklyMetrics (single week, editable)
 * - In month/custom mode: aggregates across all overlapping weeks (read-only)
 *
 * Returns the same shape as useWeeklyMetrics plus `isReadOnly` flag.
 */

import { useWeek } from '@/lib/week-context'
import { useWeeklyMetrics, usePrevWeekMetrics } from '@/hooks/useWeeklyMetrics'
import { useDateRangeMetrics } from '@/hooks/useDateRangeMetrics'
import { format, subWeeks, parseISO, startOfMonth, endOfMonth } from 'date-fns'
import type { WeekMetrics } from '@/hooks/useWeeklyMetrics'

type RangeMetricsResult = {
  data: WeekMetrics
  loading: boolean
  isReadOnly: boolean
  /** Only available in week mode — no-op in read-only mode */
  saveMetric: (key: string, value: string, notes: string, userEmail: string) => Promise<void>
}

export function useRangeMetrics(sectionKey: string): RangeMetricsResult {
  const { range, isWeekMode } = useWeek()

  // Always call both hooks (React rules) — use the right one based on mode
  const weekData = useWeeklyMetrics(sectionKey, range.weekStart)
  const rangeData = useDateRangeMetrics(sectionKey, range)

  if (isWeekMode) {
    return {
      data: weekData.data,
      loading: weekData.loading,
      isReadOnly: false,
      saveMetric: weekData.saveMetric,
    }
  }

  return {
    data: rangeData.data,
    loading: rangeData.loading,
    isReadOnly: true,
    saveMetric: async () => {
      // No-op in read-only mode
      console.warn('saveMetric called in read-only mode — ignored')
    },
  }
}

/**
 * usePrevRangeMetrics — comparison data for the previous period.
 * - Week mode: previous week
 * - Month mode: previous month
 * - Custom mode: same duration shifted back
 */
export function usePrevRangeMetrics(sectionKey: string): WeekMetrics {
  const { range, isWeekMode } = useWeek()

  // Compute previous range
  const prevRange = (() => {
    if (range.mode === 'week') {
      const prevWeek = format(subWeeks(parseISO(range.weekStart), 1), 'yyyy-MM-dd')
      return { startDate: prevWeek, endDate: format(subWeeks(parseISO(range.endDate), 1), 'yyyy-MM-dd') }
    }
    if (range.mode === 'month') {
      const thisMonthStart = parseISO(range.startDate)
      const prevMonthStart = new Date(thisMonthStart.getFullYear(), thisMonthStart.getMonth() - 1, 1)
      return {
        startDate: format(prevMonthStart, 'yyyy-MM-dd'),
        endDate: format(endOfMonth(prevMonthStart), 'yyyy-MM-dd'),
      }
    }
    // Custom: shift back by same duration
    const start = parseISO(range.startDate)
    const end = parseISO(range.endDate)
    const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
    const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000)
    const prevStart = new Date(prevEnd.getTime() - duration * 24 * 60 * 60 * 1000)
    return {
      startDate: format(prevStart, 'yyyy-MM-dd'),
      endDate: format(prevEnd, 'yyyy-MM-dd'),
    }
  })()

  // Always call both hooks
  const prevWeekData = usePrevWeekMetrics(sectionKey, range.weekStart)
  const prevRangeObj = { ...range, startDate: prevRange.startDate, endDate: prevRange.endDate }
  const prevRangeData = useDateRangeMetrics(sectionKey, prevRangeObj)

  return isWeekMode ? prevWeekData : prevRangeData.data
}
