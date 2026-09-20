"use client"

import { useMemo, useState } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ScoreTooltipContent } from "./ScoreTooltipContent"
import { ScoreEditorDrawer } from "./ScoreEditorDrawer"
import { getBand, scoreKey, type ChannelScore, type ScorecardRules } from "@/lib/scorecard-types"
import { getMonthWeeks, getWeekStatus, formatWeekRangeLabel, type ScorecardWeek } from "@/lib/scorecard-weeks"
import { computeChannelAverage } from "@/lib/scorecard-stats"
import type { ScorecardChannel } from "@/lib/nav-channels"
import { useElementWidth } from "@/lib/useElementWidth"
import {
  ROW_VIEW_H, weekX, scoreToY, getZoneBands, BAND_STROKE, monotoneCubicPath,
  LEFT_GUTTER, RIGHT_PAD,
} from "@/lib/scorecard-chart-geometry"

const NAME_COL_W = 172
const AVG_COL_W = 84
const MIN_CHART_W = 720 - NAME_COL_W - AVG_COL_W

function SharedWeekHeader({ weeks, widthRef }: { weeks: ScorecardWeek[]; widthRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="flex items-stretch pb-2">
      <div style={{ width: NAME_COL_W }} className="shrink-0" />
      {/* ref goes on the UNPADDED outer element — ResizeObserver's contentRect excludes padding,
          so measuring here gives the exact same total width ChannelRow's SVG uses (padding is
          applied only to the inner row below, purely to visually offset the week labels to line
          up with the SVG's plot area — it must stay in sync with LEFT_GUTTER/RIGHT_PAD by hand). */}
      <div ref={widthRef} className="min-w-0 flex-1">
      <div className="flex" style={{ paddingLeft: LEFT_GUTTER, paddingRight: RIGHT_PAD }}>
        {weeks.map((w) => {
          const status = getWeekStatus(w)
          return (
            <div key={w.weekNumber} className="flex-1 text-center">
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-[10.5px] font-[600] uppercase tracking-[.06em] text-foreground">W{w.weekNumber}</span>
                {status === "current" && (
                  <span className="rounded-full px-1.5 py-0.5 text-[9px] font-[700]" style={{ background: "var(--ring)", color: "var(--primary)" }}>
                    This week
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">{formatWeekRangeLabel(w)}</div>
            </div>
          )
        })}
      </div>
      </div>
      <div style={{ width: AVG_COL_W }} className="shrink-0 text-center text-[10.5px] font-[600] uppercase tracking-[.06em] text-foreground">
        Month Avg
      </div>
    </div>
  )
}

function ScoreDot({
  channel, week, index, width, existing, rules, onClick,
}: {
  channel: ScorecardChannel
  week: ScorecardWeek
  index: 0 | 1 | 2 | 3
  width: number
  existing: ChannelScore | undefined
  rules: ScorecardRules
  onClick: () => void
}) {
  const status = getWeekStatus(week)
  const x = weekX(index, width)

  if (status === "locked") {
    return (
      <text x={x} y={scoreToY(5.5)} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 9, opacity: 0.6 }}>
        Not open yet
      </text>
    )
  }

  if (!existing) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <g
              onClick={onClick}
              role="button"
              tabIndex={0}
              aria-label={`Add score for ${channel.title}, week ${week.weekNumber}`}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick() } }}
              style={{ cursor: "pointer" }}
            >
              <rect x={x - 20} y={scoreToY(5.5) - 11} width={40} height={22} rx={11} fill="none" stroke="var(--muted-foreground)" strokeDasharray="3 3" opacity={0.6} />
              <text x={x} y={scoreToY(5.5) + 3.5} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 10, fontWeight: 600 }}>
                + Add
              </text>
            </g>
          </TooltipTrigger>
        </Tooltip>
      </TooltipProvider>
    )
  }

  const band = getBand(existing.score, rules)
  const color = BAND_STROKE[band]
  const y = scoreToY(existing.score)

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <g
            onClick={onClick}
            role="button"
            tabIndex={0}
            aria-label={`${channel.title}, week ${week.weekNumber}: score ${existing.score}, ${band} band${existing.reason ? `, reason: ${existing.reason}` : ""}`}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick() } }}
            style={{ cursor: "pointer" }}
          >
            <text x={x} y={y - 10} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: color }}>
              {existing.score}
            </text>
            {/* Invisible larger hit target — the visible dot (r=5) is too small to reliably click/tap on its own. */}
            <circle cx={x} cy={y} r={12} fill="transparent" />
            <circle cx={x} cy={y} r={5} fill={color} stroke="var(--card)" strokeWidth={2} />
          </g>
        </TooltipTrigger>
        <TooltipContent side="top" className="border border-border bg-popover text-popover-foreground shadow-lg" collisionPadding={12}>
          <ScoreTooltipContent
            channelTitle={channel.title} week={week} score={existing.score} reason={existing.reason}
            band={band} rules={rules} scoredBy={existing.scored_by} updatedAt={existing.updated_at}
          />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function ChannelRow({
  channel, weeks, scores, rules, width, onCellClick,
}: {
  channel: ScorecardChannel
  weeks: ScorecardWeek[]
  scores: ChannelScore[]
  rules: ScorecardRules
  width: number
  onCellClick: (week: ScorecardWeek) => void
}) {
  const scoreMap = new Map(scores.map((s) => [scoreKey(s.channel_id, s.week_number), s]))
  const points = weeks
    .map((w, i) => {
      const s = scoreMap.get(scoreKey(channel.id, w.weekNumber))
      return s ? { weekIndex: i, weekNumber: w.weekNumber, x: weekX(i as 0 | 1 | 2 | 3, width), y: scoreToY(s.score) } : null
    })
    .filter((p): p is { weekIndex: number; weekNumber: ScorecardWeek["weekNumber"]; x: number; y: number } => p !== null)

  // Solid segments only bridge ADJACENT scored weeks; any gap (missing week in between) is dashed.
  const segments: { path: string; dashed: boolean }[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1]
    const path = monotoneCubicPath([{ x: a.x, y: a.y }, { x: b.x, y: b.y }])
    if (path) segments.push({ path, dashed: b.weekIndex - a.weekIndex > 1 })
  }

  const zones = getZoneBands(rules)
  const currentIdx = weeks.findIndex((w) => getWeekStatus(w) === "current")
  const avg = computeChannelAverage(channel.id, scores)
  const avgBand = avg.avg !== null ? getBand(Math.round(avg.avg), rules) : null
  const plotW = width - LEFT_GUTTER - RIGHT_PAD

  return (
    <div className="flex items-stretch py-1">
      <div style={{ width: NAME_COL_W }} className="flex shrink-0 items-center pr-2">
        <span className="truncate text-[12.5px] font-[600] text-foreground">{channel.title}</span>
      </div>
      <div className="min-w-0 flex-1">
        {width > 0 && (
          // viewBox matches the row's REAL measured pixel width 1:1 (no preserveAspectRatio
          // stretching) so text/strokes render crisp instead of non-uniformly scaled/blurry —
          // see scorecard-chart-geometry.ts's header comment for why this matters.
          <svg viewBox={`0 0 ${width} ${ROW_VIEW_H}`} width={width} height={ROW_VIEW_H} role="img" aria-label={`${channel.title} weekly scores`}>
            {currentIdx >= 0 && (
              <rect
                x={weekX(currentIdx as 0 | 1 | 2 | 3, width) - plotW / 8}
                y={0} width={plotW / 4} height={ROW_VIEW_H}
                fill="var(--primary)" opacity={0.04}
              />
            )}
            {zones.map((z) => (
              <rect key={z.band} x={LEFT_GUTTER} y={z.yTop} width={plotW} height={Math.max(0, z.yBottom - z.yTop)} fill={z.fill} />
            ))}
            {zones.slice(0, -1).map((z) => (
              <line key={z.band} x1={LEFT_GUTTER} x2={width - RIGHT_PAD} y1={z.yBottom} y2={z.yBottom} stroke="var(--border)" strokeDasharray="2 2" />
            ))}
            {zones.map((z) => (
              <text key={z.band} x={2} y={(z.yTop + z.yBottom) / 2 + 3} style={{ fontSize: 8, fill: "var(--muted-foreground)" }}>
                {z.rangeLabel}
              </text>
            ))}
            {segments.map((s, i) => (
              <path key={i} d={s.path} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray={s.dashed ? "4 3" : undefined} opacity={s.dashed ? 0.5 : 0.35} />
            ))}
            {weeks.map((w, i) => (
              <ScoreDot
                key={w.weekNumber}
                channel={channel} week={w} index={i as 0 | 1 | 2 | 3} width={width}
                existing={scoreMap.get(scoreKey(channel.id, w.weekNumber))}
                rules={rules}
                onClick={() => onCellClick(w)}
              />
            ))}
          </svg>
        )}
      </div>
      <div style={{ width: AVG_COL_W }} className="flex shrink-0 items-center justify-center">
        <span className="font-[family-name:var(--font-playfair)] text-[16px] font-[500]" style={{ color: avgBand ? BAND_STROKE[avgBand] : "var(--muted-foreground)" }}>
          {avg.avg !== null ? avg.avg.toFixed(1) : "—"}
        </span>
      </div>
    </div>
  )
}

export function ScorecardChart({
  channels, scores, rules, year, month, userEmail,
  onSave, onClear,
}: {
  channels: ScorecardChannel[]
  scores: ChannelScore[]
  rules: ScorecardRules
  year: number
  month: number
  userEmail: string
  onSave: (channelId: string, week: ScorecardWeek, score: number, reason: string) => Promise<void>
  onClear: (channelId: string, week: ScorecardWeek) => Promise<void>
}) {
  const weeks = useMemo(() => getMonthWeeks(year, month), [year, month])
  const grouped = useMemo(() => {
    const map = new Map<string, ScorecardChannel[]>()
    for (const c of channels) {
      if (!map.has(c.group)) map.set(c.group, [])
      map.get(c.group)!.push(c)
    }
    return Array.from(map.entries())
  }, [channels])

  const [editing, setEditing] = useState<{ channel: ScorecardChannel; week: ScorecardWeek } | null>(null)
  // Measured once off the header's middle column — every row reuses this exact value so all
  // rows and the header stay pixel-aligned (they share the same 172px/84px side-column layout).
  const [headerWidthRef, chartWidth] = useElementWidth<HTMLDivElement>()

  const scoredThisMonth = scores.length
  const totalCells = channels.length * 4

  return (
    <div className="card overflow-x-auto">
      <div className="card-head">
        <span className="card-title">Channel Scorecard</span>
        <span className="card-note">{scoredThisMonth} of {totalCells} scored</span>
      </div>

      <div style={{ minWidth: NAME_COL_W + MIN_CHART_W + AVG_COL_W }}>
        <SharedWeekHeader weeks={weeks} widthRef={headerWidthRef} />
        {grouped.map(([group, groupChannels]) => (
          <div key={group} className="mb-1">
            <div className="mb-1 mt-2 text-[10.5px] font-[600] uppercase tracking-[.09em] text-muted-foreground">{group}</div>
            {groupChannels.map((channel) => (
              <ChannelRow
                key={channel.id}
                channel={channel} weeks={weeks}
                scores={scores.filter((s) => s.channel_id === channel.id)}
                rules={rules}
                width={chartWidth}
                onCellClick={(week) => setEditing({ channel, week })}
              />
            ))}
          </div>
        ))}
      </div>

      <ScoreEditorDrawer
        open={editing !== null}
        onOpenChange={(v) => { if (!v) setEditing(null) }}
        channel={editing?.channel ?? null}
        week={editing?.week ?? null}
        year={year} month={month} rules={rules} userEmail={userEmail}
        allScoresForChannel={editing ? scores.filter((s) => s.channel_id === editing.channel.id) : []}
        onSave={async (score, reason) => { if (editing) await onSave(editing.channel.id, editing.week, score, reason) }}
        onClear={async () => { if (editing) await onClear(editing.channel.id, editing.week) }}
      />
    </div>
  )
}
