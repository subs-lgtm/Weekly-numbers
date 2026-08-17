'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, ExternalLink, ArrowUpRight } from 'lucide-react'

type Activity = { emails: number; calls: number; notes: number; meetings: number; total: number }

type Lead = {
  id: string; name: string; email: string; company: string; jobTitle: string
  score: number; owner: string; stage: string; status: string; statusEmoji: string
  formType: string; source: string; createdAt: string
  slaHours: number | null; slaContacted: boolean
  activity: Activity; contacted: boolean; hsLink: string
}

type Data = {
  leads: Lead[]; total: number; contacted: number; unassigned: number
  dateRange: { start: string; end: string }
}

const SCORE_COLOR = (s: number) =>
  s >= 85 ? 'text-[#DC2626] font-[800]' :
  s >= 70 ? 'text-[#C0392B] font-[700]' : 'text-[#7A6A60]'

const STAGE_COLOR: Record<string, string> = {
  Customer:    'bg-emerald-100 text-emerald-800',
  Opportunity: 'bg-blue-100 text-blue-800',
  SQL:         'bg-purple-100 text-purple-800',
  MQL:         'bg-amber-100 text-amber-800',
  Lead:        'bg-gray-100 text-gray-600',
  Subscriber:  'bg-gray-100 text-gray-500',
  Discarded:   'bg-red-50 text-red-400',
  Disqualified:'bg-red-50 text-red-400',
}

function ActivityBadge({ a }: { a: Activity }) {
  if (a.total === 0) return <span className="text-[11px] text-[#BDB0A8] italic">No activity</span>
  const parts = []
  if (a.emails   > 0) parts.push(`📧${a.emails}`)
  if (a.calls    > 0) parts.push(`📞${a.calls}`)
  if (a.notes    > 0) parts.push(`📝${a.notes}`)
  if (a.meetings > 0) parts.push(`📅${a.meetings}`)
  return <span className="text-[11px] text-[#6B4C4C] font-[500]">{parts.join(' · ')}</span>
}

export function HighPriorityLeads({ queryStart, queryEnd }: { queryStart: string; queryEnd: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/hubspot/high-priority-leads?start=${queryStart}&end=${queryEnd}`)
      if (r.ok) setData(await r.json())
    } catch {}
    setLoading(false)
  }, [queryStart, queryEnd])

  useEffect(() => { load() }, [load])

  const displayLeads = expanded ? (data?.leads || []) : (data?.leads || []).slice(0, 5)

  return (
    <div className="rounded-[20px] border border-[#D4CBC0] bg-white shadow-[0_4px_20px_rgba(40,20,10,.07)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#D4CBC0] bg-[#F9F5F1]">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[rgba(192,57,43,.10)] text-[14px]">🔴</span>
          <div>
            <p className="eyebrow">High Priority Leads</p>
            <p className="text-[11px] text-[#7A6A60]">
              {queryStart} → {queryEnd} · Book a Demo + Email Form + GSI & SI · score ≥ 70 · live from HubSpot
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <div className="flex items-center gap-3 text-[11px] text-[#7A6A60]">
              <span className="rounded-full bg-[rgba(192,57,43,.08)] px-2 py-0.5 text-[#C0392B] font-[600]">
                {data.total} leads
              </span>
              <span className="rounded-full bg-[rgba(22,163,74,.08)] px-2 py-0.5 text-[#16A34A] font-[600]">
                {data.contacted} contacted
              </span>
              {data.unassigned > 0 && (
                <span className="rounded-full bg-[rgba(217,119,6,.08)] px-2 py-0.5 text-[#D97706] font-[600]">
                  ⚠️ {data.unassigned} unassigned
                </span>
              )}
            </div>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[#7A6A60] hover:bg-[#F2EDE8] transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-8 gap-2 text-[#7A6A60]">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-[13px]">Loading high priority leads…</span>
        </div>
      ) : !data || data.leads.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-[13px] text-[#7A6A60]">No high priority leads in this period.</p>
        </div>
      ) : (
        <div>
          {/* Lead rows — compact single-line table */}
          <div className="divide-y divide-[#F0EBE6]">
            {/* Table header */}
            <div className="grid grid-cols-[72px_24px_1fr_52px_90px_70px_100px_80px_56px_28px] gap-x-3 px-5 py-2 text-[10px] font-[600] text-[#BDB0A8] uppercase tracking-wide">
              <div>Date</div>
              <div>#</div>
              <div>Name · Company</div>
              <div>Score</div>
              <div>Stage / Status</div>
              <div>Activity</div>
              <div>Source</div>
              <div>Owner</div>
              <div>SLA</div>
              <div />
            </div>
            {displayLeads.map((lead, i) => {
              const actParts = []
              if (lead.activity.emails   > 0) actParts.push(`📧${lead.activity.emails}`)
              if (lead.activity.calls    > 0) actParts.push(`📞${lead.activity.calls}`)
              if (lead.activity.notes    > 0) actParts.push(`📝${lead.activity.notes}`)
              if (lead.activity.meetings > 0) actParts.push(`📅${lead.activity.meetings}`)

              // SLA signal: green ≤4h, blue ≤24h, red >24h or not contacted
              const sla = lead.slaHours
              const slaLabel = sla === null ? '—'
                : sla < 1 ? '<1h'
                : sla < 24 ? `${sla}h`
                : `${Math.floor(sla / 24)}d${sla % 24 > 0 ? ` ${sla % 24}h` : ''}`
              const slaColor = !lead.slaContacted
                ? 'bg-red-50 text-red-600 border border-red-200'        // never contacted — RED
                : sla !== null && sla <= 4
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'  // ≤4h — GREEN
                  : sla !== null && sla <= 24
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'          // ≤24h — BLUE
                    : 'bg-red-50 text-red-600 border border-red-200'             // >24h — RED
              const slaTitle = !lead.slaContacted
                ? 'Not yet contacted'
                : lead.slaContacted && sla !== null
                  ? `First activity ${slaLabel} after lead came in`
                  : '—'

              return (
                <div key={lead.id} className="group grid grid-cols-[72px_24px_1fr_52px_90px_70px_100px_80px_56px_28px] gap-x-3 items-center px-5 py-2 hover:bg-[#FAF7F4] transition-colors text-[12px]">
                  {/* Date — bold, first */}
                  <span className="text-[11px] font-[700] text-[#2A1F1A] tabular-nums whitespace-nowrap">{lead.createdAt}</span>
                  {/* # */}
                  <span className="text-[11px] text-[#BDB0A8] tabular-nums">{i + 1}</span>
                  {/* Name · Company */}
                  <div className="min-w-0 truncate">
                    <span className="font-[700] text-[#2A1F1A]">{lead.name}</span>
                    {lead.company !== '—' && <span className="text-[#7A6A60]"> · {lead.company}</span>}
                  </div>
                  {/* Score */}
                  <span className={`tabular-nums font-[700] ${SCORE_COLOR(lead.score)}`}>{lead.score}</span>
                  {/* Stage + Status emoji */}
                  <div className="flex items-center gap-1 min-w-0">
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-[600] whitespace-nowrap ${STAGE_COLOR[lead.stage] || 'bg-gray-100 text-gray-600'}`}>{lead.stage}</span>
                    {lead.status && <span className="text-[11px] text-[#7A6A60]">{lead.statusEmoji}</span>}
                  </div>
                  {/* Activity */}
                  <span className="text-[11px] text-[#6B4C4C] truncate">
                    {actParts.length ? actParts.join(' ') : <span className="text-[#D4CBC0]">—</span>}
                  </span>
                  {/* Source */}
                  <span className="text-[11px] text-[#7A6A60] truncate">{lead.source !== '—' ? lead.source : lead.formType}</span>
                  {/* Owner */}
                  <span className={`text-[11px] font-[500] truncate ${lead.owner === 'Unassigned' ? 'text-amber-600' : 'text-[#6B4C4C]'}`}>
                    {lead.owner === 'Unassigned' ? '⚠️' : ''}{lead.owner}
                  </span>
                  {/* SLA — colour coded */}
                  <span
                    className={`text-[10px] font-[700] rounded-full px-1.5 py-0.5 text-center whitespace-nowrap ${slaColor}`}
                    title={slaTitle}
                  >
                    {slaLabel}
                  </span>
                  {/* HubSpot link */}
                  <a
                    href={lead.hsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="opacity-0 group-hover:opacity-100 flex h-5 w-5 items-center justify-center rounded-full text-[#7A6A60] hover:bg-[#EDE8E3] transition-all"
                  >
                    <ArrowUpRight className="h-3 w-3" />
                  </a>
                </div>
              )
            })}
          </div>

          {/* Show more / collapse */}
          {data.leads.length > 5 && (
            <div className="border-t border-[#F0EBE6] px-5 py-3 flex items-center justify-between">
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-[12px] text-[#6B4C4C] hover:underline font-[500]"
              >
                {expanded ? '↑ Show less' : `↓ Show all ${data.leads.length} leads`}
              </button>
              <a
                href="https://app.hubspot.com/contacts/45094316/contacts/list/view/all/?filters=%5B%7B%22property%22%3A%22lyzr_lead_score_category%22%2C%22operation%22%3A%7B%22operator%22%3A%22EQ%22%2C%22values%22%3A%5B%22high_priority%22%5D%7D%7D%5D"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-[#7A6A60] hover:text-[#2A1F1A]"
              >
                View all in HubSpot <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
