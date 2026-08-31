'use client'

import { MetricBadge } from './MetricBadge'
import { MethodologyTooltip } from './MethodologyTooltip'

export type PriorityMonthRow = {
  period: string
  label: string
  high: number
  medium: number
  low: number
  unknown: number
}

const fmtPct = (n: number, total: number) => total > 0 ? `${Math.round((n / total) * 100)}%` : '—'

export function PriorityMixTable({ rows, loading }: { rows: PriorityMonthRow[]; loading: boolean }) {
  const total = rows.reduce((acc, r) => ({
    high: acc.high + r.high,
    medium: acc.medium + r.medium,
    low: acc.low + r.low,
    unknown: acc.unknown + r.unknown,
  }), { high: 0, medium: 0, low: 0, unknown: 0 })
  const grandTotal = total.high + total.medium + total.low + total.unknown

  return (
    <div className="card overflow-x-auto">
      <div className="card-head">
        <span className="card-title">Lead Priority Mix — Last 3 Months</span>
        <MetricBadge kind="flow" />
      </div>
      <p className="card-note mb-3">
        <MethodologyTooltip text="Same MQL cohort as the rest of this dashboard — Book a Demo contacts by Create Date — split by Lyzr Lead Score Category (High/Medium/Low). Excludes @lyzr.ai internal contacts.">
          How to read this
        </MethodologyTooltip>
        {' '}— of each month's MQL cohort, how many scored High/Medium/Low priority.
      </p>
      {loading ? (
        <p className="text-[13px] text-[#7A6A60]">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-[#7A6A60]">No data for this window.</p>
      ) : (
        <table className="w-full text-[13px] border-collapse min-w-[560px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[.05em] text-[#7A6A60] border-b border-[#D4CBC0]">
              <th className="py-2 pr-2 font-[600]">Month</th>
              <th className="py-2 pr-2 font-[600] text-right">High</th>
              <th className="py-2 pr-2 font-[600] text-right">Medium</th>
              <th className="py-2 pr-2 font-[600] text-right">Low</th>
              {total.unknown > 0 && <th className="py-2 pr-2 font-[600] text-right">Unscored</th>}
              <th className="py-2 font-[600] text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const rowTotal = r.high + r.medium + r.low + r.unknown
              return (
                <tr key={r.period} className="border-b border-[#EEE7DC] last:border-0">
                  <td className="py-2.5 pr-2 font-[600] text-[#2A1F1A]">{r.label}</td>
                  <td className="py-2.5 pr-2 text-right">
                    <span className="text-[#BE4A3C] font-[600]">{r.high}</span>
                    <span className="text-[#7A6A60] text-[11px]"> ({fmtPct(r.high, rowTotal)})</span>
                  </td>
                  <td className="py-2.5 pr-2 text-right">
                    <span className="text-[#B9822E] font-[600]">{r.medium}</span>
                    <span className="text-[#7A6A60] text-[11px]"> ({fmtPct(r.medium, rowTotal)})</span>
                  </td>
                  <td className="py-2.5 pr-2 text-right">
                    <span className="text-[#3D5A8C] font-[600]">{r.low}</span>
                    <span className="text-[#7A6A60] text-[11px]"> ({fmtPct(r.low, rowTotal)})</span>
                  </td>
                  {total.unknown > 0 && (
                    <td className="py-2.5 pr-2 text-right text-[#7A6A60]">{r.unknown}</td>
                  )}
                  <td className="py-2.5 text-right font-[700]">{rowTotal.toLocaleString()}</td>
                </tr>
              )
            })}
            <tr className="border-t-2 border-[#D4CBC0] font-[700] text-[#2A1F1A]">
              <td className="py-2.5 pr-2">Total</td>
              <td className="py-2.5 pr-2 text-right">{total.high} <span className="text-[#7A6A60] text-[11px] font-[400]">({fmtPct(total.high, grandTotal)})</span></td>
              <td className="py-2.5 pr-2 text-right">{total.medium} <span className="text-[#7A6A60] text-[11px] font-[400]">({fmtPct(total.medium, grandTotal)})</span></td>
              <td className="py-2.5 pr-2 text-right">{total.low} <span className="text-[#7A6A60] text-[11px] font-[400]">({fmtPct(total.low, grandTotal)})</span></td>
              {total.unknown > 0 && <td className="py-2.5 pr-2 text-right">{total.unknown}</td>}
              <td className="py-2.5 text-right">{grandTotal.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}
