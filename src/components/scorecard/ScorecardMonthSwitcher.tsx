"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

/**
 * Same pill-shaped prev/next + "Now" badge pattern as GlobalWeekSelector.tsx, rebuilt with the
 * semantic CSS-var tokens (bg-card, border-border, text-foreground, etc.) instead of that
 * component's hardcoded hex — so this one actually responds to the .dark theme class already
 * defined in globals.css. GlobalWeekSelector itself is not dark-mode aware today; not touching it
 * here since that's out of scope for this feature.
 */
export function ScorecardMonthSwitcher({
  year, month, onChange,
}: {
  year: number
  month: number // 1-12
  onChange: (year: number, month: number) => void
}) {
  const now = new Date()
  const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1

  const prev = () => {
    if (month === 1) onChange(year - 1, 12)
    else onChange(year, month - 1)
  }
  const next = () => {
    if (month === 12) onChange(year + 1, 1)
    else onChange(year, month + 1)
  }
  const jumpToNow = () => onChange(now.getFullYear(), now.getMonth() + 1)

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-border bg-card px-1 py-1 shadow-[0_2px_8px_rgba(40,20,10,.06)]">
      <button
        onClick={prev}
        className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
        title="Previous month"
        aria-label="Previous month"
      >
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
      </button>

      <button
        onClick={jumpToNow}
        className="flex items-center gap-1.5 rounded-full px-2.5 py-0.5 transition-colors hover:bg-muted"
        aria-label={isCurrent ? "Current month" : "Jump to current month"}
      >
        <span className="font-['DM_Sans'] text-[12px] font-[500] text-foreground">
          {MONTHS[month - 1]} {year}
        </span>
        {isCurrent && (
          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-[600]" style={{ background: "var(--ring)", color: "var(--primary)" }}>
            Now
          </span>
        )}
      </button>

      <button
        onClick={next}
        className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
        title="Next month"
        aria-label="Next month"
      >
        <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  )
}
