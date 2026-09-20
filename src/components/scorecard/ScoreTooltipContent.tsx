"use client"

import type { ScoreBand, ScorecardRules } from "@/lib/scorecard-types"
import { formatWeekRangeLabel, type ScorecardWeek } from "@/lib/scorecard-weeks"

const BAND_META: Record<ScoreBand, { label: string; meaning: string; text: string; bg: string }> = {
  green: { label: "Green", meaning: "on track", text: "#16A34A", bg: "rgba(74,222,128,.14)" },
  yellow: { label: "Yellow", meaning: "needs watching", text: "#B9822E", bg: "rgba(185,130,46,.14)" },
  red: { label: "Red", meaning: "needs action", text: "#BE4A3C", bg: "rgba(190,74,60,.12)" },
}

function ruleLine(band: ScoreBand, rules: ScorecardRules): string {
  if (band === "green") return `Scores ${rules.green_from}-10 show green`
  if (band === "red") return `Scores below ${rules.red_below} show red`
  return `Scores ${rules.red_below}-${rules.green_from - 1} show yellow`
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  return `${day}d ago`
}

export function ScoreTooltipContent({
  channelTitle, week, score, reason, band, rules, scoredBy, updatedAt,
}: {
  channelTitle: string
  week: ScorecardWeek
  score: number
  reason: string
  band: ScoreBand
  rules: ScorecardRules
  scoredBy: string
  updatedAt: string
}) {
  const meta = BAND_META[band]
  return (
    <div className="w-64 space-y-2 p-1">
      <div>
        <p className="text-[12.5px] font-[700] text-foreground">{channelTitle}</p>
        <p className="text-[11px] text-muted-foreground">Week {week.weekNumber} · {formatWeekRangeLabel(week)}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-[family-name:var(--font-playfair)] text-[26px] font-[500] leading-none text-foreground">{score}</span>
        <span className="rounded-full px-2 py-0.5 text-[10.5px] font-[700]" style={{ background: meta.bg, color: meta.text }}>
          {meta.label} — {meta.meaning}
        </span>
      </div>
      <p className="text-[10.5px] text-muted-foreground">{ruleLine(band, rules)}</p>
      {reason && (
        <p className="text-[11.5px] text-foreground">
          <span className="font-[600]">Why {score}?</span> {reason}
        </p>
      )}
      <p className="text-[10.5px] text-muted-foreground">
        Scored by {scoredBy} · {timeAgo(updatedAt)} · Click to edit
      </p>
    </div>
  )
}
