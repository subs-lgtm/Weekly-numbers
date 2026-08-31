'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { MetricBadge } from './MetricBadge'
import { MethodologyTooltip } from './MethodologyTooltip'

export type ExecutiveFlowResponse = {
  date_range: { start: string; end: string }
  previous_range: { start: string; end: string }
  current: { mqlsCreated: number; sqlsCreated: number; opportunitiesCreated: number; customersWon: number }
  previous: { mqlsCreated: number; sqlsCreated: number; opportunitiesCreated: number; customersWon: number }
  change: Record<'mqlsCreated' | 'sqlsCreated' | 'opportunitiesCreated' | 'customersWon', { pct: number | null; direction: 'up' | 'down' | 'flat' }>
}

const CARDS: Array<{
  key: 'mqlsCreated' | 'sqlsCreated' | 'opportunitiesCreated' | 'customersWon'
  title: string
  tooltip: string
}> = [
  {
    key: 'mqlsCreated', title: 'MQLs Created',
    tooltip: 'Contacts created in the selected period via a Book a Demo form submission. This is the dashboard’s one MQL definition — the cohort size is permanent (createdate never changes), even as these same contacts progress through later stages.',
  },
  {
    key: 'sqlsCreated', title: 'SQLs Created',
    tooltip: 'Of this same period’s MQL cohort (created via Book a Demo), how many are CURRENTLY at the SQL lifecycle stage, right now. The cohort size is fixed, but this count is a live read of current stage — it will change as these contacts keep progressing.',
  },
  {
    key: 'opportunitiesCreated', title: 'Opportunities Created',
    tooltip: 'Of this same period’s MQL cohort, how many are CURRENTLY at the Opportunity lifecycle stage, right now — a live snapshot of this specific cohort, not a running total.',
  },
  {
    key: 'customersWon', title: 'Customers Won',
    tooltip: 'Of this same period’s MQL cohort, how many are CURRENTLY at the Customer lifecycle stage — i.e. contacts created in this period who have since become paying customers.',
  },
]

function DirectionIcon({ direction }: { direction: 'up' | 'down' | 'flat' }) {
  if (direction === 'up') return <TrendingUp className="h-3 w-3" strokeWidth={2} />
  if (direction === 'down') return <TrendingDown className="h-3 w-3" strokeWidth={2} />
  return <Minus className="h-3 w-3" strokeWidth={2} />
}

export function BusinessFlowKPIRow({ data, loading }: { data: ExecutiveFlowResponse | null; loading: boolean }) {
  return (
    <div className="row-4">
      {CARDS.map(({ key, title, tooltip }) => {
        const current = data?.current[key]
        const previous = data?.previous[key]
        const change = data?.change[key]
        return (
          <div className="kpi-card" key={key}>
            <div className="flex items-center justify-between mb-1">
              <p className="kpi-label mb-0">
                <MethodologyTooltip text={tooltip}>{title}</MethodologyTooltip>
              </p>
            </div>
            {loading ? (
              <p className="text-[13px] text-[#7A6A60]">Loading…</p>
            ) : (
              <>
                <p className="kpi-value">{(current ?? 0).toLocaleString()}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {change?.pct === null ? (
                    <span className="kpi-delta flat">New</span>
                  ) : (
                    <span className={`kpi-delta ${change?.direction ?? 'flat'}`}>
                      <DirectionIcon direction={change?.direction ?? 'flat'} />
                      {change && Math.abs(change.pct ?? 0).toFixed(0)}%
                    </span>
                  )}
                  <span className="kpi-prev">vs {(previous ?? 0).toLocaleString()} prior period</span>
                </div>
                <div className="mt-3">
                  <MetricBadge kind="flow" />
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
