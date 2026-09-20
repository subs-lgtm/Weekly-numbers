import { describe, it, expect } from "vitest"
import { getMonthWeeks, getWeekStatus, type ScorecardWeek } from "./scorecard-weeks"

describe("getMonthWeeks", () => {
  it("Sep 2026 (1st = Tuesday, no fold)", () => {
    expect(getMonthWeeks(2026, 9)).toEqual([
      { weekNumber: 1, start: "2026-09-01", end: "2026-09-06" },
      { weekNumber: 2, start: "2026-09-07", end: "2026-09-13" },
      { weekNumber: 3, start: "2026-09-14", end: "2026-09-20" },
      { weekNumber: 4, start: "2026-09-21", end: "2026-09-30" },
    ])
  })

  it("Feb 2026 (1st = Sunday, fold case)", () => {
    expect(getMonthWeeks(2026, 2)).toEqual([
      { weekNumber: 1, start: "2026-02-01", end: "2026-02-08" },
      { weekNumber: 2, start: "2026-02-09", end: "2026-02-15" },
      { weekNumber: 3, start: "2026-02-16", end: "2026-02-22" },
      { weekNumber: 4, start: "2026-02-23", end: "2026-02-28" },
    ])
  })

  it("Oct 2026 (1st = Thursday, no fold)", () => {
    expect(getMonthWeeks(2026, 10)).toEqual([
      { weekNumber: 1, start: "2026-10-01", end: "2026-10-04" },
      { weekNumber: 2, start: "2026-10-05", end: "2026-10-11" },
      { weekNumber: 3, start: "2026-10-12", end: "2026-10-18" },
      { weekNumber: 4, start: "2026-10-19", end: "2026-10-31" },
    ])
  })

  it("every week is 6-13 days, weeks tile the whole month with no gaps or overlaps, and week4 always ends on the month's last day", () => {
    for (const [year, month, lastDay] of [
      [2026, 1, 31], [2026, 3, 31], [2026, 4, 30], [2026, 5, 31], [2026, 6, 30],
      [2026, 7, 31], [2026, 8, 31], [2026, 11, 30], [2026, 12, 31], [2027, 2, 28], [2028, 2, 29],
    ] as const) {
      const weeks = getMonthWeeks(year, month)
      expect(weeks).toHaveLength(4)
      expect(weeks[0].start).toBe(`${year}-${String(month).padStart(2, "0")}-01`)
      expect(weeks[3].end).toBe(`${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`)
      for (let i = 0; i < 3; i++) {
        const thisEnd = new Date(weeks[i].end)
        const nextStart = new Date(weeks[i + 1].start)
        const diffDays = (nextStart.getTime() - thisEnd.getTime()) / 86_400_000
        expect(diffDays).toBe(1) // no gap, no overlap
      }
    }
  })

  it("Fri-1st and Sat-1st also fold forward (a near-Sunday of 1-2 days is too short)", () => {
    // 2026-05-01 is a Friday
    const may = getMonthWeeks(2026, 5)
    expect(may[0].start).toBe("2026-05-01")
    expect(may[0].end).toBe("2026-05-10") // folds past the near Sunday (May 3) to May 10
    // 2027-05-01 is a Saturday
    const may27 = getMonthWeeks(2027, 5)
    expect(may27[0].start).toBe("2027-05-01")
    expect(may27[0].end).toBe("2027-05-09") // folds past the near Sunday (May 2) to May 9
  })
})

describe("getWeekStatus", () => {
  const week: ScorecardWeek = { weekNumber: 2, start: "2026-09-07", end: "2026-09-13" }

  it("is locked before it starts", () => {
    expect(getWeekStatus(week, "2026-09-01")).toBe("locked")
    expect(getWeekStatus(week, "2026-09-06")).toBe("locked")
  })

  it("is current on any day within the range, inclusive of both ends", () => {
    expect(getWeekStatus(week, "2026-09-07")).toBe("current")
    expect(getWeekStatus(week, "2026-09-10")).toBe("current")
    expect(getWeekStatus(week, "2026-09-13")).toBe("current")
  })

  it("is past once today is after the end date", () => {
    expect(getWeekStatus(week, "2026-09-14")).toBe("past")
    expect(getWeekStatus(week, "2026-12-25")).toBe("past")
  })
})
