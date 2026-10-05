'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { MetricBadge } from './MetricBadge'
import { MethodologyTooltip } from './MethodologyTooltip'

export type Cohort = {
  period: string
  label: string
  cohortStartDate: string
  ageDays: number
  maturity: string
  // One fixed population per row — contacts created that month via Book a Demo (createdate,
  // permanent). sqlCount/opportunityCount/customersWon are that SAME group's CURRENT
  // lifecyclestage, exact match — a live snapshot that updates as they progress.
  mqlCount: number
  sqlCount: number
  opportunityCount: number
  customersWon: number
  opportunityBySource?: Record<string, number>
  opportunityByChannel?: Record<string, number>
  mqlToSql: { pct: number | null }
  sqlToOpportunity: { pct: number | null }
  opportunityToCustomer: { pct: number | null }
  // Separate, independently-anchored cohort (Opportunities entered this month, any source) —
  // used by the Opportunity Cohort Outcome chart, not by this table.
  opportunityCohort: { count: number; won: number; lost: number; stillOpen: number; wonPct: number | null; lostPct: number | null; stillOpenPct: number | null }
}

const MATURITY_STYLE: Record<string, { bg: string; color: string }> = {
  'Too Early to Judge': { bg: '#EEE7DC', color: '#8B8074' },
  'Developing':         { bg: '#F3E6CC', color: '#B9822E' },
  'Partially Mature':   { bg: '#DEE5F0', color: '#3D5A8C' },
  'Mature':             { bg: '#DFF0E6', color: '#3E7A55' },
}

function DistBlock({ title, dist }: { title: string; dist?: Record<string, number> }) {
  const entries = Object.entries(dist || {}).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return null
  return (
    <span className="block mb-1.5">
      <span className="block text-[10px] uppercase tracking-wider text-[#B9AFA6] mb-0.5">{title}</span>
      {entries.map(([k, v]) => (
        <span key={k} className="flex justify-between gap-3"><span>{k}</span><span className="font-[600]">{v}</span></span>
      ))}
    </span>
  )
}

// Rendered through a portal with fixed positioning: the table sits inside an overflow-x-auto
// wrapper, which clips any absolutely-positioned tooltip that pokes out above/below it (that is
// what cut off the first rows' tooltips). Flips above the cell when there isn't room below.
function OppCell({ label, count, bySource, byChannel, note, deals }: {
  label: string; count: number; bySource?: Record<string, number>; byChannel?: Record<string, number>; note: string
  deals?: Array<{ name: string; source: string; channel: string }>
}) {
  const [tip, setTip] = useState<{ left: number; top?: number; bottom?: number } | null>(null)
  const show = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (count <= 0) return
    const r = e.currentTarget.getBoundingClientRect()
    const W = 280
    const left = Math.max(8, Math.min(r.right - W, window.innerWidth - W - 8))
    const roomBelow = window.innerHeight - r.bottom
    setTip(roomBelow >= 300 ? { left, top: r.bottom + 8 } : { left, bottom: window.innerHeight - r.top + 8 })
  }
  return (
    <>
      <span
        className={count > 0 ? 'cursor-help border-b border-dashed border-[#7A6A60]/40' : ''}
        onMouseEnter={show}
        onMouseLeave={() => setTip(null)}
      >
        {count.toLocaleString()}
      </span>
      {tip && typeof document !== 'undefined' && createPortal(
        <div
          style={{ position: 'fixed', left: tip.left, top: tip.top, bottom: tip.bottom, width: 280, zIndex: 9999 }}
          className="pointer-events-none bg-[#2A1F1A] text-white text-[12px] p-3.5 rounded-lg shadow-xl border border-[#5C4E46] leading-relaxed text-left font-[400]"
        >
          <div className="text-[13px] font-[600] mb-2">{label} — {count} {count === 1 ? 'opportunity' : 'opportunities'}</div>
          <DistBlock title="By deal source" dist={bySource} />
          <DistBlock title="By contact channel" dist={byChannel} />
          {deals && deals.length > 0 && (
            <span className="block mb-1.5">
              <span className="block text-[10px] uppercase tracking-wider text-[#B9AFA6] mb-0.5">Deals</span>
              {deals.map((d, i) => (
                <span key={i} className="block text-[11px] leading-snug mb-0.5">{d.name} <span className="text-[#B9AFA6]">· {d.source} · {d.channel}</span></span>
              ))}
            </span>
          )}
          <div className="mt-2 text-[10px] text-[#B9AFA6]">{note}</div>
        </div>,
        document.body,
      )}
    </>
  )
}

const IMMATURE = new Set(['Too Early to Judge', 'Developing'])

function pctCell(pct: number | null, dim: boolean) {
  const text = pct === null ? '—' : `${pct.toFixed(0)}%`
  return (
    <span className={dim ? 'opacity-50' : ''} title={dim ? 'Cohort is still immature — this rate is likely to shift as more records progress. Avoid comparing directly against mature cohorts.' : undefined}>
      {text}{dim && pct !== null ? '*' : ''}
    </span>
  )
}

export function CohortFunnelTable({ cohorts, loading }: { cohorts: Cohort[]; loading: boolean }) {
  return (
    <div className="card overflow-x-auto">
      <div className="card-head">
        <span className="card-title">Cohort Funnel Table</span>
        <MetricBadge kind="cohort" />
      </div>
      {loading ? (
        <p className="text-[13px] text-[#7A6A60]">Loading…</p>
      ) : (
        <table className="w-full text-[13px] border-collapse min-w-[860px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[.05em] text-[#7A6A60] border-b border-[#D4CBC0]">
              <th className="py-2 pr-3 font-[600]">Cohort Period</th>
              <th className="py-2 pr-3 font-[600] text-right">MQLs</th>
              <th className="py-2 pr-3 font-[600] text-right">SQLs</th>
              <th className="py-2 pr-3 font-[600] text-right">Opportunities</th>
              <th className="py-2 pr-3 font-[600] text-right">Customers Won</th>
              <th className="py-2 pr-3 font-[600] text-right">
                <MethodologyTooltip text="Of this row's fixed MQL cohort (created via Book a Demo that month), the % CURRENTLY sitting at the SQL lifecycle stage right now.">MQL→SQL %</MethodologyTooltip>
              </th>
              <th className="py-2 pr-3 font-[600] text-right">
                <MethodologyTooltip text="Of this same fixed cohort, the % CURRENTLY at the Opportunity lifecycle stage right now, relative to the % currently at SQL.">SQL→Opp %</MethodologyTooltip>
              </th>
              <th className="py-2 pr-3 font-[600] text-right">
                <MethodologyTooltip text="Of this same fixed cohort, the % CURRENTLY marked Customer right now, relative to the % currently at Opportunity. The MQL cohort count (by createdate) is the fixed denominator the whole row is measured against.">Opp→Customer %</MethodologyTooltip>
              </th>
              <th className="py-2 pr-3 font-[600] text-right">Cohort Age</th>
              <th className="py-2 font-[600]">Maturity</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map(c => {
              const dim = IMMATURE.has(c.maturity)
              const ms = MATURITY_STYLE[c.maturity] || MATURITY_STYLE['Too Early to Judge']
              return (
                <tr key={c.period} className="border-b border-[#EEE7DC] last:border-0">
                  <td className="py-2.5 pr-3 font-[600] text-[#2A1F1A]">{c.label}</td>
                  <td className="py-2.5 pr-3 text-right">{c.mqlCount.toLocaleString()}</td>
                  <td className="py-2.5 pr-3 text-right">{c.sqlCount.toLocaleString()}</td>
                  <td className="py-2.5 pr-3 text-right"><OppCell label={c.label} count={c.opportunityCount} bySource={c.opportunityBySource} byChannel={c.opportunityByChannel} note="Contacts created this month (Book a Demo) that have a marketing-sourced Studio deal. Outbound, Referral, Repeat Customer and blank source excluded." /></td>
                  <td className="py-2.5 pr-3 text-right">{c.customersWon.toLocaleString()}</td>
                  <td className="py-2.5 pr-3 text-right">{pctCell(c.mqlToSql.pct, dim)}</td>
                  <td className="py-2.5 pr-3 text-right">{pctCell(c.sqlToOpportunity.pct, dim)}</td>
                  <td className="py-2.5 pr-3 text-right">{pctCell(c.opportunityToCustomer.pct, dim)}</td>
                  <td className="py-2.5 pr-3 text-right text-[#7A6A60]">{c.ageDays}d</td>
                  <td className="py-2.5">
                    <span
                      className="inline-flex px-[9px] py-[2.5px] rounded-[20px] text-[11px] font-[700]"
                      style={{ background: ms.bg, color: ms.color }}
                    >
                      {c.maturity}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <p className="text-[11px] text-[#7A6A60] mt-3">Each row is a fixed group of contacts — the ones created that month via Book a Demo (matches the existing MQL dashboard exactly). SQLs/Opportunities/Customers Won show how many of that SAME group are CURRENTLY at each stage right now — the group size never changes, but this breakdown updates live as they progress. This is the same number you'd get filtering HubSpot by Create Date + Lead Form Type + Lifecycle Stage directly.</p>
      <p className="text-[11px] text-[#7A6A60] mt-1">* Dimmed rates belong to immature cohorts (0–60 days old) — still developing, don’t compare directly against mature cohorts.</p>
    </div>
  )
}
