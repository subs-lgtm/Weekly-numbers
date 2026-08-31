'use client'

import { MetricBadge } from './MetricBadge'
import { MethodologyTooltip } from './MethodologyTooltip'
import type { Cohort } from './CohortFunnelTable'

export type ProjectionCohort = Cohort & {
  workingMqls: number
  activeSqls: number
  projection: {
    projectedAdditionalSql: number
    projectedAdditionalOpp: number
    projectedTotalSql: number
    projectedTotalOpp: number
  } | null
}

export type ProjectionBaseline = {
  mqlToSqlPct: number | null
  sqlToOppPct: number | null
  matureCohortsUsed: string[]
}

export function PredictiveFunnelTable({
  cohorts, baseline, loading,
}: {
  cohorts: ProjectionCohort[]
  baseline: ProjectionBaseline | null
  loading: boolean
}) {
  const projectable = cohorts.filter(c => c.projection !== null)
  const total = projectable.reduce((acc, c) => ({
    workingMqls: acc.workingMqls + c.workingMqls,
    activeSqls: acc.activeSqls + c.activeSqls,
    addSql: acc.addSql + (c.projection?.projectedAdditionalSql || 0),
    addOpp: acc.addOpp + (c.projection?.projectedAdditionalOpp || 0),
    totalSql: acc.totalSql + (c.projection?.projectedTotalSql || 0),
    totalOpp: acc.totalOpp + (c.projection?.projectedTotalOpp || 0),
  }), { workingMqls: 0, activeSqls: 0, addSql: 0, addOpp: 0, totalSql: 0, totalOpp: 0 })

  return (
    <div className="card overflow-x-auto">
      <div className="card-head">
        <span className="card-title">Predictive Funnel — Still-Working Cohorts</span>
        <MetricBadge kind="cohort" />
      </div>
      {loading ? (
        <p className="text-[13px] text-[#7A6A60]">Loading…</p>
      ) : projectable.length === 0 ? (
        <p className="text-[13px] text-[#7A6A60]">Not enough older cohorts yet to establish a baseline conversion rate.</p>
      ) : (
        <>
          {/* Fully visible formula + rates — no hover needed, so this reads on a screen-share. */}
          <div className="mb-4 rounded-[12px] border border-[#D4CBC0] bg-[#F9F5F1] px-4 py-3">
            <p className="text-[12px] font-[700] text-[#2A1F1A] mb-1.5">How these numbers are calculated</p>
            <p className="text-[12px] text-[#4A3F38] leading-relaxed">
              Baseline conversion rates, from {baseline?.matureCohortsUsed?.length || 0} older, already-resolved cohort(s)
              {baseline?.matureCohortsUsed?.length ? ` (${baseline.matureCohortsUsed.join(', ')})` : ''}:
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1.5 mb-2">
              <span className="text-[13px]"><span className="font-[700] text-[#4A7C7C]">{baseline?.mqlToSqlPct != null ? `${baseline.mqlToSqlPct.toFixed(1)}%` : '—'}</span> <span className="text-[#7A6A60]">MQL → SQL</span></span>
              <span className="text-[13px]"><span className="font-[700] text-[#C96A5A]">{baseline?.sqlToOppPct != null ? `${baseline.sqlToOppPct.toFixed(1)}%` : '—'}</span> <span className="text-[#7A6A60]">SQL → Opportunity</span></span>
            </div>
            <p className="text-[12px] text-[#4A3F38] leading-relaxed font-mono">
              Projected +SQL = Working MQLs × {baseline?.mqlToSqlPct?.toFixed(1) ?? '—'}%<br />
              Projected +Opp = Active SQLs × {baseline?.sqlToOppPct?.toFixed(1) ?? '—'}%<br />
              Total SQLs = (current SQL + Opportunity contacts) + Projected +SQL<br />
              Total Opps = current Opportunity contacts + Projected +Opp
            </p>
            <p className="text-[11px] text-[#7A6A60] mt-2">Rates are computed against everyone who EVER reached a stage (not just contacts still stuck there) — e.g. SQL→Opportunity divides by (SQL + Opportunity), never SQL alone, since dividing by the stuck-only subset overstates the true rate.</p>
          </div>
          <table className="w-full text-[13px] border-collapse min-w-[680px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[.05em] text-[#7A6A60] border-b border-[#D4CBC0]">
                <th className="py-2 pr-2 font-[600]">Cohort</th>
                <th className="py-2 pr-2 font-[600] text-right">Working<br />MQLs</th>
                <th className="py-2 pr-2 font-[600] text-right">Active<br />SQLs</th>
                <th className="py-2 pr-2 font-[600] text-right">+SQL</th>
                <th className="py-2 pr-2 font-[600] text-right">+Opp</th>
                <th className="py-2 pr-2 font-[600] text-right">Total<br />SQLs</th>
                <th className="py-2 font-[600] text-right bg-[#F3E6CC] px-2 rounded-t-[6px]">Total<br />Opps</th>
              </tr>
            </thead>
            <tbody>
              {projectable.map(c => (
                <tr key={c.period} className="border-b border-[#EEE7DC] last:border-0">
                  <td className="py-2.5 pr-2 font-[600] text-[#2A1F1A]">{c.label}</td>
                  <td className="py-2.5 pr-2 text-right">{c.workingMqls.toLocaleString()}</td>
                  <td className="py-2.5 pr-2 text-right">{c.activeSqls.toLocaleString()}</td>
                  <td className="py-2.5 pr-2 text-right text-[#4A7C7C]">
                    +{c.projection!.projectedAdditionalSql.toLocaleString()}
                    <div className="text-[10px] text-[#7A6A60] font-[400]">{c.workingMqls}×{baseline?.mqlToSqlPct?.toFixed(0) ?? '—'}%</div>
                  </td>
                  <td className="py-2.5 pr-2 text-right text-[#C96A5A]">
                    +{c.projection!.projectedAdditionalOpp.toLocaleString()}
                    <div className="text-[10px] text-[#7A6A60] font-[400]">{c.activeSqls}×{baseline?.sqlToOppPct?.toFixed(0) ?? '—'}%</div>
                  </td>
                  <td className="py-2.5 pr-2 text-right font-[600]">{c.projection!.projectedTotalSql.toLocaleString()}</td>
                  <td className="py-2.5 text-right font-[700] bg-[#F3E6CC]/50 px-2">{c.projection!.projectedTotalOpp.toLocaleString()}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-[#D4CBC0] font-[700] text-[#2A1F1A]">
                <td className="py-2.5 pr-2">Total</td>
                <td className="py-2.5 pr-2 text-right">{total.workingMqls.toLocaleString()}</td>
                <td className="py-2.5 pr-2 text-right">{total.activeSqls.toLocaleString()}</td>
                <td className="py-2.5 pr-2 text-right text-[#4A7C7C]">+{total.addSql.toLocaleString()}</td>
                <td className="py-2.5 pr-2 text-right text-[#C96A5A]">+{total.addOpp.toLocaleString()}</td>
                <td className="py-2.5 pr-2 text-right">{total.totalSql.toLocaleString()}</td>
                <td className="py-2.5 text-right bg-[#F3E6CC] px-2 rounded-b-[6px]">{total.totalOpp.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-[11px] text-[#7A6A60] mt-3">Shown for the trailing 3 months — the baseline rate comes only from cohorts older than this window, so a cohort is never used to project itself. This is an estimate based on historical rates, not a guarantee.</p>
        </>
      )}
    </div>
  )
}
