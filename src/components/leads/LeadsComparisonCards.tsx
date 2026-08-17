'use client'

import { useState, useEffect, useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, ArrowRightLeft, Loader2 } from 'lucide-react'
import { format, subWeeks, subMonths, startOfMonth, endOfMonth, addDays, addWeeks } from 'date-fns'
import { cn } from '@/lib/utils'

type Props = {
  weekStart: string
}

function ComparisonCard({
  title, currentLabel, prevLabel, currentValue, prevValue, loading, unit,
}: {
  title: string; currentLabel: string; prevLabel: string;
  currentValue: number; prevValue: number; loading?: boolean; unit?: string;
}) {
  const diff = currentValue - prevValue
  const pct = prevValue > 0 ? Math.round((diff / prevValue) * 100) : currentValue > 0 ? 100 : 0
  const dir = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'

  return (
    <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
      <div className="flex items-center gap-2 mb-4">
        <div className="inline-flex items-center justify-center rounded-full p-2 bg-[rgba(107,76,76,.08)] text-[#6B4C4C]">
          <ArrowRightLeft className="h-4 w-4" />
        </div>
        <p className="eyebrow">{title}</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4 text-[#7A6A60]">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : (
        <div className="flex items-end justify-between gap-4">
          <div className="text-center flex-1">
            <p className="text-[11px] text-[#7A6A60] mb-1">{prevLabel}</p>
            <p className="font-['Playfair_Display'] font-[500] text-[1.5rem] leading-[1.2] text-[#7A6A60]">
              {prevValue > 0 ? prevValue.toLocaleString() : '—'}
            </p>
          </div>
          <div className="flex flex-col items-center gap-1 pb-1">
            <div className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold',
              dir === 'up' && 'delta-up', dir === 'down' && 'delta-down', dir === 'flat' && 'delta-flat',
            )}>
              {dir === 'up' && <TrendingUp className="h-3.5 w-3.5" />}
              {dir === 'down' && <TrendingDown className="h-3.5 w-3.5" />}
              {dir === 'flat' && <Minus className="h-3.5 w-3.5" />}
              {dir === 'up' ? '+' : ''}{pct}%
            </div>
            <span className="text-[10px] text-[#7A6A60]">
              {diff > 0 ? '+' : ''}{diff.toLocaleString()} {unit || 'leads'}
            </span>
          </div>
          <div className="text-center flex-1">
            <p className="text-[11px] text-[#7A6A60] mb-1">{currentLabel}</p>
            <p className="font-['Playfair_Display'] font-[500] text-[1.5rem] leading-[1.2] text-[#2A1F1A]">
              {currentValue > 0 ? currentValue.toLocaleString() : '—'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export function LeadsComparisonCards({ weekStart }: Props) {
  const [wowCurrent, setWowCurrent] = useState(0)
  const [wowPrev, setWowPrev] = useState(0)
  const [momCurrent, setMomCurrent] = useState(0)
  const [momPrev, setMomPrev] = useState(0)
  const [loading, setLoading] = useState(true)

  const prevWeekStart = useMemo(() => format(subWeeks(new Date(weekStart + 'T00:00:00'), 1), 'yyyy-MM-dd'), [weekStart])
  const weekEnd = useMemo(() => format(addWeeks(new Date(weekStart + 'T00:00:00'), 1), 'yyyy-MM-dd'), [weekStart])
  const prevWeekEnd = useMemo(() => weekStart, [weekStart])

  // MoM: compare the month the selected week falls in vs the previous month
  // e.g. if weekStart is in May 2026, compare Apr 2026 vs May 2026
  const selectedDate = useMemo(() => new Date(weekStart + 'T00:00:00'), [weekStart])
  const currentMonth = useMemo(() => startOfMonth(selectedDate), [selectedDate])
  const prevMonth = useMemo(() => subMonths(currentMonth, 1), [currentMonth])

  const currentMonthStart = useMemo(() => format(currentMonth, 'yyyy-MM-dd'), [currentMonth])
  const currentMonthEnd = useMemo(() => format(addDays(endOfMonth(currentMonth), 1), 'yyyy-MM-dd'), [currentMonth])
  const prevMonthStart = useMemo(() => format(prevMonth, 'yyyy-MM-dd'), [prevMonth])
  const prevMonthEnd = useMemo(() => format(addDays(endOfMonth(prevMonth), 1), 'yyyy-MM-dd'), [prevMonth])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function fetchAll() {
      const [wowCurr, wowPr, momCurr, momPr] = await Promise.all([
        fetch(`/api/hubspot/mqls?start=${weekStart}&end=${weekEnd}&mode=all`).then(r => r.json()).catch(() => ({ total: 0 })),
        fetch(`/api/hubspot/mqls?start=${prevWeekStart}&end=${prevWeekEnd}&mode=all`).then(r => r.json()).catch(() => ({ total: 0 })),
        fetch(`/api/hubspot/mqls?start=${currentMonthStart}&end=${currentMonthEnd}&mode=all`).then(r => r.json()).catch(() => ({ total: 0 })),
        fetch(`/api/hubspot/mqls?start=${prevMonthStart}&end=${prevMonthEnd}&mode=all`).then(r => r.json()).catch(() => ({ total: 0 })),
      ])
      if (!cancelled) {
        // Exclude Book a Demo forms and Agent Studio — keeping only top-of-funnel informational leads
        const subtractBookDemoAndStudio = (d: any) => {
          const bd = (d?.by_form_type?.['Book a Demo'] || 0) + 
                     (d?.by_form_type?.['Email Form'] || 0) + 
                     (d?.by_form_type?.['Pre-Built Agents'] || 0) +
                     (d?.by_form_type?.['Agent Studio'] || 0)
          return (d?.total || 0) - bd
        }
        setWowCurrent(subtractBookDemoAndStudio(wowCurr))
        setWowPrev(subtractBookDemoAndStudio(wowPr))
        setMomCurrent(subtractBookDemoAndStudio(momCurr))
        setMomPrev(subtractBookDemoAndStudio(momPr))
        setLoading(false)
      }
    }

    fetchAll()
    return () => { cancelled = true }
  }, [weekStart, weekEnd, prevWeekStart, prevWeekEnd, currentMonthStart, currentMonthEnd, prevMonthStart, prevMonthEnd])

  const currentWeekLabel = `Week of ${format(new Date(weekStart + 'T00:00:00'), 'MMM d')}`
  const prevWeekLabel = `Week of ${format(new Date(prevWeekStart + 'T00:00:00'), 'MMM d')}`
  const currentMonthLabel = format(currentMonth, 'MMM yyyy')
  const prevMonthLabel = format(prevMonth, 'MMM yyyy')

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ComparisonCard
        title="WoW Comparison — Leads"
        currentLabel={currentWeekLabel}
        prevLabel={prevWeekLabel}
        currentValue={wowCurrent}
        prevValue={wowPrev}
        loading={loading}
        unit="leads"
      />
      <ComparisonCard
        title="MoM Comparison — Leads"
        currentLabel={currentMonthLabel}
        prevLabel={prevMonthLabel}
        currentValue={momCurrent}
        prevValue={momPrev}
        loading={loading}
        unit="leads"
      />
    </div>
  )
}
