import type { ScorecardChannel } from "./nav-channels"
import type { ChannelScore, ScorecardRules } from "./scorecard-types"
import { getBand, scoreKey } from "./scorecard-types"
import { getMonthWeeks, getWeekStatus } from "./scorecard-weeks"

export type MonthSummary = {
  avg: number | null
  green: number
  yellow: number
  red: number
  waiting: number
}

/**
 * Month average, band counts, and "waiting for a score" (any current-or-past week with no score
 * yet — locked/future weeks never count as waiting, they just haven't opened).
 */
export function computeMonthSummary(
  channels: ScorecardChannel[],
  scores: ChannelScore[],
  rules: ScorecardRules,
  year: number,
  month: number,
): MonthSummary {
  const weeks = getMonthWeeks(year, month)
  const scoreMap = new Map(scores.map((s) => [scoreKey(s.channel_id, s.week_number), s]))

  let sum = 0
  let count = 0
  let green = 0, yellow = 0, red = 0, waiting = 0

  for (const channel of channels) {
    for (const week of weeks) {
      const existing = scoreMap.get(scoreKey(channel.id, week.weekNumber))
      if (existing) {
        sum += existing.score
        count++
        const band = getBand(existing.score, rules)
        if (band === "green") green++
        else if (band === "yellow") yellow++
        else red++
      } else if (getWeekStatus(week) !== "locked") {
        waiting++
      }
    }
  }

  return { avg: count > 0 ? sum / count : null, green, yellow, red, waiting }
}

export type BandItem = { channelId: string; channelTitle: string; weekNumber: number; score: number; reason: string }
export type WaitingItem = { channelId: string; channelTitle: string; weekNumbers: number[] }

export type MonthBreakdown = {
  green: BandItem[]
  yellow: BandItem[]
  red: BandItem[]
  /** one entry per distinct channel with >=1 pending week (not one per pending cell) — per
   * explicit user request, the "waiting" count shown on the summary card should read as "how
   * many channels/teams haven't responded yet," not a raw cell count (which read as an
   * inflated, meaningless number like 79 across 28 channels). */
  waiting: WaitingItem[]
}

/** Per-channel breakdown behind the summary strip's Green/Yellow/Red/Waiting counts — powers their hover detail. */
export function computeMonthBreakdown(
  channels: ScorecardChannel[],
  scores: ChannelScore[],
  rules: ScorecardRules,
  year: number,
  month: number,
): MonthBreakdown {
  const weeks = getMonthWeeks(year, month)
  const scoreMap = new Map(scores.map((s) => [scoreKey(s.channel_id, s.week_number), s]))

  const green: BandItem[] = [], yellow: BandItem[] = [], red: BandItem[] = []
  const waitingByChannel = new Map<string, WaitingItem>()

  for (const channel of channels) {
    for (const week of weeks) {
      const existing = scoreMap.get(scoreKey(channel.id, week.weekNumber))
      if (existing) {
        const item: BandItem = { channelId: channel.id, channelTitle: channel.title, weekNumber: week.weekNumber, score: existing.score, reason: existing.reason }
        const band = getBand(existing.score, rules)
        if (band === "green") green.push(item)
        else if (band === "yellow") yellow.push(item)
        else red.push(item)
      } else if (getWeekStatus(week) !== "locked") {
        const entry = waitingByChannel.get(channel.id) ?? { channelId: channel.id, channelTitle: channel.title, weekNumbers: [] }
        entry.weekNumbers.push(week.weekNumber)
        waitingByChannel.set(channel.id, entry)
      }
    }
  }

  return { green, yellow, red, waiting: Array.from(waitingByChannel.values()) }
}

export type ChannelMonthAverage = { channelId: string; avg: number | null; count: number }

export function computeChannelAverage(channelId: string, scores: ChannelScore[]): ChannelMonthAverage {
  const mine = scores.filter((s) => s.channel_id === channelId)
  const sum = mine.reduce((a, s) => a + s.score, 0)
  return { channelId, avg: mine.length > 0 ? sum / mine.length : null, count: mine.length }
}
