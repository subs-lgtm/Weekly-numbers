'use client'

import { MetricBadge } from './MetricBadge'
import { MethodologyTooltip } from './MethodologyTooltip'

type CountMap = Record<string, number>
type ValueMap = Record<string, { count: number; value: number }>
export type BreakdownDeal = {
  contactId: string; dealId: string; name: string; amount: number; stage: string; group: string
  channel: string; dealSource: string; daysInStage: number; stuck: boolean
}
export type BreakdownMonth = {
  period: string
  label: string
  mqls: number
  sql: { total: number; byChannel: CountMap; byOriginalSource: CountMap }
  opportunities: {
    count: number; totalValue: number; bySource: ValueMap
    byStage: { stage: string; group: string; count: number; value: number }[]
    groups: ValueMap; stuck: { count: number; value: number }; deals: BreakdownDeal[]
  }
  useCases: { sql: CountMap; opportunities: CountMap }
}
export type BreakdownTheme = { key: string; label: string; color: string }
export type BreakdownResponse = { months: BreakdownMonth[]; themes: BreakdownTheme[] }

const money = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `$${Math.round(n / 1000).toLocaleString()}K` : `$${Math.round(n).toLocaleString()}`
const th = 'py-2 pr-2 font-[600]'
const head = 'text-left text-[11px] uppercase tracking-[.05em] text-[#7A6A60] border-b border-[#D4CBC0]'

const GROUP_ORDER = ['top', 'middle', 'bottom', 'won', 'lost', 'stalled']
const GROUP_LABEL: Record<string, string> = {
  top: 'Top of funnel', middle: 'Middle of funnel', bottom: 'Bottom of funnel (Negotiation / Legal)',
  won: 'Closed Won', lost: 'Closed Lost / Dropped', stalled: 'Stalled',
}
const GROUP_COLOR: Record<string, string> = {
  top: '#B9822E', middle: '#3D5A8C', bottom: '#4E8A6B', won: '#2F7A4F', lost: '#BE4A3C', stalled: '#9A8C82',
}

function keysByTotal(months: BreakdownMonth[], pick: (m: BreakdownMonth) => CountMap) {
  const tot: CountMap = {}
  for (const m of months) for (const [k, v] of Object.entries(pick(m))) tot[k] = (tot[k] || 0) + v
  return Object.keys(tot).sort((a, b) => tot[b] - tot[a])
}

function Shell({ title, note, tip, loading, empty, children }: {
  title: string; note: React.ReactNode; tip: string; loading: boolean; empty: boolean; children: React.ReactNode
}) {
  return (
    <div className="card overflow-x-auto">
      <div className="card-head">
        <span className="card-title">{title}</span>
        <MetricBadge kind="flow" />
      </div>
      <p className="card-note mb-3">
        <MethodologyTooltip text={tip}>How to read this</MethodologyTooltip> {note}
      </p>
      {loading ? <p className="text-[13px] text-[#7A6A60]">Loading… (first load calls HubSpot deal-by-deal and can take a minute)</p>
        : empty ? <p className="text-[13px] text-[#7A6A60]">No data for this window.</p>
        : children}
    </div>
  )
}

function SourceTable({ months, pick, label }: { months: BreakdownMonth[]; pick: (m: BreakdownMonth) => CountMap; label: string }) {
  const keys = keysByTotal(months, pick)
  const totals = months.map(m => m.sql.total)
  const grand = totals.reduce((a, b) => a + b, 0)
  return (
    <table className="w-full text-[13px] border-collapse min-w-[520px] mb-5">
      <thead>
        <tr className={head}>
          <th className={th}>{label}</th>
          {months.map(m => <th key={m.period} className={`${th} text-right`}>{m.label.split(' ')[0]}</th>)}
          <th className="py-2 font-[600] text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {keys.map(k => {
          const vals = months.map(m => pick(m)[k] || 0)
          const sum = vals.reduce((a, b) => a + b, 0)
          return (
            <tr key={k} className="border-b border-[#EEE7DC]">
              <td className="py-2 pr-2 font-[600] text-[#2A1F1A]">{k}</td>
              {vals.map((v, i) => (
                <td key={i} className="py-2 pr-2 text-right">
                  {v || <span className="text-[#B9AFA6]">—</span>}
                  {v > 0 && totals[i] > 0 && <span className="text-[#7A6A60] text-[11px]"> ({Math.round(v / totals[i] * 100)}%)</span>}
                </td>
              ))}
              <td className="py-2 text-right font-[700]">{sum}<span className="text-[#7A6A60] text-[11px] font-[400]"> ({grand ? Math.round(sum / grand * 100) : 0}%)</span></td>
            </tr>
          )
        })}
        <tr className="border-t-2 border-[#D4CBC0] font-[700] text-[#2A1F1A]">
          <td className="py-2 pr-2">Total SQLs</td>
          {totals.map((t, i) => <td key={i} className="py-2 pr-2 text-right">{t}</td>)}
          <td className="py-2 text-right">{grand}</td>
        </tr>
      </tbody>
    </table>
  )
}

export function SQLSourceBreakdown({ data, loading }: { data: BreakdownResponse | null; loading: boolean }) {
  const months = data?.months || []
  return (
    <Shell
      title="SQLs by Source — Last 3 Months" loading={loading} empty={months.length === 0}
      tip="Same cohort as the Cohort Conversion table: Book a Demo contacts created in the month, currently at SQL lifecycle stage. Acquisition channel = paid signals (click IDs / UTMs) first, then lead source category, then original source; contacts with no web attribution (offline / integration-created) are shown as Unattributed rather than guessed. HubSpot original source is the raw first-touch field, shown for tie-back to attribution."
      note="— how each month's SQLs originally entered the funnel."
    >
      <SourceTable months={months} pick={m => m.sql.byChannel} label="Acquisition channel" />
      <SourceTable months={months} pick={m => m.sql.byOriginalSource} label="HubSpot original source" />
    </Shell>
  )
}

export function OpportunityPipelinePanel({ data, loading }: { data: BreakdownResponse | null; loading: boolean }) {
  const months = data?.months || []
  const sources = keysByTotal(months, m => Object.fromEntries(Object.entries(m.opportunities.bySource).map(([k, v]) => [k, v.value])))
  const stuckDeals = months.flatMap(m => m.opportunities.deals.filter(d => d.stuck).map(d => ({ ...d, month: m.label.split(' ')[0] })))
    .sort((a, b) => b.amount - a.amount)
  const totalCount = months.reduce((a, m) => a + m.opportunities.count, 0)
  const totalValue = months.reduce((a, m) => a + m.opportunities.totalValue, 0)

  return (
    <Shell
      title="Opportunity Pipeline & Funnel Stage — Last 3 Months" loading={loading} empty={months.length === 0}
      tip="Opportunity = a Book a Demo contact created in the month who has a marketing-sourced deal (Direct / Inbound / Marketing / Event etc. per the Cohort table) in the Studio Deals pipeline. Value = deal amount (largest deal per contact). Stage = the deal's CURRENT stage. Bottom of funnel = Negotiation / Legal & Contracts. Stuck = still open in a top/middle/stalled stage for more than 30 days."
      note="— is marketing-generated pipeline moving toward revenue?"
    >
      <table className="w-full text-[13px] border-collapse min-w-[560px] mb-5">
        <thead>
          <tr className={head}>
            <th className={th}>Cohort month</th>
            <th className={`${th} text-right`}>Opps</th>
            <th className={`${th} text-right`}>Pipeline value</th>
            <th className={`${th} text-right`}>Bottom of funnel</th>
            <th className={`${th} text-right`}>Closed Won</th>
            <th className={`${th} text-right`}>Closed Lost</th>
            <th className="py-2 font-[600] text-right">Stuck &gt;30d</th>
          </tr>
        </thead>
        <tbody>
          {months.map(m => {
            const g = m.opportunities.groups
            return (
              <tr key={m.period} className="border-b border-[#EEE7DC]">
                <td className="py-2.5 pr-2 font-[600] text-[#2A1F1A]">{m.label}</td>
                <td className="py-2.5 pr-2 text-right font-[600]">{m.opportunities.count}</td>
                <td className="py-2.5 pr-2 text-right font-[600]">{money(m.opportunities.totalValue)}</td>
                <td className="py-2.5 pr-2 text-right" style={{ color: GROUP_COLOR.bottom }}>{g.bottom?.count || 0}{g.bottom ? <span className="text-[11px] text-[#7A6A60]"> · {money(g.bottom.value)}</span> : null}</td>
                <td className="py-2.5 pr-2 text-right" style={{ color: GROUP_COLOR.won }}>{g.won?.count || 0}{g.won ? <span className="text-[11px] text-[#7A6A60]"> · {money(g.won.value)}</span> : null}</td>
                <td className="py-2.5 pr-2 text-right" style={{ color: GROUP_COLOR.lost }}>{g.lost?.count || 0}</td>
                <td className="py-2.5 text-right text-[#BE4A3C] font-[600]">{m.opportunities.stuck.count}{m.opportunities.stuck.count > 0 && <span className="text-[11px] text-[#7A6A60] font-[400]"> · {money(m.opportunities.stuck.value)}</span>}</td>
              </tr>
            )
          })}
          <tr className="border-t-2 border-[#D4CBC0] font-[700] text-[#2A1F1A]">
            <td className="py-2.5 pr-2">Total</td>
            <td className="py-2.5 pr-2 text-right">{totalCount}</td>
            <td className="py-2.5 pr-2 text-right">{money(totalValue)}</td>
            <td colSpan={4} />
          </tr>
        </tbody>
      </table>

      <p className="text-[11px] uppercase tracking-[.05em] text-[#7A6A60] font-[600] mb-1">Pipeline by acquisition source (count · value)</p>
      <table className="w-full text-[13px] border-collapse min-w-[520px] mb-5">
        <thead>
          <tr className={head}>
            <th className={th}>Source</th>
            {months.map(m => <th key={m.period} className={`${th} text-right`}>{m.label.split(' ')[0]}</th>)}
            <th className="py-2 font-[600] text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {sources.map(s => {
            const cells = months.map(m => m.opportunities.bySource[s])
            const c = cells.reduce((a, x) => a + (x?.count || 0), 0)
            const v = cells.reduce((a, x) => a + (x?.value || 0), 0)
            return (
              <tr key={s} className="border-b border-[#EEE7DC]">
                <td className="py-2 pr-2 font-[600] text-[#2A1F1A]">{s}</td>
                {cells.map((x, i) => <td key={i} className="py-2 pr-2 text-right">{x ? <>{x.count} <span className="text-[#7A6A60] text-[11px]">· {money(x.value)}</span></> : <span className="text-[#B9AFA6]">—</span>}</td>)}
                <td className="py-2 text-right font-[700]">{c} <span className="text-[#7A6A60] text-[11px] font-[400]">· {money(v)}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="text-[11px] uppercase tracking-[.05em] text-[#7A6A60] font-[600] mb-1">Current stage (count · value)</p>
      <table className="w-full text-[13px] border-collapse min-w-[520px] mb-5">
        <thead>
          <tr className={head}>
            <th className={th}>Stage</th>
            {months.map(m => <th key={m.period} className={`${th} text-right`}>{m.label.split(' ')[0]}</th>)}
          </tr>
        </thead>
        <tbody>
          {GROUP_ORDER.flatMap(g => {
            const stages = Array.from(new Set(months.flatMap(m => m.opportunities.byStage.filter(s => s.group === g).map(s => s.stage))))
            return stages.map(st => (
              <tr key={st} className="border-b border-[#EEE7DC]">
                <td className="py-2 pr-2">
                  <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: GROUP_COLOR[g] }} />
                  <span className="font-[600] text-[#2A1F1A]">{st}</span>
                  <span className="text-[11px] text-[#7A6A60]"> — {GROUP_LABEL[g]}</span>
                </td>
                {months.map(m => {
                  const x = m.opportunities.byStage.find(s => s.stage === st)
                  return <td key={m.period} className="py-2 pr-2 text-right">{x ? <>{x.count} <span className="text-[#7A6A60] text-[11px]">· {money(x.value)}</span></> : <span className="text-[#B9AFA6]">—</span>}</td>
                })}
              </tr>
            ))
          })}
        </tbody>
      </table>

      <p className="text-[11px] uppercase tracking-[.05em] text-[#7A6A60] font-[600] mb-1">Stuck in top / middle stages (open &gt; 30 days in current stage)</p>
      {stuckDeals.length === 0 ? (
        <p className="text-[13px] text-[#7A6A60]">None — every open opportunity has moved stage in the last 30 days.</p>
      ) : (
        <table className="w-full text-[13px] border-collapse min-w-[560px]">
          <thead>
            <tr className={head}>
              <th className={th}>Deal</th><th className={th}>Cohort</th><th className={th}>Stage</th>
              <th className={th}>Source</th><th className={`${th} text-right`}>Days in stage</th><th className="py-2 font-[600] text-right">Value</th>
            </tr>
          </thead>
          <tbody>
            {stuckDeals.slice(0, 25).map(d => (
              <tr key={d.dealId} className="border-b border-[#EEE7DC] last:border-0">
                <td className="py-2 pr-2 font-[600] text-[#2A1F1A]">{d.name || '(unnamed deal)'}</td>
                <td className="py-2 pr-2 text-[#7A6A60]">{d.month}</td>
                <td className="py-2 pr-2">{d.stage}</td>
                <td className="py-2 pr-2 text-[#7A6A60]">{d.channel}</td>
                <td className="py-2 pr-2 text-right text-[#BE4A3C] font-[600]">{d.daysInStage}</td>
                <td className="py-2 text-right font-[600]">{money(d.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  )
}

export function UseCaseBreakdown({ data, loading }: { data: BreakdownResponse | null; loading: boolean }) {
  const months = data?.months || []
  const themes = data?.themes || []
  const rows = themes
    .map(t => {
      const cells = months.map(m => ({ sql: m.useCases.sql[t.key] || 0, opp: m.useCases.opportunities[t.key] || 0 }))
      return { t, cells, sql: cells.reduce((a, c) => a + c.sql, 0), opp: cells.reduce((a, c) => a + c.opp, 0) }
    })
    .filter(r => r.sql + r.opp > 0)
    // Real use cases first, vendor pitches / no-detail rows last.
    .sort((a, b) => (Number(['pitch', 'none'].includes(a.t.key)) - Number(['pitch', 'none'].includes(b.t.key))) || (b.sql + b.opp) - (a.sql + a.opp))
  const sqlTotals = months.map(m => m.sql.total)
  const oppTotals = months.map(m => m.opportunities.count)

  return (
    <Shell
      title="SQLs & Opportunities by Use Case — Last 3 Months" loading={loading} empty={months.length === 0}
      tip="Each lead's stated need (Book a Demo message / LinkedIn lead-form 'problem' answer) is bucketed by the same keyword themes as the MQL Use Cases table. One theme per lead (most keyword hits wins). 'No details given' = the form carried no usable text (e.g. integration-created or blank answers) — these cannot be attributed to a use case. Opportunities are attributed via the contact that generated them."
      note="— which problems turn into SQLs and pipeline."
    >
      <table className="w-full text-[13px] border-collapse min-w-[560px]">
        <thead>
          <tr className={head}>
            <th className={th} rowSpan={2}>Use case</th>
            {months.map(m => <th key={m.period} colSpan={2} className={`${th} text-center`}>{m.label.split(' ')[0]}</th>)}
            <th colSpan={2} className="py-2 font-[600] text-center">Total</th>
          </tr>
          <tr className={head}>
            {[...months.map(m => m.period), 'total'].flatMap(p => [
              <th key={p + 's'} className="pb-2 pr-2 font-[600] text-right">SQL</th>,
              <th key={p + 'o'} className="pb-2 pr-2 font-[600] text-right">Opp</th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.t.key} className="border-b border-[#EEE7DC]">
              <td className="py-2 pr-2">
                <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ background: r.t.color }} />
                <span className="font-[600] text-[#2A1F1A]">{r.t.label}</span>
              </td>
              {r.cells.flatMap((c, i) => [
                <td key={i + 's'} className="py-2 pr-2 text-right">{c.sql || <span className="text-[#B9AFA6]">—</span>}</td>,
                <td key={i + 'o'} className="py-2 pr-2 text-right">{c.opp || <span className="text-[#B9AFA6]">—</span>}</td>,
              ])}
              <td className="py-2 pr-2 text-right font-[700]">{r.sql}</td>
              <td className="py-2 pr-2 text-right font-[700]">{r.opp}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-[#D4CBC0] font-[700] text-[#2A1F1A]">
            <td className="py-2 pr-2">Total</td>
            {months.flatMap((_, i) => [
              <td key={i + 's'} className="py-2 pr-2 text-right">{sqlTotals[i]}</td>,
              <td key={i + 'o'} className="py-2 pr-2 text-right">{oppTotals[i]}</td>,
            ])}
            <td className="py-2 pr-2 text-right">{sqlTotals.reduce((a, b) => a + b, 0)}</td>
            <td className="py-2 pr-2 text-right">{oppTotals.reduce((a, b) => a + b, 0)}</td>
          </tr>
        </tbody>
      </table>
    </Shell>
  )
}
