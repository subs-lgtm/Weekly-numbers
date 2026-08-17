'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

type RangeSummary = { pipelineGenerated: number; dealCount: number; closedWonAmount: number; closedWonCount: number; avgDealSize: number; avgRevenuePerOpportunity: number }
type RangeResponse = { mode: 'range'; date_range: { start: string; end: string }; week: RangeSummary; month_to_date: RangeSummary }

type Props = {
  queryStart: string
  queryEnd: string
  /** Total MQL count for the period — used to compute "Avg Pipeline per MQL" exactly like the reference ($ ÷ MQLs). */
  totalMqls: number
}

function formatCurrency(n: number): string {
  if (n === 0) return '$0'
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

/** Matches reference HTML's "Pipeline Metrics" section — .row-4/.kpi-card structure exactly. */
export function PipelineMetricsCards({ queryStart, queryEnd, totalMqls }: Props) {
  const [data, setData] = useState<RangeResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/hubspot/pipeline-trend?mode=range&start=${queryStart}&end=${queryEnd}`)
      .then(r => r.json())
      .then(json => { if (!cancelled) { if (json.error) throw new Error(json.error); setData(json) } })
      .catch(e => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [queryStart, queryEnd])

  if (loading) {
    return (
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 }}>
        <RefreshCw className="h-4 w-4 animate-spin text-[#6B4C4C]" />
        <span className="text-[13px] text-[#7A6A60]">Loading pipeline metrics…</span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="card">
        <p className="text-[13px] text-[#DC2626]">Failed to load pipeline metrics{error ? `: ${error}` : ''}</p>
      </div>
    )
  }

  const { week, month_to_date } = data
  const avgPipelinePerMql = totalMqls > 0 ? week.pipelineGenerated / totalMqls : 0

  return (
    <div className="row-4">
      <div className="kpi-card">
        <div className="kpi-label">Weekly Pipeline Generated</div>
        <div className="kpi-value">{formatCurrency(week.pipelineGenerated)}</div>
        <span className="kpi-prev">{week.dealCount} deal{week.dealCount !== 1 ? 's' : ''} created</span>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">Monthly Pipeline Generated</div>
        <div className="kpi-value">{formatCurrency(month_to_date.pipelineGenerated)}</div>
        <span className="kpi-prev">{month_to_date.dealCount} deal{month_to_date.dealCount !== 1 ? 's' : ''} MTD</span>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">Avg Pipeline per MQL</div>
        <div className="kpi-value">{formatCurrency(avgPipelinePerMql)}</div>
        <span className="kpi-prev">{formatCurrency(week.pipelineGenerated)} ÷ {totalMqls} MQLs</span>
      </div>
      <div className="kpi-card">
        <div className="kpi-label">Avg Revenue per Opportunity</div>
        <div className="kpi-value">{week.closedWonCount > 0 ? formatCurrency(week.avgRevenuePerOpportunity) : '—'}</div>
        <span className="kpi-prev">
          {week.closedWonCount > 0 ? `${formatCurrency(week.closedWonAmount)} ÷ ${week.closedWonCount} opps` : 'No closed won this period'}
        </span>
      </div>
    </div>
  )
}
