'use client'

import { cn } from '@/lib/utils'

type Funnel = {
  mqls: number
  demo_booked: number
  demo_completed: number
  sql: number
  opportunity: number
  customer: number
}

type Props = { funnel: Funnel; monthlyFunnel?: Funnel }

const STAGES: { key: keyof Funnel; label: string; color: string }[] = [
  { key: 'mqls', label: 'Total MQLs', color: '#5B3A34' },
  { key: 'demo_booked', label: 'Demo Booked', color: '#6B4C4C' },
  { key: 'demo_completed', label: 'Demo Completed', color: '#8A6152' },
  { key: 'sql', label: 'SQL', color: '#C96A5A' },
  { key: 'opportunity', label: 'Opportunity', color: '#3D5A8C' },
  { key: 'customer', label: 'Customer', color: '#3E7A55' },
]

const TOOLTIPS: Record<string, string> = {
  mqls: "Total MQLs: Calculated from HubSpot contact creation events. Includes informational sign-ups (like Playbook downloads or Masterclass signups) and direct demo bookings, but excludes Agent Studio developer registrations and internal tests.",
  demo_booked: "Demo Booked: Contacts whose HubSpot lead status is 'Demo Booked' (or downstream completed stages). Includes both direct calendar bookings and SDR-booked meetings.",
  demo_completed: "Demo Completed: Contacts whose HubSpot lead status is 'Demo Completed' (or completed PLG). Represents completed demo calls conducted by the sales team.",
  sql: "SQL: Sales Qualified Leads. Contacts qualified by an SDR or AE and moved to the SQL lifecycle stage in HubSpot.",
  opportunity: "Opportunity: Contacts associated with an active sales opportunity in HubSpot (Deals pipeline).",
  customer: "Customer: Closed-Won customers. Contacts who have successfully signed and converted to paying customers."
}

/** Matches reference HTML's "MQL Journey" section — .card/.funnel-wrap/.funnel-stage structure. */
export function MQLJourneyFunnel({ funnel, monthlyFunnel }: Props) {
  // Use monthlyFunnel (MTD) as the primary funnel if available, fallback to weekly funnel
  const primaryFunnel = monthlyFunnel || funnel
  const secondaryFunnel = monthlyFunnel ? funnel : undefined

  const maxVal = Math.max(primaryFunnel.mqls, 1)

  return (
    <div className="card">
      <div className="funnel-labels">
        <div>Stage</div><div /><div style={{ textAlign: 'right' }}>Count (MTD)</div><div style={{ textAlign: 'right' }}>Conversion</div><div style={{ textAlign: 'right' }}>Drop-off</div>
      </div>
      <div className="funnel-wrap">
        {STAGES.map((stage, i) => {
          const value = primaryFunnel[stage.key]
          const weeklyValue = secondaryFunnel?.[stage.key]
          const pct = Math.max((value / maxVal) * 100, value > 0 ? 4 : 0)

          // Dynamic conversion calculation to handle direct calendar bookings and SDR qualifications correctly
          let convPct = 100
          let ofLabel: string | null = null

          if (stage.key === 'demo_booked') {
            const ref = primaryFunnel.mqls
            convPct = ref > 0 ? Math.round((value / ref) * 100) : 0
            ofLabel = 'of MQL'
          } else if (stage.key === 'demo_completed') {
            const ref = primaryFunnel.demo_booked
            convPct = ref > 0 ? Math.round((value / ref) * 100) : 0
            ofLabel = 'of booked'
          } else if (stage.key === 'sql') {
            // If we have completed demos and SQL is a subset of them
            if (primaryFunnel.demo_completed >= value && primaryFunnel.demo_completed > 0) {
              convPct = Math.round((value / primaryFunnel.demo_completed) * 100)
              ofLabel = 'of completed'
            } else {
              // Fallback to of MQL
              const ref = primaryFunnel.mqls
              convPct = ref > 0 ? Math.round((value / ref) * 100) : 0
              ofLabel = 'of MQL'
            }
          } else if (stage.key === 'opportunity') {
            const ref = primaryFunnel.sql
            convPct = ref > 0 ? Math.round((value / ref) * 100) : 0
            ofLabel = 'of SQL'
          } else if (stage.key === 'customer') {
            const ref = primaryFunnel.opportunity
            convPct = ref > 0 ? Math.round((value / ref) * 100) : 0
            ofLabel = 'of opp.'
          }

          const dropoff = i === 0 ? null : 100 - convPct

          return (
            <div className="funnel-stage" key={stage.key}>
              <div className="funnel-name relative group select-none">
                <span className="cursor-help border-b border-dashed border-[#7A6A60]/40 pb-0.5">
                  {stage.label}
                </span>
                {TOOLTIPS[stage.key] && (
                  <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50 w-72 bg-[#2A1F1A] text-white text-[11px] p-3 rounded-lg shadow-lg border border-[#5C4E46] leading-relaxed text-left normal-case font-[400]">
                    {TOOLTIPS[stage.key]}
                    <div className="absolute top-full left-4 border-4 border-transparent border-t-[#2A1F1A]"></div>
                  </div>
                )}
              </div>
              <div className="funnel-track">
                <div className="funnel-fill" style={{ width: `${pct}%`, background: stage.color }}>
                  {value > 0 ? value.toLocaleString() : ''}
                </div>
              </div>
              <div className="funnel-conv">
                {value.toLocaleString()}
                {weeklyValue !== undefined && (
                  <span style={{ color: '#9A8C82', fontSize: '11px', fontWeight: 400, marginLeft: '4px' }}>
                    ({weeklyValue.toLocaleString()} wk)
                  </span>
                )}
              </div>
              <div className={cn('funnel-conv', i === 0 || convPct >= 50 ? 'pos' : 'neg')}>
                {i === 0 ? '100%' : `${convPct}%`}
                {ofLabel && <small style={{ fontWeight: 400, color: '#7A6A60' }}> {ofLabel}</small>}
              </div>
              <div className="funnel-drop">{dropoff === null ? '—' : `${dropoff}%`}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
