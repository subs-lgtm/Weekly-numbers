/** Shared types + pure validation/band logic for the Channel Scorecard — used by both API routes and UI. */

export type ScorecardRules = {
  green_from: number
  red_below: number
  reason_required_below: number
  min_reason_length: number
}

export const DEFAULT_RULES: ScorecardRules = {
  green_from: 8,
  red_below: 6,
  reason_required_below: 10,
  min_reason_length: 10,
}

export type ScoreBand = "green" | "yellow" | "red"

/**
 * green_from and red_below define the boundary: score >= green_from -> green,
 * score < red_below -> red, everything between -> yellow. If red_below === green_from there is
 * no yellow band (explicit spec requirement) — a score < green_from is red, >= is green.
 */
export function getBand(score: number, rules: ScorecardRules): ScoreBand {
  if (score >= rules.green_from) return "green"
  if (score < rules.red_below) return "red"
  return "yellow"
}

export function isReasonRequired(score: number, rules: ScorecardRules): boolean {
  return score < rules.reason_required_below
}

export function validateRules(rules: Partial<ScorecardRules>): { valid: boolean; error?: string } {
  const { green_from, red_below, reason_required_below, min_reason_length } = rules
  for (const [key, val] of Object.entries({ green_from, red_below, reason_required_below, min_reason_length })) {
    if (val === undefined) continue
    if (key === "min_reason_length") {
      if (!Number.isInteger(val) || val < 0) return { valid: false, error: "min_reason_length must be a non-negative integer" }
      continue
    }
    if (!Number.isInteger(val) || val < 2 || val > 10) {
      return { valid: false, error: `${key} must be an integer between 2 and 10` }
    }
  }
  if (green_from !== undefined && red_below !== undefined && red_below > green_from) {
    return { valid: false, error: "red_below cannot be greater than green_from" }
  }
  return { valid: true }
}

export type ChannelScore = {
  channel_id: string
  month: string // YYYY-MM
  week_number: 1 | 2 | 3 | 4
  score: number
  reason: string
  scored_by: string // email, server-verified
  created_at: string // ISO
  updated_at: string // ISO
}

export type HistoryAction = "create" | "edit" | "clear"

export type HistoryEntry = {
  action: HistoryAction
  channel_id: string
  month: string
  week_number: 1 | 2 | 3 | 4
  old_value: { score: number; reason: string } | null
  new_value: { score: number; reason: string } | null
  changed_by: string
  changed_at: string // ISO
}

export function scoreDocId(channelId: string, month: string, weekNumber: number): string {
  return `${channelId}_${month}_${weekNumber}`
}

/** Lookup key for a channel+week within a single month's already-fetched score list (no month component needed — the list is already scoped to one month). */
export function scoreKey(channelId: string, weekNumber: number): string {
  return `${channelId}_${weekNumber}`
}
