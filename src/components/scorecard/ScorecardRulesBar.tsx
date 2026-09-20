"use client"

import { useState } from "react"
import { Settings2 } from "lucide-react"
import { toast } from "sonner"
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover"
import { validateRules, type ScorecardRules } from "@/lib/scorecard-types"

const BAND_COLORS = {
  green: { bg: "rgba(74,222,128,.14)", text: "#16A34A" },
  yellow: { bg: "rgba(185,130,46,.14)", text: "#B9822E" },
  red: { bg: "rgba(190,74,60,.12)", text: "#BE4A3C" },
}

function LegendChip({ label, range, color }: { label: string; range: string; color: keyof typeof BAND_COLORS }) {
  const c = BAND_COLORS[color]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-[600]"
      style={{ background: c.bg, color: c.text }}
    >
      {label} {range}
    </span>
  )
}

export function ScorecardRulesBar({
  rules, onUpdateRules,
}: {
  rules: ScorecardRules
  onUpdateRules: (patch: Partial<ScorecardRules>) => Promise<ScorecardRules>
}) {
  const [open, setOpen] = useState(false)
  const [greenFrom, setGreenFrom] = useState(rules.green_from)
  const [redBelow, setRedBelow] = useState(rules.red_below)
  const [reasonBelow, setReasonBelow] = useState(rules.reason_required_below)
  const [saving, setSaving] = useState(false)

  const hasYellow = rules.red_below < rules.green_from
  const yellowRange = hasYellow ? `${rules.red_below}-${rules.green_from - 1}` : null

  const openEditor = () => {
    setGreenFrom(rules.green_from)
    setRedBelow(rules.red_below)
    setReasonBelow(rules.reason_required_below)
    setOpen(true)
  }

  const save = async () => {
    const check = validateRules({ green_from: greenFrom, red_below: redBelow, reason_required_below: reasonBelow })
    if (!check.valid) {
      toast.error(check.error)
      return
    }
    setSaving(true)
    try {
      await onUpdateRules({ green_from: greenFrom, red_below: redBelow, reason_required_below: reasonBelow })
      toast.success("Color rules saved")
      setOpen(false)
    } catch (e: any) {
      toast.error(e.message || "Failed to save rules")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[14px] border border-border bg-card px-4 py-3">
      <LegendChip label="Green" range={`${rules.green_from}-10`} color="green" />
      {hasYellow && <LegendChip label="Yellow" range={yellowRange!} color="yellow" />}
      <LegendChip label="Red" range={`1-${rules.red_below - 1}`} color="red" />
      <span className="text-[11px] text-muted-foreground">
        Reason required below {rules.reason_required_below}
      </span>

      <Popover open={open} onOpenChange={(v) => (v ? openEditor() : setOpen(false))}>
        <PopoverTrigger asChild>
          <button
            className="ml-auto flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[11.5px] font-[600] text-foreground transition-colors hover:bg-muted"
            aria-label="Edit color rules"
          >
            <Settings2 className="h-3.5 w-3.5" strokeWidth={2} />
            Edit rules
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 space-y-3">
          <p className="text-[12.5px] font-[600] text-foreground">Color rules</p>
          <label className="block text-[11.5px] text-muted-foreground">
            Green from
            <input
              type="number" min={2} max={10} value={greenFrom}
              onChange={(e) => setGreenFrom(Number(e.target.value))}
              className="mt-1 w-full rounded-[8px] border border-border bg-background px-2 py-1.5 text-[13px] text-foreground"
            />
          </label>
          <label className="block text-[11.5px] text-muted-foreground">
            Red below
            <input
              type="number" min={2} max={10} value={redBelow}
              onChange={(e) => setRedBelow(Number(e.target.value))}
              className="mt-1 w-full rounded-[8px] border border-border bg-background px-2 py-1.5 text-[13px] text-foreground"
            />
          </label>
          <label className="block text-[11.5px] text-muted-foreground">
            Reason needed below
            <input
              type="number" min={2} max={10} value={reasonBelow}
              onChange={(e) => setReasonBelow(Number(e.target.value))}
              className="mt-1 w-full rounded-[8px] border border-border bg-background px-2 py-1.5 text-[13px] text-foreground"
            />
          </label>
          {redBelow > greenFrom && (
            <p className="text-[11px] text-destructive">Red below cannot exceed Green from.</p>
          )}
          <button
            onClick={save}
            disabled={saving || redBelow > greenFrom}
            className="w-full rounded-full bg-primary py-1.5 text-[12px] font-[600] text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save rules"}
          </button>
        </PopoverContent>
      </Popover>
    </div>
  )
}
