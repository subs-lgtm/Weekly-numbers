'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight } from 'lucide-react'

type LeadContact = {
  id: string; name: string; email: string; company: string; jobTitle: string
  score: number; formType: string; source: string; status: string; lifecycleStage: string
  owner: string; createdate: string | null; lastmodifieddate: string | null
  demoBooked: boolean; demoCompleted: boolean; demoNoShow: boolean
  message?: string; platformTools?: string; campaign?: string; leadSource?: string
  interaction?: { originalSource: string; firstPage: string; lastPage: string; pageViews: number; visits: number; lastContacted: string | null; salesActivities: number; latestMeeting: string | null } | null
}

// Hover card on the lead name: why the person came in. Book a Demo form -> the message they typed
// and the products they ticked; LinkedIn lead-gen -> campaign, title and company (HubSpot stores no
// message for those). Portal + fixed positioning so the table's scroll container can't clip it.
const STAGE_LABEL: Record<string, string> = {
  lead: 'Lead', marketingqualifiedlead: 'MQL', opportunity: 'SQL', '249550600': 'Opportunity', customer: 'Customer', '242934529': 'Discarded', '258802811': 'Disqualified',
}
const SOURCE_LABEL: Record<string, string> = {
  PAID_SEARCH: 'Paid search', PAID_SOCIAL: 'Paid social', ORGANIC_SEARCH: 'Organic search', DIRECT_TRAFFIC: 'Direct traffic', SOCIAL_MEDIA: 'Social media',
  REFERRALS: 'Referral', EMAIL_MARKETING: 'Email', OFFLINE: 'Offline / integration', OTHER_CAMPAIGNS: 'Other campaign', AI_REFERRALS: 'AI referral',
}
function shortPage(u: string): string {
  try { const x = new URL(u); return (x.hostname.replace(/^www\./, '') + x.pathname).replace(/\/$/, '') } catch { return u }
}
function ago(iso: string | null | undefined): string {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (!Number.isFinite(ms) || ms < 0) return ''
  const d = Math.floor(ms / 86_400_000)
  return d >= 1 ? `${d}d ago` : `${Math.max(1, Math.floor(ms / 3_600_000))}h ago`
}

// Hover card on the lead name: who they are, why they came in (form message / LinkedIn lead-form answers),
// how they interacted, and where the lead stands now. Portal + fixed positioning so the table's scroll
// container can't clip it. Job title / company come straight from HubSpot and are blank for many leads.
function WhyCameIn({ c }: { c: LeadContact }) {
  const [tip, setTip] = useState<{ left: number; top?: number; bottom?: number } | null>(null)
  const show = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const W = 400
    const left = Math.max(8, Math.min(r.left, window.innerWidth - W - 8))
    setTip(window.innerHeight - r.bottom >= 420 ? { left, top: r.bottom + 6 } : { left, bottom: window.innerHeight - r.top + 6 })
  }
  const isLinkedIn = c.leadSource === 'LinkedIn'
  // LinkedIn lead-gen leads arrive with both form answers packed into `message` as
  // "<question>: <answer>" lines — split them into labelled rows instead of showing the raw text.
  const li = (c.message || '').match(/^What problem are you trying to solve with AI agents\?:\s*([\s\S]*?)\s*\n\s*Which platforms or tools are you currently using or evaluating\?:\s*([\s\S]*)$/)
  const i = c.interaction
  const Label = ({ children }: { children: React.ReactNode }) => <div className="text-[10px] uppercase tracking-wider text-[#B9AFA6] mt-2.5 mb-0.5">{children}</div>
  const titleOk = c.jobTitle && c.jobTitle !== '—'
  const companyOk = c.company && c.company !== '—'
  return (
    <>
      <span className="cursor-help border-b border-dashed border-[#7A6A60]/50" onMouseEnter={show} onMouseLeave={() => setTip(null)}>{c.name}</span>
      {tip && typeof document !== 'undefined' && createPortal(
        <div
          style={{ position: 'fixed', left: tip.left, top: tip.top, bottom: tip.bottom, width: 400, zIndex: 9999 }}
          className="pointer-events-none bg-[#2A1F1A] text-white text-[12px] p-4 rounded-lg shadow-xl border border-[#5C4E46] leading-relaxed text-left font-[400]"
        >
          <div className="text-[14px] font-[600]">{c.name}</div>
          <div className="text-[12px] text-[#E8DED6]">{titleOk ? c.jobTitle : <span className="text-[#B9AFA6] italic">Job title not in HubSpot</span>}{companyOk ? ` · ${c.company}` : ''}</div>
          <div className="text-[11px] text-[#B9AFA6]">{c.email}</div>

          <Label>{isLinkedIn ? 'Use case — problem they want to solve (LinkedIn lead form)' : 'Use case — why they came in'}</Label>
          {li ? (
            <>
              <div className="whitespace-pre-line">{li[1] || '—'}</div>
              <div className="mt-1.5"><span className="text-[#B9AFA6]">Platforms / tools: </span>{li[2] || '—'}</div>
            </>
          ) : c.message ? (
            <div className="whitespace-pre-line">{c.message}</div>
          ) : (
            <div className="text-[#B9AFA6] italic">{isLinkedIn ? 'No form answers in HubSpot for this lead yet.' : 'No message left on the form.'}</div>
          )}
          {c.platformTools && <div className="mt-1.5"><span className="text-[#B9AFA6]">Interested in: </span>{c.platformTools}</div>}
          {c.campaign && <div className="mt-1.5"><span className="text-[#B9AFA6]">Campaign: </span>{c.campaign}</div>}

          <Label>Interaction</Label>
          {i ? (
            <div className="space-y-0.5">
              <div><span className="text-[#B9AFA6]">Came from: </span>{SOURCE_LABEL[i.originalSource] || i.originalSource || '—'}{c.source && c.source !== 'Other' ? ` (${c.source})` : ''}</div>
              <div><span className="text-[#B9AFA6]">Website: </span>{i.pageViews} page view{i.pageViews === 1 ? '' : 's'} across {i.visits} visit{i.visits === 1 ? '' : 's'}</div>
              {i.firstPage && <div><span className="text-[#B9AFA6]">First page: </span>{shortPage(i.firstPage)}</div>}
              {i.lastPage && i.lastPage !== i.firstPage && <div><span className="text-[#B9AFA6]">Last page: </span>{shortPage(i.lastPage)}</div>}
              <div><span className="text-[#B9AFA6]">Meeting: </span>{i.latestMeeting ? `latest ${ago(i.latestMeeting) || new Date(i.latestMeeting).toLocaleDateString()}` : 'none logged'}{c.demoBooked ? ' · demo booked' : ''}{c.demoCompleted ? ' · demo completed' : ''}{c.demoNoShow ? ' · no-show' : ''}</div>
              <div><span className="text-[#B9AFA6]">Team outreach: </span>{i.lastContacted ? `last contacted ${ago(i.lastContacted)}` : 'not contacted yet'}{i.salesActivities ? ` · ${i.salesActivities} logged activit${i.salesActivities === 1 ? 'y' : 'ies'}` : ''}</div>
            </div>
          ) : (
            <div className="text-[#B9AFA6] italic">No interaction summary for this lead.</div>
          )}

          <Label>Latest status</Label>
          <div className="space-y-0.5">
            <div><span className="text-[#B9AFA6]">Lead status: </span>{c.status || '—'} <span className="text-[#B9AFA6]">· Stage: </span>{STAGE_LABEL[c.lifecycleStage] || c.lifecycleStage || '—'}</div>
            <div><span className="text-[#B9AFA6]">Owner: </span>{c.owner && c.owner !== '—' ? c.owner : 'Unassigned'} <span className="text-[#B9AFA6]">· Score: </span>{c.score || '—'}</div>
            <div><span className="text-[#B9AFA6]">Created: </span>{c.createdate ? `${ago(c.createdate) || 'today'} (${new Date(c.createdate).toLocaleDateString()})` : '—'}{c.lastmodifieddate ? ` · updated ${ago(c.lastmodifieddate) || 'just now'}` : ''}</div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
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
                  <td className="tname"><WhyCameIn c={c} /></td>
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
