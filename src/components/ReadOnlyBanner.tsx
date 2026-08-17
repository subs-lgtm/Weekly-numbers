'use client'

import { Eye } from 'lucide-react'
import { useWeek } from '@/lib/week-context'

export function ReadOnlyBanner() {
  const { range, isWeekMode, setWeekRange } = useWeek()

  if (isWeekMode) return null

  return (
    <div className="rounded-[16px] border border-[#2563EB]/20 bg-[rgba(37,99,235,.05)] px-4 py-3 flex items-center gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(37,99,235,.10)] text-[#2563EB]">
        <Eye className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-[600] text-[#2A1F1A]">
          Viewing aggregated data — {range.label}
        </p>
        <p className="text-[12px] text-[#7A6A60]">
          Numbers are summed across all weeks in this {range.mode === 'month' ? 'month' : 'range'}. Editing is disabled.
        </p>
      </div>
      <button
        onClick={() => setWeekRange(range.weekStart)}
        className="shrink-0 text-[11px] font-[500] text-[#2563EB] hover:underline"
      >
        Switch to week view
      </button>
    </div>
  )
}
