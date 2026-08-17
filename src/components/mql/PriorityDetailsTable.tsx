'use client'

import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'

type LeadContact = {
  id: string; name: string; email: string; company: string; jobTitle: string
  score: number; formType: string; source: string; status: string; lifecycleStage: string
  owner: string; createdate: string | null; lastmodifieddate: string | null
  demoBooked: boolean; demoCompleted: boolean; demoNoShow: boolean
}

function fmtDuration(ms: number): string {
  const totalMins = Math.floor(ms / 60_000)
  const days = Math.floor(totalMins / 1440)
  const hrs  = Math.floor((totalMins % 1440) / 60)
  const mins = totalMins % 60
  if (days > 0) return `${days}d ${hrs}h`
  if (hrs  > 0) return `${hrs}h ${mins}m`
  return `${mins}m`
}

type Props = {
  contactsByPriority: { high: LeadContact[]; medium: LeadContact[]; low: LeadContact[]; unknown: LeadContact[] }
  dateRangeLabel: string
}

const HS_PORTAL = '45094316'
const SLA_HOURS_HIGH = 24

function daysOpen(createdate: string | null): number | null {
  if (!createdate) return null
  return (Date.now() - new Date(createdate).getTime()) / 86_400_000
}

function slaStatus(priority: string, createdate: string | null): { label: string; cls: string } {
  const d = daysOpen(createdate)
  if (d === null) return { label: '—', cls: 'tsub' }
  const hours = d * 24
  const hoursLabel = hours >= 1 ? `${Math.floor(hours)}h` : `${Math.round(hours * 60)}m`
  if (priority !== 'high') return { label: hoursLabel, cls: 'tsub' }
  if (hours >= SLA_HOURS_HIGH) return { label: hoursLabel, cls: 'sla-breach' }
  if (hours >= SLA_HOURS_HIGH - 4) return { label: hoursLabel, cls: 'sla-risk' }
  return { label: hoursLabel, cls: 'sla-met' }
}

/** Matches reference HTML's "Priority Details" section — .table-toolbar/.filter-pills/.table-scroll/.badge structure. */
export function PriorityDetailsTable({ contactsByPriority, dateRangeLabel }: Props) {
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')

  const all = [
    ...contactsByPriority.high.map(c => ({ ...c, priority: 'high' })),
    ...contactsByPriority.medium.map(c => ({ ...c, priority: 'medium' })),
    ...contactsByPriority.low.map(c => ({ ...c, priority: 'low' })),
    ...contactsByPriority.unknown.map(c => ({ ...c, priority: 'unknown' })),
  ].sort((a, b) => (b.score || 0) - (a.score || 0))

  const filtered = filter === 'all' ? all : all.filter(c => c.priority === filter)
  const shown = filtered.slice(0, 50)

  return (
    <div>
      <div className="table-toolbar">
        <div className="filter-pills">
          {(['all', 'high', 'medium', 'low'] as const).map(f => (
            <div
              key={f}
              className={f === filter ? 'filter-pill active' : 'filter-pill'}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </div>
          ))}
        </div>
        <div className="card-note">Showing {shown.length} of {filtered.length} MQLs · {dateRangeLabel}</div>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {['Lead Name', 'Company', 'Contact Owner', 'Lead Score', 'Priority', 'Current Status', 'Form Type', 'Age', 'Last Updated', 'SLA'].map(h => (
                <th key={h}>{h}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map(c => {
              const sla = slaStatus(c.priority, c.createdate)
              const age = c.createdate
                ? fmtDuration(Date.now() - new Date(c.createdate).getTime())
                : '—'
              const lastUpdated = c.lastmodifieddate && c.createdate
                ? fmtDuration(new Date(c.lastmodifieddate).getTime() - new Date(c.createdate).getTime())
                : '—'
              return (
                <tr key={c.id}>
                  <td className="tname">{c.name}</td>
                  <td>{c.company}</td>
                  <td>{c.owner === '—' ? '—' : c.owner.split('@')[0]}</td>
                  <td className="tname">{c.score || '—'}</td>
                  <td><span className={`badge ${c.priority}`}>{c.priority.charAt(0).toUpperCase() + c.priority.slice(1)}</span></td>
                  <td>{c.status}</td>
                  <td style={{ color: '#9A8C82', fontSize: '11px' }}>{c.formType || '—'}</td>
                  <td>{age}</td>
                  <td style={{ color: '#9A8C82' }}>{lastUpdated}</td>
                  <td className={sla.cls}>{sla.label}</td>
                  <td>
                    <a
                      href={`https://app.hubspot.com/contacts/${HS_PORTAL}/contact/${c.id}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7A6A60' }}
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  </td>
                </tr>
              )
            })}
            {shown.length === 0 && (
              <tr><td colSpan={11} style={{ textAlign: 'center', padding: '32px 0' }}>No leads for this filter</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10.5px] text-[#D4CBC0] italic px-1">
        Age = time since lead was created. Last Updated = time between creation and last HubSpot modification. SLA shows hours elapsed — red means &gt;24h (breached), orange means 20–24h (at risk), green means under 20h. Only applies to High priority leads.
      </p>
    </div>
  )
}
