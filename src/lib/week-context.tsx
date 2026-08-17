'use client'

import { createContext, useContext, useState, useMemo, type ReactNode } from 'react'
import { format, startOfWeek, subWeeks, startOfMonth, endOfMonth, addWeeks, addDays, isAfter, isBefore, parseISO } from 'date-fns'

export type RangeMode = 'week' | 'month' | 'custom'

export type DateRange = {
  mode: RangeMode
  /** The anchor week (Monday) — used for editing and as the "current" week in week mode */
  weekStart: string
  /** Inclusive start of the range (yyyy-MM-dd) */
  startDate: string
  /** Inclusive end of the range (yyyy-MM-dd) */
  endDate: string
  /** Human-readable label */
  label: string
}

function defaultWeekKey(): string {
  const now = new Date()
  const day = now.getDay() // 0=Sun, 1=Mon, ...
  const monday = startOfWeek(now, { weekStartsOn: 1 })
  // On Monday, show the previous (completed) week since the new week just started
  if (day === 1) return format(subWeeks(monday, 1), 'yyyy-MM-dd')
  return format(monday, 'yyyy-MM-dd')
}

function makeWeekRange(weekStart: string): DateRange {
  const d = parseISO(weekStart)
  const end = addWeeks(d, 1) // exclusive end for data queries (next Monday)
  const sunday = new Date(d)
  sunday.setDate(d.getDate() + 6) // inclusive end for display (Sunday)
  return {
    mode: 'week',
    weekStart,
    startDate: weekStart,
    endDate: format(end, 'yyyy-MM-dd'),
    label: `${format(d, 'MMM d')} – ${format(sunday, 'MMM d, yyyy')}`,
  }
}

function makeMonthRange(year: number, month: number): DateRange {
  const monthStart = new Date(year, month, 1)
  const monthEnd = endOfMonth(monthStart)
  // Anchor week = first Monday of the month
  const firstMonday = startOfWeek(monthStart, { weekStartsOn: 1 })
  const anchor = isBefore(firstMonday, monthStart) ? format(addWeeks(firstMonday, 1), 'yyyy-MM-dd') : format(firstMonday, 'yyyy-MM-dd')
  return {
    mode: 'month',
    weekStart: anchor,
    startDate: format(monthStart, 'yyyy-MM-dd'),
    endDate: format(monthEnd, 'yyyy-MM-dd'),
    label: format(monthStart, 'MMMM yyyy'),
  }
}

function makeCustomRange(startDate: string, endDate: string): DateRange {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  // Anchor = Monday on or before startDate
  const anchor = startOfWeek(start, { weekStartsOn: 1 })
  return {
    mode: 'custom',
    weekStart: format(anchor, 'yyyy-MM-dd'),
    startDate,
    endDate,
    label: `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`,
  }
}

type WeekCtx = {
  range: DateRange
  /** Convenience alias — the anchor week for editing */
  weekStart: string
  /** The start date to use for API queries (always range.startDate) */
  queryStart: string
  /** The exclusive end date to use for API queries (endDate + 1 day for inclusive ranges) */
  queryEnd: string
  isWeekMode: boolean
  setWeekRange: (weekStart: string) => void
  setMonthRange: (year: number, month: number) => void
  setCustomRange: (startDate: string, endDate: string) => void
}

const Ctx = createContext<WeekCtx | null>(null)

export function WeekProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<DateRange>(() => makeWeekRange(defaultWeekKey()))

  const value = useMemo<WeekCtx>(() => {
    // For week mode, endDate is already exclusive (next Monday)
    // For month/custom mode, endDate is inclusive — add 1 day for API queries
    const queryEnd = range.mode === 'week'
      ? range.endDate
      : format(addDays(parseISO(range.endDate), 1), 'yyyy-MM-dd')

    return {
      range,
      weekStart: range.weekStart,
      queryStart: range.startDate,
      queryEnd,
      isWeekMode: range.mode === 'week',
      setWeekRange: (ws) => setRange(makeWeekRange(ws)),
      setMonthRange: (y, m) => setRange(makeMonthRange(y, m)),
      setCustomRange: (s, e) => setRange(makeCustomRange(s, e)),
    }
  }, [range])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWeek(): WeekCtx {
  const v = useContext(Ctx)
  if (!v) throw new Error('useWeek must be used within WeekProvider')
  return v
}

// Export helpers for use in other files
export { makeWeekRange, makeMonthRange, makeCustomRange }
