'use client'

import { useG2BuyerIntent, type NamedCount } from '@/hooks/useG2BuyerIntent'

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 rounded-[10px] bg-[#F2EDE8] px-3 py-2">
      <div className="text-[18px] font-[700] tabular-nums text-[#2A1F1A]">{value.toLocaleString()}</div>
      <div className="text-[11px] font-[600] text-[#7A6A60]">{label}</div>
    </div>
  )
}

function CountList({ title, rows }: { title: string; rows: NamedCount[] }) {
  return (
    <div>
      <p className="mb-1 text-[11.5px] font-[700] uppercase tracking-wide text-[#7A6A60]">{title}</p>
      {rows.map((r) => (
        <div key={r.name} className="flex justify-between py-0.5 text-[12.5px] text-[#2A1F1A]">
          <span className="truncate pr-2">{r.name}</span>
          <span className="font-[700] tabular-nums">{r.count}</span>
        </div>
      ))}
    </div>
  )
}

export function G2BuyerIntent({ weekStart }: { weekStart: string }) {
  const { data, loading } = useG2BuyerIntent(weekStart)

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Buyer Intent</span>
        {data?.snapshotAt && (
          <span className="text-[11px] text-[#7A6A60]">Snapshot {data.snapshotAt.slice(0, 10)}</span>
        )}
      </div>
      {loading ? (
        <p className="text-[12.5px] text-[#7A6A60]">Loading…</p>
      ) : !data ? (
        <p className="text-[12.5px] italic text-[#D4CBC0]">No buyer intent snapshot for this week.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Stat label="Signals (7d)" value={data.signalsLast7Days} />
            <Stat label="Started on G2" value={data.startedFromG2Count} />
            <Stat label="Started on site" value={data.startedFromSiteCount} />
            <Stat label="All-time" value={data.totalSignalsAllTime} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <CountList title="Top companies" rows={data.topOrganizations} />
            <CountList title="Top countries" rows={data.topCountries} />
          </div>
          <div>
            <p className="mb-1 text-[11.5px] font-[700] uppercase tracking-wide text-[#7A6A60]">Recent high-intent journeys</p>
            {data.recentHighIntent.map((j, i) => (
              <div key={i} className="py-1 text-[12.5px] text-[#2A1F1A]">
                <span className="font-[600]">{j.organization}</span>
                <span className="text-[#7A6A60]"> · {j.country || '—'} · {j.from} → {j.to} · {j.timeBetween}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
