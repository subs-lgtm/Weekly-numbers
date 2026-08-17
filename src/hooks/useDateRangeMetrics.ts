'use client'

import { useMemo } from 'react'
import { format, addWeeks, parseISO, isBefore, isAfter, startOfWeek } from 'date-fns'
import { useWeeklyMetrics } from '@/hooks/useWeeklyMetrics'
import type { WeekMetrics } from '@/hooks/useWeeklyMetrics'
import type { DateRange } from '@/lib/week-context'

/**
 * Get all Monday week-start keys that overlap with the given date range.
 * A week overlaps if its Monday is before the range end AND its Sunday is after the range start.
 */
export function getWeekKeysForRange(startDate: string, endDate: string): string[] {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  const keys: string[] = []

  // Start from the Monday on or before startDate
  let cursor = startOfWeek(start, { weekStartsOn: 1 })

  // Walk forward week by week until cursor is past endDate
  while (!isAfter(cursor, end)) {
    keys.push(format(cursor, 'yyyy-MM-dd'))
    cursor = addWeeks(cursor, 1)
  }

  return keys
}

/**
 * Aggregate metrics across multiple weeks for a date range.
 * Numeric values are summed. Text values take the latest non-empty value.
 * Returns a WeekMetrics-shaped object with aggregated values.
 */
export function aggregateMetrics(weekDataList: WeekMetrics[]): WeekMetrics {
  const result: WeekMetrics = {}

  for (const weekData of weekDataList) {
    for (const [key, entry] of Object.entries(weekData)) {
      if (!entry.value && entry.value !== '0') continue

      const n = parseFloat(entry.value)
      if (!isNaN(n)) {
        // Numeric: sum
        const existing = parseFloat(result[key]?.value ?? '0') || 0
        result[key] = {
          value: String(existing + n),
          notes: entry.notes || result[key]?.notes || '',
          updatedBy: entry.updatedBy || result[key]?.updatedBy || '',
          updatedAt: entry.updatedAt,
        }
      } else {
        // Text: take latest non-empty
        if (entry.value) {
          result[key] = entry
        }
      }
    }
  }

  return result
}

// Fixed-size hook array — supports up to 16 weeks (4 months)
// React hooks must be called unconditionally, so we always call all 16
function useWeeks16(sectionKey: string, keys: string[]) {
  const padded = useMemo(() => {
    const p = [...keys]
    while (p.length < 16) p.push(p[p.length - 1] || keys[0] || '2026-01-01')
    return p.slice(0, 16)
  }, [keys])

  const w0 = useWeeklyMetrics(sectionKey, padded[0])
  const w1 = useWeeklyMetrics(sectionKey, padded[1])
  const w2 = useWeeklyMetrics(sectionKey, padded[2])
  const w3 = useWeeklyMetrics(sectionKey, padded[3])
  const w4 = useWeeklyMetrics(sectionKey, padded[4])
  const w5 = useWeeklyMetrics(sectionKey, padded[5])
  const w6 = useWeeklyMetrics(sectionKey, padded[6])
  const w7 = useWeeklyMetrics(sectionKey, padded[7])
  const w8 = useWeeklyMetrics(sectionKey, padded[8])
  const w9 = useWeeklyMetrics(sectionKey, padded[9])
  const w10 = useWeeklyMetrics(sectionKey, padded[10])
  const w11 = useWeeklyMetrics(sectionKey, padded[11])
  const w12 = useWeeklyMetrics(sectionKey, padded[12])
  const w13 = useWeeklyMetrics(sectionKey, padded[13])
  const w14 = useWeeklyMetrics(sectionKey, padded[14])
  const w15 = useWeeklyMetrics(sectionKey, padded[15])

  const allWeeks = [w0, w1, w2, w3, w4, w5, w6, w7, w8, w9, w10, w11, w12, w13, w14, w15]
  const loading = allWeeks.some(w => w.loading)

  const aggregated = useMemo(() => {
    // Only aggregate the actual keys (not the padded extras)
    const relevantData = keys.map((_, i) => allWeeks[i]?.data ?? {})
    return aggregateMetrics(relevantData)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys, w0.data, w1.data, w2.data, w3.data, w4.data, w5.data, w6.data, w7.data,
      w8.data, w9.data, w10.data, w11.data, w12.data, w13.data, w14.data, w15.data])

  return { data: aggregated, loading, weekDataList: keys.map((_, i) => allWeeks[i]?.data ?? {}) }
}

/**
 * Main hook: given a section and a date range, returns aggregated metrics.
 * In week mode, this is equivalent to useWeeklyMetrics for that single week.
 * In month/custom mode, it aggregates across all overlapping weeks.
 */
export function useDateRangeMetrics(sectionKey: string, range: DateRange) {
  const weekKeys = useMemo(
    () => getWeekKeysForRange(range.startDate, range.endDate),
    [range.startDate, range.endDate]
  )

  return useWeeks16(sectionKey, weekKeys)
}
