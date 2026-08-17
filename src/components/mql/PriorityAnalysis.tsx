'use client'

type LeadContact = {
  id: string; name: string; email: string; company: string; jobTitle: string
  score: number; formType: string; source: string; status: string; lifecycleStage: string
  owner: string; createdate: string | null; lastmodifieddate: string | null
  demoBooked: boolean; demoCompleted: boolean; demoNoShow: boolean
}

type Props = {
  contactsByPriority: { high: LeadContact[]; medium: LeadContact[]; low: LeadContact[]; unknown: LeadContact[] }
}

const SQL_STAGES = new Set(['salesqualifiedlead', 'opportunity', '249550600', 'customer'])
const OPP_STAGES = new Set(['249550600', 'customer'])

const PRIORITY_CONFIG = [
  { key: 'high' as const, label: 'High Priority', cls: 'high' },
  { key: 'medium' as const, label: 'Medium Priority', cls: 'medium' },
  { key: 'low' as const, label: 'Low Priority', cls: 'low' },
]

const MINI_STAGES = [
  { key: 'mqls', label: 'MQLs', color: '#5B3A34' },
  { key: 'demoBooked', label: 'Demo Booked', color: '#C96A5A' },
  { key: 'sql', label: 'SQL', color: '#3D5A8C' },
  { key: 'opportunity', label: 'Opportunity', color: '#2E4468' },
  { key: 'customer', label: 'Customers', color: '#3E7A55' },
]

function avgDaysOpen(contacts: LeadContact[]): number | null {
  const now = Date.now()
  const days = contacts
    .filter(c => c.createdate)
    .map(c => (now - new Date(c.createdate!).getTime()) / 86_400_000)
  if (days.length === 0) return null
  return days.reduce((a, b) => a + b, 0) / days.length
}

/** Matches reference HTML's "Priority Analysis" section — .row-3/.prio-card/.prio-stat/.mini-funnel structure. */
export function PriorityAnalysis({ contactsByPriority }: Props) {
  return (
    <div className="row-3">
      {PRIORITY_CONFIG.map(cfg => {
        const contacts = contactsByPriority[cfg.key] || []
        const count = contacts.length
        const avgScore = count > 0 ? Math.round(contacts.reduce((s, c) => s + (c.score || 0), 0) / count) : 0
        const avgDays = avgDaysOpen(contacts)

        const demoBooked = contacts.filter(c => c.demoBooked).length
        const sql = contacts.filter(c => SQL_STAGES.has(c.lifecycleStage)).length
        const opportunity = contacts.filter(c => OPP_STAGES.has(c.lifecycleStage)).length
        const customer = contacts.filter(c => c.lifecycleStage === 'customer').length
        const stageValues: Record<string, number> = { mqls: count, demoBooked, sql, opportunity, customer }
        const maxVal = Math.max(count, 1)

        return (
          <div key={cfg.key} className={`prio-card ${cfg.cls}`}>
            <div className={`prio-head ${cfg.cls}`}><span className="dot" />{cfg.label}</div>
            <div className="prio-stat"><span>MQLs</span><b>{count}</b></div>
            <div className="prio-stat"><span>Avg Lead Score</span><b>{avgScore || '—'}</b></div>
            <div className="prio-stat"><span>Avg Days Open</span><b>{avgDays !== null ? `${avgDays.toFixed(1)}d` : '—'}</b></div>
            <div className="mini-funnel">
              {MINI_STAGES.map(ms => {
                const val = stageValues[ms.key]
                const pct = Math.max((val / maxVal) * 100, val > 0 ? 3 : 0)
                return (
                  <div className="mini-stage" key={ms.key}>
                    <div className="ms-label">{ms.label}</div>
                    <div className="ms-track"><div className="ms-fill" style={{ width: `${pct}%`, background: ms.color }} /></div>
                    <div className="ms-val">{val}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
