/**
 * Channel Scorecard week math — Monday-Sunday weeks, 4 per month, per explicit spec:
 *   Week 1 starts on the 1st. Normally it ends on the nearest Sunday on/after the 1st (so it can
 *   be a short 1-6 day week). But if the 1st itself falls on Fri/Sat/Sun, that near Sunday would
 *   make Week 1 too short (0-2 days) to mean anything, so those days fold forward into Week 1 and
 *   it instead ends on the SUBSEQUENT Sunday (i.e. skip one Sunday). Weeks 2-3 are always plain
 *   7-day Mon-Sun weeks immediately following. Week 4 runs from wherever Week 3 ends through the
 *   last day of the month, absorbing whatever's left (6-13 days depending on the month).
 *
 * Verified against the spec's own worked examples:
 *   Sep 2026 (1st=Tue) -> 1-6, 7-13, 14-20, 21-30
 *   Feb 2026 (1st=Sun) -> 1-8, 9-15, 16-22, 23-28   (the fold case)
 *   Oct 2026 (1st=Thu) -> 1-4, 5-11, 12-18, 19-31
 *
 * All dates are plain YYYY-MM-DD strings. Per this codebase's own documented gotcha (see
 * CLAUDE.md — never round-trip a date through .toISOString()/UTC for date-only comparisons), all
 * arithmetic here uses the LOCAL Date constructor purely to walk calendar days (never comparing
 * across timezones, never attaching a time-of-day) — the same convention week-context.tsx already
 * uses for "today". Do not switch this to Date.UTC to "match" the Executive Dashboard's server
 * routes — those intentionally use UTC for cross-environment (dev/Vercel) consistency of API
 * query windows, which is a different problem from this file's local calendar-day walking.
 */

export type WeekNumber = 1 | 2 | 3 | 4
export type WeekStatus = "current" | "past" | "locked"

export type ScorecardWeek = {
  weekNumber: WeekNumber
  start: string // YYYY-MM-DD, inclusive
  end: string // YYYY-MM-DD, inclusive
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

function toDateString(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

/** Pure calendar-day arithmetic — local Date used only to walk days, never for timezone-sensitive comparisons. */
function addDaysToDateString(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + delta)
  return toDateString(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())
}

function dayOfWeek(dateStr: string): number {
  // 1 = Monday ... 7 = Sunday (ISO)
  const [y, m, d] = dateStr.split("-").map(Number)
  const jsDay = new Date(y, m - 1, d).getDay() // 0=Sun..6=Sat
  return jsDay === 0 ? 7 : jsDay
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate() // day 0 of next month = last day of this month
}

/** Today's local calendar date as YYYY-MM-DD — same convention as week-context.tsx's "today". */
export function todayDateString(): string {
  const now = new Date()
  return toDateString(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/**
 * Returns the 4 weeks for a given month (1-12), per the fold rule described above.
 */
export function getMonthWeeks(year: number, month: number): ScorecardWeek[] {
  const monthStart = toDateString(year, month, 1)
  const d = dayOfWeek(monthStart) // 1=Mon .. 7=Sun
  const daysToNearSunday = (7 - d) % 7 // 0 if the 1st is itself a Sunday
  const needsFold = d === 5 || d === 6 || d === 7 // Fri, Sat, Sun
  const week1EndOffset = needsFold ? daysToNearSunday + 7 : daysToNearSunday
  const week1End = addDaysToDateString(monthStart, week1EndOffset)

  const week2Start = addDaysToDateString(week1End, 1)
  const week2End = addDaysToDateString(week2Start, 6)

  const week3Start = addDaysToDateString(week2End, 1)
  const week3End = addDaysToDateString(week3Start, 6)

  const week4Start = addDaysToDateString(week3End, 1)
  const week4End = toDateString(year, month, lastDayOfMonth(year, month))

  return [
    { weekNumber: 1, start: monthStart, end: week1End },
    { weekNumber: 2, start: week2Start, end: week2End },
    { weekNumber: 3, start: week3Start, end: week3End },
    { weekNumber: 4, start: week4Start, end: week4End },
  ]
}

/** today defaults to todayDateString() but is accepted as a param so it's testable without mocking Date. */
export function getWeekStatus(week: ScorecardWeek, today: string = todayDateString()): WeekStatus {
  if (today < week.start) return "locked"
  if (today > week.end) return "past"
  return "current"
}

export function formatWeekRangeLabel(week: ScorecardWeek): string {
  const [, sm, sd] = week.start.split("-").map(Number)
  const [, em, ed] = week.end.split("-").map(Number)
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  const startLabel = `${MONTHS[sm - 1]} ${sd}`
  const endLabel = sm === em ? `${ed}` : `${MONTHS[em - 1]} ${ed}`
  return `${startLabel}–${endLabel}`
}

export function monthKey(year: number, month: number): string {
  return `${year}-${pad2(month)}`
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split("-").map(Number)
  return { year: y, month: m }
}
