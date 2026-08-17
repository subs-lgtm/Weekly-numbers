'use client'

type LeadContact = { id: string; createdate: string | null; lifecycleStage: string }

type Props = {
  contactsByPriority: { high: LeadContact[]; medium: LeadContact[]; low: LeadContact[]; unknown: LeadContact[] }
}

const BUCKETS = [
  { label: '0–1 Days', min: 0, max: 1, cls: 'safe', color: '#3E7A55' },
  { label: '2–3 Days', min: 2, max: 3, cls: 'safe', color: '#7FA98C' },
  { label: '4–7 Days', min: 4, max: 7, cls: 'warn', color: '#B9822E' },
  { label: '8–14 Days', min: 8, max: 14, cls: 'risk', color: '#D9856C' },
  { label: '15+ Days', min: 15, max: Infinity, cls: 'risk', color: '#BE4A3C' },
]

/** Matches reference HTML's "MQL Aging" section — .aging-grid/.aging-card structure. */
export function MQLAgingBuckets({ contactsByPriority }: Props) {
  // Only count leads that haven't reached Customer — "still open" MQLs
  const openContacts = [
    ...contactsByPriority.high, ...contactsByPriority.medium,
    ...contactsByPriority.low, ...contactsByPriority.unknown,
  ].filter(c => c.lifecycleStage !== 'customer' && c.createdate)

  const now = Date.now()
  const daysOpenList = openContacts.map(c => Math.floor((now - new Date(c.createdate!).getTime()) / 86_400_000))

  const counts = BUCKETS.map(b => daysOpenList.filter(d => d >= b.min && d <= b.max).length)
  const total = daysOpenList.length || 1
  const riskCount = counts[3] + counts[4]
  const riskPct = Math.round((riskCount / total) * 100)

  return (
    <div>
      <div className="aging-grid">
        {BUCKETS.map((b, i) => (
          <div key={b.label} className={`aging-card ${b.cls}`}>
            <div className="aging-bucket">{b.label}</div>
            <div className="aging-count">{counts[i]}</div>
            <div className="aging-pct">{total > 0 ? Math.round((counts[i] / total) * 100) : 0}% of MQLs</div>
          </div>
        ))}
      </div>
      <div className="card mt" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', height: 22, borderRadius: 8, overflow: 'hidden' }}>
          {BUCKETS.map((b, i) => (
            <div key={b.label} style={{ width: `${total > 0 ? (counts[i] / total) * 100 : 0}%`, background: b.color }} />
          ))}
        </div>
        <div className="card-note mt" style={{ marginTop: 10 }}>
          {riskCount} MQL{riskCount !== 1 ? 's' : ''} ({riskPct}%) {riskCount === 1 ? 'is' : 'are'} in the 8+ day risk zone and approaching SLA breach.
        </div>
      </div>
    </div>
  )
}
