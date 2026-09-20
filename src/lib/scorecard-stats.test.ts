import { describe, it, expect } from "vitest"
import { computeMonthSummary, computeMonthBreakdown } from "./scorecard-stats"
import { DEFAULT_RULES, type ChannelScore } from "./scorecard-types"
import type { ScorecardChannel } from "./nav-channels"
import { getMonthWeeks, getWeekStatus, todayDateString } from "./scorecard-weeks"

const channels: ScorecardChannel[] = [
  { id: "seo", title: "SEO", group: "SEO" },
  { id: "ads", title: "Ads", group: "Performance Channel" },
]

function mkScore(channel_id: string, week_number: 1 | 2 | 3 | 4, score: number): ChannelScore {
  return { channel_id, month: "current", week_number, score, reason: "", scored_by: "x@lyzr.ai", created_at: "", updated_at: "" }
}

describe("computeMonthSummary", () => {
  it("averages only scored cells and buckets by band", () => {
    const scores = [mkScore("seo", 1, 9), mkScore("seo", 2, 7), mkScore("ads", 1, 4)]
    // Use the current real month/year so week-status math (waiting count) is deterministic-ish; we only assert avg/bands here.
    const now = new Date()
    const summary = computeMonthSummary(channels, scores, DEFAULT_RULES, now.getFullYear(), now.getMonth() + 1)
    expect(summary.avg).toBeCloseTo((9 + 7 + 4) / 3)
    expect(summary.green).toBe(1) // 9
    expect(summary.yellow).toBe(1) // 7
    expect(summary.red).toBe(1) // 4
  })

  it("returns null average when nothing is scored yet", () => {
    const now = new Date()
    const summary = computeMonthSummary(channels, [], DEFAULT_RULES, now.getFullYear(), now.getMonth() + 1)
    expect(summary.avg).toBeNull()
  })

  it("never counts a locked (future) week as waiting", () => {
    // Pick a month far in the future — every week is locked, so waiting must be 0 regardless of channel count.
    const summary = computeMonthSummary(channels, [], DEFAULT_RULES, 2099, 1)
    expect(summary.waiting).toBe(0)
  })

  it("counts every unscored current-or-past week across all channels as waiting", () => {
    // Pick a month far in the past — every week is past, so waiting = channels.length * 4 weeks.
    const summary = computeMonthSummary(channels, [], DEFAULT_RULES, 2020, 1)
    expect(summary.waiting).toBe(channels.length * 4)
  })
})

describe("computeMonthBreakdown", () => {
  it("groups scored cells by band with channel/week/reason attached", () => {
    const scores = [
      mkScore("seo", 1, 9),
      { ...mkScore("seo", 2, 7), reason: "Two pages dropped out of top 10." },
      mkScore("ads", 1, 4),
    ]
    const now = new Date()
    const b = computeMonthBreakdown(channels, scores, DEFAULT_RULES, now.getFullYear(), now.getMonth() + 1)
    expect(b.green).toEqual([{ channelId: "seo", channelTitle: "SEO", weekNumber: 1, score: 9, reason: "" }])
    expect(b.yellow).toEqual([{ channelId: "seo", channelTitle: "SEO", weekNumber: 2, score: 7, reason: "Two pages dropped out of top 10." }])
    expect(b.red).toEqual([{ channelId: "ads", channelTitle: "Ads", weekNumber: 1, score: 4, reason: "" }])
  })

  it("collapses a channel's multiple pending weeks into one waiting entry", () => {
    // Every week past for both channels, nothing scored -> one waiting entry per channel, each listing all 4 weeks.
    const b = computeMonthBreakdown(channels, [], DEFAULT_RULES, 2020, 1)
    expect(b.waiting).toHaveLength(channels.length)
    const seoEntry = b.waiting.find((w) => w.channelId === "seo")
    expect(seoEntry?.weekNumbers).toEqual([1, 2, 3, 4])
  })

  it("omits a channel from waiting entirely once every open week is scored", () => {
    const now = new Date()
    const weeks = getMonthWeeks(now.getFullYear(), now.getMonth() + 1)
    const openWeeks = weeks.filter((w) => getWeekStatus(w) !== "locked")
    const scores = openWeeks.map((w) => mkScore("seo", w.weekNumber, 8))
    const b = computeMonthBreakdown(channels, scores, DEFAULT_RULES, now.getFullYear(), now.getMonth() + 1)
    expect(b.waiting.find((w) => w.channelId === "seo")).toBeUndefined()
    // ads was never scored, so it should still be waiting (assuming at least one open week exists).
    if (openWeeks.length > 0) {
      expect(b.waiting.find((w) => w.channelId === "ads")).toBeDefined()
    }
  })
})
