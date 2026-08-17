'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { format, startOfWeek, addWeeks, subWeeks, isAfter, parseISO, startOfMonth, endOfMonth, isBefore } from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar, X, Check } from 'lucide-react'
import { useWeek } from '@/lib/week-context'
import { cn } from '@/lib/utils'

type Tab = 'week' | 'month' | 'custom'

export function GlobalWeekSelector() {
  const { range, setWeekRange, setMonthRange, setCustomRange } = useWeek()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>(range.mode === 'custom' ? 'custom' : range.mode)
  const [pickerMonth, setPickerMonth] = useState(() => {
    const d = parseISO(range.startDate)
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  // Custom range selection state
  const [customStart, setCustomStart] = useState<string | null>(null)
  const [customEnd, setCustomEnd] = useState<string | null>(null)
  const [hoverDate, setHoverDate] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const thisWeek = startOfWeek(new Date(), { weekStartsOn: 1 })
  const today = format(new Date(), 'yyyy-MM-dd')

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Sync tab when range mode changes externally
  useEffect(() => {
    if (range.mode !== 'custom') setTab(range.mode)
  }, [range.mode])

  const openPicker = () => {
    setPickerMonth(new Date(parseISO(range.startDate).getFullYear(), parseISO(range.startDate).getMonth(), 1))
    setCustomStart(null)
    setCustomEnd(null)
    setOpen(v => !v)
  }

  // Week mode: prev/next
  const prevWeek = () => {
    const d = parseISO(range.weekStart)
    setWeekRange(format(subWeeks(d, 1), 'yyyy-MM-dd'))
  }
  const nextWeek = () => {
    const d = parseISO(range.weekStart)
    const n = addWeeks(d, 1)
    if (!isAfter(n, thisWeek)) setWeekRange(format(n, 'yyyy-MM-dd'))
  }
  const isCurrentWeek = range.mode === 'week' && range.weekStart === format(thisWeek, 'yyyy-MM-dd')

  // Calendar grid
  const calendarWeeks = buildCalendarWeeks(pickerMonth)

  // Week tab: click a week row
  const handleWeekClick = (weekMonday: Date) => {
    if (isAfter(weekMonday, thisWeek)) return
    setWeekRange(format(weekMonday, 'yyyy-MM-dd'))
    setOpen(false)
  }

  // Month tab: click a month header button
  const handleMonthClick = (year: number, month: number) => {
    const monthEnd = endOfMonth(new Date(year, month, 1))
    if (isAfter(new Date(year, month, 1), new Date())) return
    setMonthRange(year, month)
    setOpen(false)
  }

  // Custom tab: click to select start then end
  const handleCustomDayClick = (dateStr: string) => {
    if (dateStr > today) return
    if (!customStart || (customStart && customEnd)) {
      // Start fresh
      setCustomStart(dateStr)
      setCustomEnd(null)
    } else {
      // Second click — set end (ensure start <= end)
      if (dateStr < customStart) {
        setCustomEnd(customStart)
        setCustomStart(dateStr)
      } else {
        setCustomEnd(dateStr)
      }
    }
  }

  const applyCustomRange = () => {
    if (customStart && customEnd) {
      setCustomRange(customStart, customEnd)
      setOpen(false)
    }
  }

  const isInCustomRange = (dateStr: string) => {
    if (!customStart) return false
    const end = customEnd || hoverDate
    if (!end) return dateStr === customStart
    const lo = customStart < end ? customStart : end
    const hi = customStart < end ? end : customStart
    return dateStr >= lo && dateStr <= hi
  }

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-0.5 rounded-[9999px] border border-[#D4CBC0] bg-white px-1 py-1 shadow-[0_2px_8px_rgba(40,20,10,.06)]">
        {/* Prev — only in week mode */}
        {range.mode === 'week' && (
          <button
            onClick={prevWeek}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[#7A6A60] hover:bg-[#F2EDE8] hover:text-[#6B4C4C] transition-colors"
            title="Previous week"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}

        {/* Label */}
        <button
          onClick={() => { if (range.mode === 'week') setWeekRange(format(thisWeek, 'yyyy-MM-dd')) }}
          className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full hover:bg-[#F2EDE8] transition-colors"
        >
          <span className="font-['DM_Sans'] text-[12px] font-[500] text-[#2A1F1A]">
            {range.label}
          </span>
          {isCurrentWeek && (
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-[600]" style={{ background: 'rgba(107,76,76,.10)', color: '#6B4C4C' }}>
              Now
            </span>
          )}
          {range.mode !== 'week' && (
            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-[600] capitalize" style={{ background: 'rgba(37,99,235,.10)', color: '#2563EB' }}>
              {range.mode}
            </span>
          )}
        </button>

        {/* Next — only in week mode */}
        {range.mode === 'week' && (
          <button
            onClick={nextWeek}
            disabled={isCurrentWeek}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[#7A6A60] hover:bg-[#F2EDE8] hover:text-[#6B4C4C] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Next week"
          >
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}

        {/* Calendar toggle */}
        <button
          onClick={openPicker}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full transition-colors ml-0.5',
            open ? 'bg-[#6B4C4C] text-[#F9F5F1]' : 'text-[#7A6A60] hover:bg-[#F2EDE8] hover:text-[#6B4C4C]'
          )}
          title="Date picker"
        >
          <Calendar className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 rounded-[20px] border border-[#D4CBC0] bg-white shadow-[0_8px_40px_rgba(40,20,10,.14)] w-[320px] overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-[#D4CBC0]">
            {(['week', 'month', 'custom'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex-1 py-2.5 text-[12px] font-[500] capitalize transition-colors',
                  tab === t ? 'bg-[#6B4C4C] text-[#F9F5F1]' : 'text-[#7A6A60] hover:bg-[#F9F5F1]'
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="p-4">
            {/* Month nav */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setPickerMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                className="flex h-6 w-6 items-center justify-center rounded-full text-[#7A6A60] hover:bg-[#F2EDE8] transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              {tab === 'month' ? (
                <button
                  onClick={() => handleMonthClick(pickerMonth.getFullYear(), pickerMonth.getMonth())}
                  className={cn(
                    'text-[13px] font-[600] px-3 py-1 rounded-full transition-colors',
                    range.mode === 'month' && range.label === format(pickerMonth, 'MMMM yyyy')
                      ? 'bg-[#6B4C4C] text-[#F9F5F1]'
                      : 'text-[#2A1F1A] hover:bg-[#F2EDE8]'
                  )}
                >
                  {format(pickerMonth, 'MMMM yyyy')}
                </button>
              ) : (
                <span className="text-[13px] font-[600] text-[#2A1F1A]">
                  {format(pickerMonth, 'MMMM yyyy')}
                </span>
              )}
              <button
                onClick={() => setPickerMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                className="flex h-6 w-6 items-center justify-center rounded-full text-[#7A6A60] hover:bg-[#F2EDE8] transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
                <div key={d} className="text-center text-[10px] font-[600] text-[#7A6A60] py-1">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="space-y-0.5">
              {calendarWeeks.map((week) => {
                const wKey = format(week[0], 'yyyy-MM-dd')
                const isFutureWeek = isAfter(week[0], thisWeek)
                const isSelectedWeek = tab === 'week' && range.mode === 'week' && wKey === range.weekStart

                return (
                  <div
                    key={wKey}
                    className={cn(
                      'grid grid-cols-7 rounded-[8px] transition-colors',
                      tab === 'week' && !isFutureWeek && 'cursor-pointer hover:bg-[#F2EDE8]',
                      tab === 'week' && isSelectedWeek && 'bg-[#6B4C4C] hover:bg-[#6B4C4C]',
                      isFutureWeek && 'opacity-30 cursor-not-allowed'
                    )}
                    onClick={() => tab === 'week' && !isFutureWeek && handleWeekClick(week[0])}
                  >
                    {week.map((day) => {
                      const dateStr = format(day, 'yyyy-MM-dd')
                      const inMonth = day.getMonth() === pickerMonth.getMonth()
                      const isFuture = dateStr > today
                      const inRange = tab === 'custom' && isInCustomRange(dateStr)
                      const isRangeStart = tab === 'custom' && dateStr === customStart
                      const isRangeEnd = tab === 'custom' && dateStr === (customEnd || hoverDate)

                      return (
                        <div
                          key={dateStr}
                          className={cn(
                            'text-center text-[12px] py-1.5 transition-colors',
                            tab === 'week' && isSelectedWeek ? 'text-[#F9F5F1] font-[500]' : inMonth ? 'text-[#2A1F1A]' : 'text-[#D4CBC0]',
                            tab === 'custom' && !isFuture && 'cursor-pointer',
                            tab === 'custom' && inRange && 'bg-[rgba(107,76,76,.12)]',
                            tab === 'custom' && (isRangeStart || isRangeEnd) && 'bg-[#6B4C4C] text-[#F9F5F1] rounded-full font-[600]',
                            tab === 'custom' && isFuture && 'opacity-30 cursor-not-allowed',
                          )}
                          onClick={tab === 'custom' && !isFuture ? (e) => { e.stopPropagation(); handleCustomDayClick(dateStr) } : undefined}
                          onMouseEnter={tab === 'custom' && customStart && !customEnd ? () => setHoverDate(dateStr) : undefined}
                          onMouseLeave={tab === 'custom' ? () => setHoverDate(null) : undefined}
                        >
                          {format(day, 'd')}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* Custom range apply button */}
            {tab === 'custom' && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 text-[11px] text-[#7A6A60]">
                  <span className="flex-1 rounded-[8px] border border-[#D4CBC0] px-2 py-1 text-center">
                    {customStart ? format(parseISO(customStart), 'MMM d, yyyy') : 'Start date'}
                  </span>
                  <span>→</span>
                  <span className="flex-1 rounded-[8px] border border-[#D4CBC0] px-2 py-1 text-center">
                    {customEnd ? format(parseISO(customEnd), 'MMM d, yyyy') : 'End date'}
                  </span>
                </div>
                <button
                  onClick={applyCustomRange}
                  disabled={!customStart || !customEnd}
                  className="w-full flex items-center justify-center gap-1.5 bg-[#6B4C4C] text-[#F9F5F1] rounded-[9999px] py-1.5 text-[12px] font-[500] hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  <Check className="h-3.5 w-3.5" />
                  Apply Range
                </button>
              </div>
            )}

            {/* Jump to current week */}
            {!isCurrentWeek && (
              <button
                onClick={() => { setWeekRange(format(thisWeek, 'yyyy-MM-dd')); setOpen(false) }}
                className="mt-3 w-full text-center text-[11px] font-[500] text-[#6B4C4C] hover:underline"
              >
                Jump to current week
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function buildCalendarWeeks(monthStart: Date): Date[][] {
  const firstDay = new Date(monthStart)
  const dayOfWeek = firstDay.getDay()
  const offset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const startMonday = new Date(firstDay)
  startMonday.setDate(firstDay.getDate() + offset)

  const weeks: Date[][] = []
  let cursor = new Date(startMonday)
  for (let w = 0; w < 6; w++) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    weeks.push(week)
  }
  return weeks
}
