'use client'

import { useEffect, useState } from 'react'

type Influence = {
  currency: string
  dateFrom: string
  dateTo: string
  influencedPipeline: number
  influencedClosedWon: number
  influencedClosedWonDeals: number
  nonInfluencedPipeline: number
  dealsTotal: number
  dealsInfluenced: number
  dealsNonInfluenced: number
  avgDealSize: number
  influencedCloseRate: number
  influencedSalesCycleDays: number
  attributionRatePct: number
  upliftPct: number
  highIntentPipeline: number
  highIntentDeals: number
  highIntentClosedWon: number
  trend: { period: string; value: number }[]
  dataQuality?: { missingCurrencyDeals: number; outliersHidden: number }
  attributionWindowDays?: { influenceAnalyzer: number; dealCalculation: number }
  buyerIntentSubscribed?: boolean
  snapshotAt?: string
  lastSyncedAtG2?: string
}

const money = (n: number) =>
  n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : n >= 1e3 ? `$${Math.round(n / 1e3).toLocaleString()}K` : `$${n}`

const monthLabel = (p: string) => new Date(`${p}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[10px] bg-[#F2EDE8] px-3 py-2">
      <div className="text-[18px] font-[700] tabular-nums text-[#2A1F1A]">{value}</div>
      <div className="text-[11px] font-[600] text-[#7A6A60]">{label}</div>
      {sub && <div className="text-[10.5px] text-[#7A6A60]">{sub}</div>}
    </div>
  )
}

/** "G2 Influence": pipeline and revenue G2 touched, from G2 Performance Analytics (HubSpot deals matched to G2 activity). */
export function G2Influence() {
  const [data, setData] = useState<Influence | null>(null)
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    let alive = true
    fetch('/api/g2-influence')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => { if (alive) { setData(j.data || null); setState('ok') } })
      .catch(() => { if (alive) setState('error') })
    return () => { alive = false }
  }, [])

  if (state === 'loading') return <div className="card"><p className="text-[12.5px] text-[#7A6A60]">Loading G2 influence…</p></div>
  if (state === 'error') return <div className="card"><p className="text-[12.5px] text-[#7A6A60]">Could not load the G2 influence snapshot.</p></div>
  if (!data) return <div className="card"><div className="card-head"><span className="card-title">G2 Influence</span></div><p className="text-[12.5px] italic text-[#D4CBC0]">No G2 influence snapshot yet.</p></div>

  const max = Math.max(...data.trend.map((t) => t.value), 1)
  const lastIdx = data.trend.length - 1
  const sharePct = Math.round((data.dealsInfluenced / data.dealsTotal) * 100)

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">G2 Influence</span>
        <span className="text-[11px] text-[#7A6A60]">
          {data.dateFrom} to {data.dateTo} · G2 synced {data.lastSyncedAtG2?.slice(0, 10)}
        </span>
      </div>
      <p className="card-note mb-3">
        HubSpot deals that G2 Performance Analytics matched to G2 activity (G2&apos;s own attribution, {data.attributionWindowDays?.influenceAnalyzer ?? 180}-day window). Figures are G2-reported, not recomputed from HubSpot here.
      </p>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="G2-influenced pipeline" value={money(data.influencedPipeline)} sub={`${data.attributionRatePct.toFixed(0)}% of all pipeline`} />
        <Tile label="G2-influenced closed-won" value={money(data.influencedClosedWon)} sub={`${data.influencedClosedWonDeals} deals`} />
        <Tile label="Deals G2 influenced" value={`${data.dealsInfluenced} / ${data.dealsTotal}`} sub={`${sharePct}% of deals`} />
        <Tile label="Influenced close rate" value={`${Math.round(data.influencedCloseRate * 100)}%`} sub={`${data.influencedSalesCycleDays}-day sales cycle`} />
        <Tile label="Not influenced pipeline" value={money(data.nonInfluencedPipeline)} sub={`${data.dealsNonInfluenced} deals`} />
        <Tile label="High-intent pipeline" value={money(data.highIntentPipeline)} sub={`${data.highIntentDeals} deals · ${money(data.highIntentClosedWon)} won`} />
        <Tile label="Avg deal size" value={money(data.avgDealSize)} />
        <Tile label="Uplift (G2-reported)" value={`${data.upliftPct.toFixed(0)}%`} />
      </div>

      <div className="mt-4">
        <p className="mb-2 text-[11.5px] font-[700] uppercase tracking-wide text-[#7A6A60]">G2-influenced pipeline by month</p>
        <div className="flex items-end gap-1.5" style={{ height: 120 }}>
          {data.trend.map((t, i) => (
            <div key={t.period} className="group relative flex flex-1 flex-col items-center justify-end" style={{ height: '100%' }} title={`${t.period}: ${money(t.value)}`}>
              <span className="mb-0.5 text-[10px] font-[600] tabular-nums text-[#7A6A60]">{money(t.value).replace('$', '')}</span>
              <div className="w-full rounded-t-md" style={{ height: `${Math.max((t.value / max) * 72, 2)}%`, background: i === lastIdx ? '#B9AFA6' : '#4E8A6B' }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1.5">
          {data.trend.map((t, i) => (
            <span key={t.period} className="flex-1 text-center text-[10px] text-[#7A6A60]">{monthLabel(t.period)}{i === lastIdx ? '*' : ''}</span>
          ))}
        </div>
        <p className="mt-1 text-[10.5px] text-[#7A6A60]">* Month to date (grey). Values in {data.currency}, in millions; K = thousands.</p>
      </div>

      {(data.dataQuality || data.buyerIntentSubscribed === false) && (
        <p className="mt-3 text-[10.5px] leading-snug text-[#7A6A60]">
          {data.dataQuality && `G2 notes ${data.dataQuality.missingCurrencyDeals} deals with no currency set and ${data.dataQuality.outliersHidden} hidden outlier, so totals may be slightly understated. `}
          {data.buyerIntentSubscribed === false && 'Buyer Intent signals and G2-created pipeline need the G2 Buyer Intent subscription, which this account does not have.'}
        </p>
      )}
    </div>
  )
}
