'use client'

import { MetricBadge } from './MetricBadge'
import { MethodologyTooltip } from './MethodologyTooltip'

export type PipelineHealth = {
  openOpportunities: number
  openPipelineValue: number
  lateStageCount: number
  lateStageValue: number
  stalledOrAgingCount: number
  stalledOrAgingValue: number
  avgOpportunityAgeDays: number
  agingThresholdDays: number
  stageDistribution: Array<{ stage: string; count: number; value: number }>
}

const fmtMoney = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(0)}K` : `$${n.toLocaleString()}`

export function PipelineHealthKPIRow({ data, loading }: { data: PipelineHealth | null; loading: boolean }) {
  const cards = [
    {
      title: 'Open Opportunities',
      value: data ? data.openOpportunities.toLocaleString() : '—',
      tooltip: 'Count of deals in the Studio Deals pipeline that are not yet Closed Won or Closed Lost, right now. This is a live snapshot — it will fluctuate as deals close.',
    },
    {
      title: 'Total Open Pipeline Value',
      value: data ? fmtMoney(data.openPipelineValue) : '—',
      tooltip: 'Sum of the amount field across all currently-open deals. Decreases the moment a deal closes (won or lost) and increases as new deals are created — always reflects the pipeline as it stands right now.',
    },
    {
      title: 'Late-Stage Opportunities',
      value: data ? data.lateStageCount.toLocaleString() : '—',
      tooltip: 'Open deals currently in Negotiation or Legal & Contracts — the two stages immediately before Closed Won/Lost.',
    },
    {
      title: 'Stalled / Aging Opportunities',
      value: data ? data.stalledOrAgingCount.toLocaleString() : '—',
      tooltip: data ? `Open deals explicitly in the "Stalled" stage, OR open longer than ${data.agingThresholdDays} days since creation.` : '',
    },
    {
      title: 'Avg Opportunity Age',
      value: data ? `${data.avgOpportunityAgeDays}d` : '—',
      tooltip: 'Average days since creation, across currently-open deals only. Closed deals are excluded — this measures how long today’s live pipeline has been sitting.',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((c) => (
        <div className="kpi-card" key={c.title}>
          <p className="kpi-label mb-1">
            <MethodologyTooltip text={c.tooltip}>{c.title}</MethodologyTooltip>
          </p>
          {loading ? (
            <p className="text-[13px] text-[#7A6A60]">Loading…</p>
          ) : (
            <>
              <p className="kpi-value">{c.value}</p>
              <MetricBadge kind="snapshot" />
            </>
          )}
        </div>
      ))}
    </div>
  )
}
