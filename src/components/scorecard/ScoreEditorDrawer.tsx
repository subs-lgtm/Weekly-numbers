"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { getBand, isReasonRequired, type ScorecardRules, type ChannelScore, type ScoreBand } from "@/lib/scorecard-types"
import { formatWeekRangeLabel, getMonthWeeks, type ScorecardWeek } from "@/lib/scorecard-weeks"
import type { ScorecardChannel } from "@/lib/nav-channels"

const BAND_COLORS: Record<ScoreBand, { bg: string; text: string; border: string }> = {
  green: { bg: "#16A34A", text: "#FFFFFF", border: "#16A34A" },
  yellow: { bg: "#B9822E", text: "#FFFFFF", border: "#B9822E" },
  red: { bg: "#BE4A3C", text: "#FFFFFF", border: "#BE4A3C" },
}
const BAND_MEANING: Record<ScoreBand, string> = { green: "on track", yellow: "needs watching", red: "needs action" }

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

export function ScoreEditorDrawer({
  open, onOpenChange, channel, week, year, month, rules, userEmail, allScoresForChannel,
  onSave, onClear,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  channel: ScorecardChannel | null
  week: ScorecardWeek | null
  year: number
  month: number
  rules: ScorecardRules
  userEmail: string
  /** every existing score for this channel in this month, for the W1-W4 chip strip + "last scored by" */
  allScoresForChannel: ChannelScore[]
  onSave: (score: number, reason: string) => Promise<void>
  onClear: () => Promise<void>
}) {
  const monthKey = `${year}-${String(month).padStart(2, "0")}`
  const existing = week ? allScoresForChannel.find((s) => s.week_number === week.weekNumber) : null

  const [score, setScore] = useState<number | null>(existing?.score ?? null)
  const [reason, setReason] = useState(existing?.reason ?? "")
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)

  // Re-sync local state whenever a different cell is opened
  useEffect(() => {
    setScore(existing?.score ?? null)
    setReason(existing?.reason ?? "")
  }, [week?.weekNumber, existing?.score, existing?.reason])

  if (!channel || !week) return null

  const band = score !== null ? getBand(score, rules) : null
  const reasonRequired = score !== null ? isReasonRequired(score, rules) : false
  const reasonOk = !reasonRequired || reason.trim().length >= rules.min_reason_length
  const canSave = score !== null && reasonOk

  const monthWeeks = getMonthWeeks(year, month)

  const save = async () => {
    if (!canSave || score === null) return
    setSaving(true)
    try {
      await onSave(score, reason.trim())
      toast.success("Score saved")
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message || "Failed to save score")
    } finally {
      setSaving(false)
    }
  }

  const clear = async () => {
    setClearing(true)
    try {
      await onClear()
      toast.success("Score cleared")
      onOpenChange(false)
    } catch (e: any) {
      toast.error(e.message || "Failed to clear score")
    } finally {
      setClearing(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[440px] flex flex-col gap-5 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{channel.title}</SheetTitle>
          <SheetDescription>
            Week {week.weekNumber} · {formatWeekRangeLabel(week)}
          </SheetDescription>
        </SheetHeader>

        {/* W1-W4 chips */}
        <div className="flex gap-2" role="tablist" aria-label="Weeks this month">
          {monthWeeks.map((w) => {
            const wScore = allScoresForChannel.find((s) => s.week_number === w.weekNumber)
            const isCurrentCell = w.weekNumber === week.weekNumber
            return (
              <div
                key={w.weekNumber}
                className={`flex h-8 w-10 items-center justify-center rounded-[8px] border text-[11px] font-[600] ${isCurrentCell ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
              >
                {wScore ? wScore.score : "W" + w.weekNumber}
              </div>
            )
          })}
        </div>

        {/* Score picker */}
        <div>
          <p className="mb-2 text-[12px] font-[600] text-foreground">Score</p>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
              const nBand = getBand(n, rules)
              const colors = BAND_COLORS[nBand]
              const selected = score === n
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScore(n)}
                  aria-pressed={selected}
                  aria-label={`Score ${n}, ${nBand} band`}
                  className="flex h-10 items-center justify-center rounded-[8px] text-[13px] font-[700] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                  style={
                    selected
                      ? { background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }
                      : { background: "var(--muted)", color: "var(--foreground)", border: "1px solid var(--border)" }
                  }
                >
                  {n}
                </button>
              )
            })}
          </div>
          {band && (
            <p className="mt-2 text-[11.5px]" style={{ color: BAND_COLORS[band].bg }}>
              {band[0].toUpperCase() + band.slice(1)} — {BAND_MEANING[band]} — scores{" "}
              {band === "green" ? `${rules.green_from}-10` : band === "red" ? `below ${rules.red_below}` : `${rules.red_below}-${rules.green_from - 1}`} show {band}
            </p>
          )}
        </div>

        {/* Reason */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="scorecard-reason" className="text-[12px] font-[600] text-foreground">Why this score?</label>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-[600]"
              style={reasonRequired ? { background: "rgba(190,74,60,.12)", color: "#BE4A3C" } : { background: "var(--muted)", color: "var(--muted-foreground)" }}
            >
              {reasonRequired ? "Required" : "Optional"}
            </span>
          </div>
          <Textarea
            id="scorecard-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What's driving this score?"
            rows={4}
            aria-invalid={reasonRequired && !reasonOk}
          />
          {reasonRequired && !reasonOk && (
            <p className="mt-1 text-[11px] text-destructive">Add at least {rules.min_reason_length} characters</p>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground">Scoring as {userEmail}</p>
        {existing && (
          <p className="text-[11px] text-muted-foreground">
            Last scored by {existing.scored_by} · {timeAgo(existing.updated_at)}
          </p>
        )}

        <SheetFooter className="mt-auto flex-row items-center justify-between gap-2 sm:justify-between">
          {existing ? (
            <Button variant="ghost" onClick={clear} disabled={clearing || saving} className="text-destructive hover:text-destructive">
              {clearing ? "Clearing…" : "Clear score"}
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || clearing}>Cancel</Button>
            <Button onClick={save} disabled={!canSave || saving || clearing}>{saving ? "Saving…" : "Save score"}</Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
