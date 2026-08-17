'use client'

import { format, startOfWeek, addWeeks, subWeeks, isAfter } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type Props = {
  weekStart: string
  onChange: (weekStart: string) => void
}

export function WeekSelector({ weekStart, onChange }: Props) {
  const date = new Date(weekStart + 'T00:00:00')
  const thisWeek = startOfWeek(new Date(), { weekStartsOn: 1 })

  const prev = () => onChange(format(subWeeks(date, 1), 'yyyy-MM-dd'))
  const next = () => {
    const n = addWeeks(date, 1)
    if (!isAfter(n, thisWeek)) onChange(format(n, 'yyyy-MM-dd'))
  }
  const isCurrentWeek = format(date, 'yyyy-MM-dd') === format(thisWeek, 'yyyy-MM-dd')

  return (
    <div className="flex items-center gap-0.5 rounded-[9999px] border border-[#D4CBC0] bg-white px-1 py-1 shadow-[0_2px_8px_rgba(40,20,10,.06)]">
      <button
        onClick={prev}
        className="flex h-6 w-6 items-center justify-center rounded-full text-[#7A6A60] hover:bg-[#F2EDE8] hover:text-[#6B4C4C] transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
      </button>

      <button
        onClick={() => onChange(format(thisWeek, 'yyyy-MM-dd'))}
        className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full hover:bg-[#F2EDE8] transition-colors"
      >
        <span className="font-['DM_Sans'] text-[12px] font-[500] text-[#2A1F1A]">
          {format(date, 'MMM d')} – {format(addWeeks(date, 1), 'MMM d, yyyy')}
        </span>
        {isCurrentWeek && (
          <span className="badge-lyzr" style={{ background: 'rgba(107,76,76,.10)', color: '#6B4C4C' }}>
            Now
          </span>
        )}
      </button>

      <button
        onClick={next}
        disabled={isCurrentWeek}
        className="flex h-6 w-6 items-center justify-center rounded-full text-[#7A6A60] hover:bg-[#F2EDE8] hover:text-[#6B4C4C] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  )
}
