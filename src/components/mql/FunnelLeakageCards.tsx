'use client'

type LifecycleFunnel = { total: number; mql_plus: number; sql_plus: number; opportunity_plus: number; customer: number }
type StatusFunnel = { total: number; working_plus: number; demo_booked_plus: number; demo_completed_plus: number; associated_with_deal: number }

function LeakageGrid({ stages }: { stages: { label: string; lost: number; dropoffPct: number }[] }) {
  const worstIdx = stages.reduce((worst, s, i) => (s.dropoffPct > stages[worst].dropoffPct ? i : worst), 0)

  return (
    <div className="leak-grid">
      {stages.map((stage, i) => {
        const isWorst = i === worstIdx && stage.dropoffPct > 0
        return (
          <div key={stage.label} className={isWorst ? 'leak-card worst' : 'leak-card'}>
            {isWorst && <span className="leak-badge">Biggest bottleneck</span>}
            <div className="leak-stages">{stage.label}</div>
            <div className="leak-lost">{stage.lost.toLocaleString()}<small> lost</small></div>
            <div className="leak-drop">{stage.dropoffPct}% drop-off</div>
          </div>
        )
      })}
    </div>
  )
}

export function LifecycleStageLeakage({ funnel }: { funnel: LifecycleFunnel }) {
  const pairs = [
    { label: 'Total → MQL+', from: funnel.total, to: funnel.mql_plus },
    { label: 'MQL+ → SQL+', from: funnel.mql_plus, to: funnel.sql_plus },
    { label: 'SQL+ → Opportunity+', from: funnel.sql_plus, to: funnel.opportunity_plus },
    { label: 'Opportunity+ → Customer', from: funnel.opportunity_plus, to: funnel.customer },
  ]
  const stages = pairs.map(p => ({
    label: p.label,
    lost: Math.max(p.from - p.to, 0),
    dropoffPct: p.from > 0 ? Math.round((Math.max(p.from - p.to, 0) / p.from) * 100) : 0,
  }))

  return (
    <div>
      <div className="section-label">Funnel Leakage — Lifecycle Stage</div>
      <div className="section-sub">Based on HubSpot <code style={{ fontSize: 10.5 }}>lifecyclestage</code> property only — where contacts are lost between lifecycle stages</div>
      <LeakageGrid stages={stages} />
    </div>
  )
}

export function LeadStatusLeakage({ funnel }: { funnel: StatusFunnel }) {
  const pairs = [
    { label: 'Total → Working+', from: funnel.total, to: funnel.working_plus },
    { label: 'Working+ → Demo Booked+', from: funnel.working_plus, to: funnel.demo_booked_plus },
    { label: 'Demo Booked+ → Demo Completed+', from: funnel.demo_booked_plus, to: funnel.demo_completed_plus },
    { label: 'Demo Completed+ → Deal Associated', from: funnel.demo_completed_plus, to: funnel.associated_with_deal },
  ]
  const stages = pairs.map(p => ({
    label: p.label,
    lost: Math.max(p.from - p.to, 0),
    dropoffPct: p.from > 0 ? Math.round((Math.max(p.from - p.to, 0) / p.from) * 100) : 0,
  }))

  return (
    <div>
      <div className="section-label">Funnel Leakage — Lead Status</div>
      <div className="section-sub">Based on HubSpot <code style={{ fontSize: 10.5 }}>hs_lead_status</code> property only — where contacts are lost between SDR working stages</div>
      <LeakageGrid stages={stages} />
    </div>
  )
}
