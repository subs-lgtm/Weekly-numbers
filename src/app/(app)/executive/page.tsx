'use client'

import { useEffect, useState } from 'react'
import { SectionShell } from '@/components/SectionShell'
import { useWeek } from '@/lib/week-context'
import { BusinessFlowKPIRow, type ExecutiveFlowResponse } from '@/components/executive/BusinessFlowKPIRow'
import { PipelineHealthKPIRow, type PipelineHealth } from '@/components/executive/PipelineHealthKPIRow'
import { MonthlyBusinessFlowTrendChart, type FlowTrendPoint } from '@/components/executive/MonthlyBusinessFlowTrendChart'
import { PipelineStageDistributionChart } from '@/components/executive/PipelineStageDistributionChart'
import { CohortFunnelTable, type Cohort } from '@/components/executive/CohortFunnelTable'
import { OpportunityCohortOutcomeChart } from '@/components/executive/OpportunityCohortOutcomeChart'
import { ConversionTrendCharts } from '@/components/executive/ConversionTrendCharts'
import { PredictiveFunnelTable, type ProjectionCohort, type ProjectionBaseline } from '@/components/executive/PredictiveFunnelTable'
import { PriorityMixTable, type PriorityMonthRow } from '@/components/executive/PriorityMixTable'

export default function ExecutiveDashboardPage() {
  const { queryStart, queryEnd, range } = useWeek()

  const [flow, setFlow] = useState<ExecutiveFlowResponse | null>(null)
  const [flowLoading, setFlowLoading] = useState(true)

  const [trend, setTrend] = useState<FlowTrendPoint[]>([])
  const [trendLoading, setTrendLoading] = useState(true)

  const [pipelineHealth, setPipelineHealth] = useState<PipelineHealth | null>(null)
  const [pipelineLoading, setPipelineLoading] = useState(true)

  const [cohortMonths, setCohortMonths] = useState(6)
  const [cohorts, setCohorts] = useState<Cohort[]>([])
  const [projectionCohorts, setProjectionCohorts] = useState<ProjectionCohort[]>([])
  const [projectionBaseline, setProjectionBaseline] = useState<ProjectionBaseline | null>(null)
  const [cohortsLoading, setCohortsLoading] = useState(true)

  const [priorityRows, setPriorityRows] = useState<PriorityMonthRow[]>([])
  const [priorityLoading, setPriorityLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setFlowLoading(true)
    fetch(`/api/hubspot/executive-flow?start=${queryStart}&end=${queryEnd}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setFlow(d) })
      .catch(() => { if (!cancelled) setFlow(null) })
      .finally(() => { if (!cancelled) setFlowLoading(false) })
    return () => { cancelled = true }
  }, [queryStart, queryEnd])

  useEffect(() => {
    let cancelled = false
    setTrendLoading(true)
    fetch(`/api/hubspot/executive-flow?mode=trend&months=6&end=${queryEnd}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setTrend(d.points || []) })
      .catch(() => { if (!cancelled) setTrend([]) })
      .finally(() => { if (!cancelled) setTrendLoading(false) })
    return () => { cancelled = true }
  }, [queryEnd])

  useEffect(() => {
    let cancelled = false
    setPipelineLoading(true)
    fetch('/api/hubspot/deals-acv')
      .then(r => r.json())
      .then(d => { if (!cancelled) setPipelineHealth(d.pipelineHealth || null) })
      .catch(() => { if (!cancelled) setPipelineHealth(null) })
      .finally(() => { if (!cancelled) setPipelineLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    setCohortsLoading(true)
    fetch(`/api/hubspot/executive-cohorts?months=${cohortMonths}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        setCohorts(d.cohorts || [])
        setProjectionCohorts(d.cohorts || [])
        setProjectionBaseline(d.projectionBaseline || null)
      })
      .catch(() => { if (!cancelled) { setCohorts([]); setProjectionCohorts([]); setProjectionBaseline(null) } })
      .finally(() => { if (!cancelled) setCohortsLoading(false) })
    return () => { cancelled = true }
  }, [cohortMonths])

  useEffect(() => {
    let cancelled = false
    setPriorityLoading(true)

    // Trailing 3 calendar months (same convention as the Predictive Funnel below), each using
    // the same MQL cohort definition as the rest of this dashboard: createdate in month +
    // Book a Demo. Reuses the existing /api/hubspot/mqls route, which already computes
    // high_priority/medium_priority/low_priority for any date range — no new backend needed.
    const now = new Date()
    const months = [2, 1, 0].map(i => {
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1))
      return {
        period: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`,
        label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10),
      }
    })

    Promise.all(months.map(m =>
      fetch(`/api/hubspot/mqls?start=${m.start}&end=${m.end}&nocache=1`)
        .then(r => r.json())
        .then(d => ({
          period: m.period,
          label: m.label,
          high: d.high_priority || 0,
          medium: d.medium_priority || 0,
          low: d.low_priority || 0,
          unknown: d.unknown_priority || 0,
        }))
        .catch(() => ({ period: m.period, label: m.label, high: 0, medium: 0, low: 0, unknown: 0 }))
    )).then(rows => { if (!cancelled) setPriorityRows(rows) })
      .finally(() => { if (!cancelled) setPriorityLoading(false) })

    return () => { cancelled = true }
  }, [])

  return (
    <SectionShell
      title="Executive Dashboard"
      description="Business Flow, Pipeline Health, and Cohort Conversion — three separate views so historical numbers never quietly change and long sales cycles aren't misjudged."
    >
      <div className="space-y-8">
        {/* Row 1 — Business Flow Performance */}
        <section className="space-y-3">
          <div>
            <h2 className="text-[15px] font-[700] text-[#2A1F1A]">Business Flow Performance</h2>
            <p className="card-note">What did we generate, and what business outcomes occurred, during {range.label}? Static once the period closes.</p>
          </div>
          <BusinessFlowKPIRow data={flow} loading={flowLoading} />
        </section>

        {/* Row 2 — Current Pipeline Health */}
        <section className="space-y-3">
          <div>
            <h2 className="text-[15px] font-[700] text-[#2A1F1A]">Current Pipeline Health</h2>
            <p className="card-note">What does the pipeline look like right now? Always current — fluctuates as deals move and close, independent of the period selected above.</p>
          </div>
          <PipelineHealthKPIRow data={pipelineHealth} loading={pipelineLoading} />
        </section>

        {/* Row 3 — Charts */}
        <div className="row-2">
          <MonthlyBusinessFlowTrendChart points={trend} loading={trendLoading} />
          <PipelineStageDistributionChart stageDistribution={pipelineHealth?.stageDistribution || []} loading={pipelineLoading} />
        </div>

        {/* Row 4 — Cohort Conversion Performance */}
        <section className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-[15px] font-[700] text-[#2A1F1A]">Cohort Conversion Performance</h2>
              <p className="card-note">Of the leads/opportunities generated in a given month, how many eventually converted? Denominators are fixed per cohort; outcomes update as records progress.</p>
            </div>
            <select
              value={cohortMonths}
              onChange={(e) => setCohortMonths(parseInt(e.target.value, 10))}
              className="text-[12px] border border-[#D4CBC0] rounded-[8px] px-2.5 py-1.5 bg-white text-[#2A1F1A]"
            >
              <option value={3}>Last 3 months</option>
              <option value={6}>Last 6 months</option>
              <option value={9}>Last 9 months</option>
              <option value={12}>Last 12 months</option>
            </select>
          </div>
          <CohortFunnelTable cohorts={cohorts} loading={cohortsLoading} />
          <PredictiveFunnelTable cohorts={projectionCohorts} baseline={projectionBaseline} loading={cohortsLoading} />
          <OpportunityCohortOutcomeChart cohorts={cohorts} loading={cohortsLoading} />
        </section>

        {/* Lead Priority Mix */}
        <section className="space-y-3">
          <PriorityMixTable rows={priorityRows} loading={priorityLoading} />
        </section>

        {/* Row 5 — Conversion Trends */}
        <section className="space-y-3">
          <div>
            <h2 className="text-[15px] font-[700] text-[#2A1F1A]">Conversion Trends</h2>
            <p className="card-note">Same cohort lineage as the table above, plotted over time.</p>
          </div>
          <ConversionTrendCharts cohorts={cohorts} loading={cohortsLoading} />
        </section>
      </div>
    </SectionShell>
  )
}
