"use client"

import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import type { MonthSummary, MonthBreakdown, BandItem, WaitingItem } from "@/lib/scorecard-stats"

function weekLabel(weekNumbers: number[]): string {
  return weekNumbers.length === 1 ? `Week ${weekNumbers[0]}` : `Weeks ${weekNumbers.join(", ")}`
}

function BandHoverList({ items, emptyLabel }: { items: BandItem[]; emptyLabel: string }) {
  if (items.length === 0) return <p className="text-[11.5px] text-muted-foreground">{emptyLabel}</p>
  return (
    <ul className="space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="text-[11.5px]">
          <p className="font-[600] text-foreground">{it.channelTitle} <span className="font-[400] text-muted-foreground">· Week {it.weekNumber} · {it.score}/10</span></p>
          {it.reason && <p className="mt-0.5 text-muted-foreground">{it.reason}</p>}
        </li>
      ))}
    </ul>
  )
}

function WaitingHoverList({ items }: { items: WaitingItem[] }) {
  if (items.length === 0) return <p className="text-[11.5px] text-muted-foreground">Every open week is scored.</p>
  return (
    <ul className="space-y-2">
      {items.map((it) => (
        <li key={it.channelId} className="text-[11.5px] text-foreground">
          Waiting for response — I&apos;m waiting for the <span className="font-[600]">{it.channelTitle}</span> team to update the score ({weekLabel(it.weekNumbers)}).
        </li>
      ))}
    </ul>
  )
}

function StatCard({
  label, value, tint, hoverTitle, hoverContent,
}: {
  label: string
  value: string
  tint?: string
  hoverTitle?: string
  hoverContent?: React.ReactNode
}) {
  const card = (
    <div className="rounded-[15px] border border-border bg-card px-[19px] py-[18px] shadow-[var(--shadow-resting)]">
      <div className="mb-[9px] text-[10.5px] font-[600] uppercase tracking-[.08em] text-muted-foreground">{label}</div>
      <div className="font-[family-name:var(--font-playfair)] text-[30px] font-[500] leading-none text-foreground" style={tint ? { color: tint } : undefined}>
        {value}
      </div>
    </div>
  )

  if (!hoverContent) return card

  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>
        <button type="button" className="w-full text-left cursor-default">{card}</button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-80 max-h-80 overflow-y-auto">
        <p className="mb-2 text-[11px] font-[600] uppercase tracking-[.06em] text-muted-foreground">{hoverTitle}</p>
        {hoverContent}
      </HoverCardContent>
    </HoverCard>
  )
}

export function ScorecardSummaryStrip({ summary, breakdown }: { summary: MonthSummary; breakdown: MonthBreakdown }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard label="Month Average" value={summary.avg !== null ? `${summary.avg.toFixed(1)}/10` : "—"} />
      <StatCard
        label="Green" value={String(summary.green)} tint="#16A34A"
        hoverTitle="Green this month"
        hoverContent={<BandHoverList items={breakdown.green} emptyLabel="Nothing green yet." />}
      />
      <StatCard
        label="Yellow" value={String(summary.yellow)} tint="#B9822E"
        hoverTitle="Yellow this month"
        hoverContent={<BandHoverList items={breakdown.yellow} emptyLabel="Nothing yellow yet." />}
      />
      <StatCard
        label="Red" value={String(summary.red)} tint="#BE4A3C"
        hoverTitle="Red this month"
        hoverContent={<BandHoverList items={breakdown.red} emptyLabel="Nothing red yet." />}
      />
      <StatCard
        label="Waiting for a Score" value={String(breakdown.waiting.length)}
        hoverTitle="Waiting on"
        hoverContent={<WaitingHoverList items={breakdown.waiting} />}
      />
    </div>
  )
}
