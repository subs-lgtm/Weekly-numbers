"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useWeek } from "@/lib/week-context"
import { SectionShell } from "@/components/SectionShell"
import {
  Users, Clock, CheckCircle2, XCircle, Target,
  TrendingUp, AlertTriangle, ExternalLink, RefreshCw,
  ChevronDown, ChevronRight, BarChart2,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from "recharts"

// ── Types ─────────────────────────────────────────────────────────────────────
interface SLABucket {
  assigned: number; responded: number; noReply: number
  w24: number; avg: number; median: number
}
interface ContactDetail {
  id: string; name: string; email: string; company: string
  status: string; priority: string; created: string
  daysAgo: number; respondedHrs: number | null; hubspotUrl: string
}
interface JunkDetail extends ContactDetail { emailsBeforeJunk: number }
interface OwnerStat {
  ownerId: string; name: string
  sla: { high: SLABucket; medium: SLABucket; low: SLABucket; all: SLABucket }
  funnel: {
    open: number; working: number; demoBooked: number; demoCompleted: number
    noShow: number; cancelled: number; ghosting: number; disqualified: number
    stalled: number; opp: number; customer: number; junk: number
  }
  noShow: {
    total: number; reachouts: number
    details: Array<ContactDetail & { contactedCount: number; lastContacted: string | null }>
  }
  junk: { total: number; j0: number; j1: number; j2: number; j3plus: number; details: JunkDetail[] }
  drill: {
    noReply: ContactDetail[]; responded: ContactDetail[]; working: ContactDetail[]
    demoBooked: ContactDetail[]; demoCompleted: ContactDetail[]
    opp: ContactDetail[]; customer: ContactDetail[]
  }
}
interface SalesData {
  ok: boolean; dateRange: { start: string; end: string }
  totals: { assigned: number; responded: number; noReply: number; w24: number
    demoBooked: number; demoCompleted: number; opp: number; customer: number; junk: number }
  owners: OwnerStat[]
}

// ── Colour helpers ────────────────────────────────────────────────────────────
const RED    = '#C0392B'
const AMBER  = '#D97706'
const GREEN  = '#16A34A'
const BROWN  = '#6B4C4C'
const MUTED  = '#7A6A60'
const BORDER = '#D4CBC0'

function rateColor(pct: number) {
  if (pct >= 70) return GREEN
  if (pct >= 40) return AMBER
  return RED
}

// ── ScoreCard ─────────────────────────────────────────────────────────────────
function ScoreCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: number | string; icon: typeof Users
  color?: string; sub?: string
}) {
  return (
    <div className="rounded-[16px] border border-[#D4CBC0] bg-white p-4 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
      <div className="flex items-center gap-2 mb-2">
        <div className={`rounded-[8px] p-1.5 ${color || 'bg-[rgba(107,76,76,.08)]'}`}>
          <Icon className="h-3.5 w-3.5 text-[#6B4C4C]" />
        </div>
        <span className="text-[11px] font-[500] text-[#7A6A60] uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-[22px] font-[700] text-[#2A1F1A]">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {sub && <p className="text-[11px] text-[#7A6A60] mt-0.5">{sub}</p>}
    </div>
  )
}

// ── DrillPanel ────────────────────────────────────────────────────────────────
function DrillPanel({ title, leads, onClose }: {
  title: string; leads: ContactDetail[]; onClose: () => void
}) {
  if (!leads.length) return null
  return (
    <div className="rounded-[16px] border border-[#D4CBC0] bg-white p-4 shadow-[0_4px_20px_rgba(40,20,10,.08)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[13px] font-[600] text-[#2A1F1A]">{title} — {leads.length} lead{leads.length !== 1 ? 's' : ''}</span>
        <button onClick={onClose} className="text-[11px] text-[#7A6A60] hover:text-[#2A1F1A] px-2 py-0.5 rounded-[6px] border border-[#E8E0D8]">Close</button>
      </div>
      <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-white">
            <tr className="text-[#7A6A60] border-b border-[#E8E0D8]">
              <th className="text-left py-1.5 font-[500]">Name</th>
              <th className="text-left py-1.5 font-[500]">Company</th>
              <th className="text-left py-1.5 font-[500]">Status</th>
              <th className="text-left py-1.5 font-[500]">Priority</th>
              <th className="text-left py-1.5 font-[500]">Created</th>
              <th className="text-right py-1.5 font-[500]">Resp. (hrs)</th>
              <th className="py-1.5" />
            </tr>
          </thead>
          <tbody>
            {leads.map(l => (
              <tr key={l.id} className="border-b border-[#F0EBE6] hover:bg-[#F9F5F1]">
                <td className="py-1.5 font-[500] text-[#2A1F1A]">{l.name}</td>
                <td className="py-1.5 text-[#7A6A60]">{l.company}</td>
                <td className="py-1.5">
                  <span className="px-1.5 py-0.5 rounded-[4px] text-[10px] font-[500]"
                    style={{ background: 'rgba(107,76,76,.08)', color: BROWN }}>{l.status}</span>
                </td>
                <td className="py-1.5">
                  <span style={{ color: l.priority === 'high' ? RED : l.priority === 'medium' ? AMBER : MUTED }}
                    className="text-[10px] font-[600] uppercase">{l.priority}</span>
                </td>
                <td className="py-1.5 text-[#7A6A60]">{l.created}</td>
                <td className="py-1.5 text-right font-[600]"
                  style={{ color: l.respondedHrs === null ? RED : l.respondedHrs <= 24 ? GREEN : AMBER }}>
                  {l.respondedHrs === null ? '—' : l.respondedHrs}
                </td>
                <td className="py-1.5 pl-2">
                  <a href={l.hubspotUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3 text-[#7A6A60] hover:text-[#2A1F1A]" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Clickable cell ────────────────────────────────────────────────────────────
function Cell_({ value, leads, onClick, highlight }: {
  value: number; leads: ContactDetail[]; onClick: (leads: ContactDetail[], label: string) => void; highlight?: string
}) {
  const color = highlight === 'red' ? RED : highlight === 'green' ? GREEN : highlight === 'amber' ? AMBER : '#2A1F1A'
  if (!value) return <td className="py-2.5 text-right text-[#BDB0A8]">0</td>
  return (
    <td className="py-2.5 text-right">
      <button onClick={() => onClick(leads, String(value))}
        className="font-[700] underline decoration-dotted hover:opacity-70 transition-opacity"
        style={{ color }}>
        {value}
      </button>
    </td>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SalesPerformancePage() {
  const { queryStart, queryEnd } = useWeek()
  const [data, setData]           = useState<SalesData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [drill, setDrill]         = useState<{ leads: ContactDetail[]; label: string } | null>(null)
  const [noShowDrill, setNoShowDrill] = useState<{ owner: string; details: OwnerStat['noShow']['details'] } | null>(null)
  const [expandedJunk, setExpandedJunk] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/sales-performance?start=${queryStart}&end=${queryEnd}`)
      if (!res.ok) throw new Error(`${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [queryStart, queryEnd])

  useEffect(() => { load() }, [load])

  const openDrill = useCallback((leads: ContactDetail[], label: string) => {
    setDrill({ leads, label })
    setTimeout(() => document.getElementById('drill-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }, [])

  // Funnel chart data
  const funnelChartData = useMemo(() => {
    if (!data) return []
    return data.owners.map(o => ({
      name: o.name,
      'Open':           o.funnel.open,
      'Working':        o.funnel.working,
      'Demo Booked':    o.funnel.demoBooked,
      'Demo Completed': o.funnel.demoCompleted,
      'Opp/Customer':   o.funnel.opp + o.funnel.customer,
      'Junk':           o.funnel.junk,
    }))
  }, [data])

  if (loading) return (
    <SectionShell title="Sales Performance" description="Book-a-Demo lead SLA and funnel per SDR">
      <div className="flex items-center gap-3 text-[#7A6A60] py-8">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="text-[13px]">Loading from HubSpot…</span>
      </div>
    </SectionShell>
  )

  if (error || !data) return (
    <SectionShell title="Sales Performance" description="Book-a-Demo lead SLA and funnel per SDR">
      <div className="flex items-center gap-3 text-[#C0392B] py-8">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-[13px]">Failed to load: {error}</span>
        <button onClick={load} className="ml-2 text-[11px] text-[#7A6A60] underline">Retry</button>
      </div>
    </SectionShell>
  )

  const { totals, owners } = data
  const responseRate = totals.assigned > 0 ? Math.round((totals.responded / totals.assigned) * 100) : 0
  const w24Rate      = totals.responded > 0 ? Math.round((totals.w24 / totals.responded) * 100) : 0

  return (
    <SectionShell
      title="Sales Performance"
      description="Book-a-Demo lead SLA, funnel & junk accountability per SDR"
      actions={
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#7A6A60] bg-[#F9F5F1] px-2 py-1 rounded-[6px]">
            {data.dateRange.start} → {data.dateRange.end}
          </span>
          <button onClick={load}
            className="text-[11px] text-[#7A6A60] hover:text-[#2A1F1A] bg-[#F9F5F1] px-2 py-1 rounded-[6px] border border-[#E8E0D8] flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
      }
    >
    <div className="space-y-8 max-w-[1400px]">

      {/* ── Score cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreCard label="Total Assigned" value={totals.assigned} icon={Users} />
        <ScoreCard label="Responded" value={totals.responded}
          sub={`${responseRate}% response rate`} icon={CheckCircle2}
          color={`bg-[rgba(22,163,74,.08)]`} />
        <ScoreCard label="No Reply" value={totals.noReply} icon={XCircle}
          color="bg-[rgba(192,57,43,.08)]" />
        <ScoreCard label="Within 24h" value={totals.w24}
          sub={`${w24Rate}% of responded`} icon={Clock}
          color={`bg-[rgba(217,119,6,.08)]`} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreCard label="Demo Booked"    value={totals.demoBooked}    icon={Target}     color="bg-[rgba(22,163,74,.08)]" />
        <ScoreCard label="Demo Completed" value={totals.demoCompleted} icon={CheckCircle2} color="bg-[rgba(22,163,74,.08)]" />
        <ScoreCard label="Demo No Show"   value={owners.reduce((s,o)=>s+(o.noShow?.total||0),0)} icon={AlertTriangle} color="bg-[rgba(217,119,6,.08)]"
          sub={`${owners.reduce((s,o)=>s+(o.noShow?.reachouts||0),0)} had reachouts after`} />
        <ScoreCard label="Opportunities"  value={totals.opp}           icon={TrendingUp} color="bg-[rgba(22,163,74,.08)]" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreCard label="Junk Marked"    value={totals.junk}          icon={AlertTriangle} color="bg-[rgba(192,57,43,.08)]" />
      </div>

      {/* ── SLA Table ── */}
      <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
        <p className="text-[14px] font-[600] text-[#2A1F1A] mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-[#6B4C4C]" /> SLA — Engagement per SDR
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[#7A6A60] border-b border-[#E8E0D8]">
                <th className="text-left py-2 font-[500] sticky left-0 bg-white">SDR</th>
                <th className="text-right py-2 font-[500]">Assigned</th>
                <th className="text-right py-2 font-[500]">Responded</th>
                <th className="text-right py-2 font-[500]">No Reply</th>
                <th className="text-right py-2 font-[500]">Rate</th>
                <th className="text-right py-2 font-[500]">W24h</th>
                <th className="text-right py-2 font-[500]">Avg (hrs)</th>
                <th className="text-right py-2 font-[500]">Median</th>
                <th className="text-right py-2 font-[500]">Demo Booked</th>
                <th className="text-right py-2 font-[500]">Demo Done</th>
                <th className="text-right py-2 font-[500] text-[#D97706]">No Show</th>
                <th className="text-right py-2 font-[500] text-[#16A34A]">Reachout after No Show</th>
                <th className="text-right py-2 font-[500]">Opp</th>
              </tr>
            </thead>
            <tbody>
              {owners.sort((a, b) => b.sla.all.assigned - a.sla.all.assigned).map(o => {
                const rate = o.sla.all.assigned > 0
                  ? Math.round((o.sla.all.responded / o.sla.all.assigned) * 100) : 0
                return (
                  <tr key={o.ownerId} className="border-b border-[#F0EBE6] hover:bg-[#F9F5F1]">
                    <td className="py-2.5 font-[600] text-[#2A1F1A] sticky left-0 bg-inherit">{o.name}</td>
                    <td className="py-2.5 text-right text-[#2A1F1A]">{o.sla.all.assigned}</td>
                    <Cell_ value={o.sla.all.responded} leads={o.drill.responded}
                      onClick={openDrill} highlight="green" />
                    <Cell_ value={o.sla.all.noReply} leads={o.drill.noReply}
                      onClick={openDrill} highlight="red" />
                    <td className="py-2.5 text-right font-[700]"
                      style={{ color: rateColor(rate) }}>{rate}%</td>
                    <td className="py-2.5 text-right text-[#2A1F1A]">{o.sla.all.w24}</td>
                    <td className="py-2.5 text-right"
                      style={{ color: o.sla.all.avg > 48 ? RED : o.sla.all.avg > 24 ? AMBER : GREEN }}>
                      {o.sla.all.avg || '—'}
                    </td>
                    <td className="py-2.5 text-right text-[#7A6A60]">{o.sla.all.median || '—'}</td>
                    <Cell_ value={o.funnel.demoBooked} leads={o.drill.demoBooked}
                      onClick={openDrill} highlight="green" />
                    <Cell_ value={o.funnel.demoCompleted} leads={o.drill.demoCompleted}
                      onClick={openDrill} highlight="green" />
                    <td className="py-2.5 text-right font-[700]"
                      style={{ color: (o.noShow?.total || 0) > 0 ? AMBER : '#BDB0A8' }}>
                      {o.noShow?.total || 0}
                    </td>
                    <td className="py-2.5 text-right font-[700]"
                      style={{ color: (o.noShow?.reachouts || 0) > 0 ? GREEN : ((o.noShow?.total || 0) > 0 ? RED : '#BDB0A8') }}>
                      {(o.noShow?.total || 0) > 0
                        ? <button
                            onClick={() => {
                              setNoShowDrill({ owner: o.name, details: o.noShow?.details || [] })
                              setTimeout(() => document.getElementById('noshow-panel')?.scrollIntoView({ behavior:'smooth', block:'start' }), 100)
                            }}
                            className="underline decoration-dotted hover:opacity-70 transition-opacity">
                            {`${o.noShow?.reachouts || 0}/${o.noShow?.total}`}
                          </button>
                        : '—'}
                    </td>
                    <Cell_ value={o.funnel.opp} leads={o.drill.opp}
                      onClick={openDrill} highlight="green" />
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-[#9A8A80] mt-3">
          Click any number to see the leads. Response time uses HubSpot's last activity timestamp.
        </p>
      </div>

      {/* ── Funnel Chart ── */}
      <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
        <p className="text-[14px] font-[600] text-[#2A1F1A] mb-4 flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-[#6B4C4C]" /> Funnel Distribution per SDR
        </p>
        <div className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={funnelChartData} margin={{ top: 20, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D8" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: MUTED }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11, fill: MUTED }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: `1px solid ${BORDER}`, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar dataKey="Open"           stackId="a" fill="#BDB0A8" radius={[0,0,0,0]} />
              <Bar dataKey="Working"        stackId="a" fill={AMBER}  />
              <Bar dataKey="Demo Booked"    stackId="a" fill="#5A8B6B" />
              <Bar dataKey="Demo Completed" stackId="a" fill={GREEN}  />
              <Bar dataKey="Opp/Customer"   stackId="a" fill="#2563EB" />
              <Bar dataKey="Junk"           stackId="a" fill={RED} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Junk Accountability ── */}
      <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
        <p className="text-[14px] font-[600] text-[#2A1F1A] mb-4 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[#C0392B]" /> Junk Accountability — Emails Before Marking Junk
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[#7A6A60] border-b border-[#E8E0D8]">
                <th className="text-left py-2 font-[500]">SDR</th>
                <th className="text-right py-2 font-[500]">Total Junk</th>
                <th className="text-right py-2 font-[500] text-[#C0392B]">0 emails</th>
                <th className="text-right py-2 font-[500]">1 email</th>
                <th className="text-right py-2 font-[500]">2 emails</th>
                <th className="text-right py-2 font-[500] text-[#16A34A]">3+ emails</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {owners.filter(o => o.junk.total > 0)
                .sort((a, b) => b.junk.j0 - a.junk.j0)
                .map(o => (
                <tr key={o.ownerId} className="border-b border-[#F0EBE6]">
                  <td className="py-2.5 font-[600] text-[#2A1F1A]">{o.name}</td>
                  <td className="py-2.5 text-right text-[#2A1F1A]">{o.junk.total}</td>
                  <td className="py-2.5 text-right font-[700]"
                    style={{ color: o.junk.j0 > 0 ? RED : '#BDB0A8' }}>
                    {o.junk.j0 || '—'}
                  </td>
                  <td className="py-2.5 text-right text-[#2A1F1A]">{o.junk.j1 || '—'}</td>
                  <td className="py-2.5 text-right text-[#2A1F1A]">{o.junk.j2 || '—'}</td>
                  <td className="py-2.5 text-right font-[700]"
                    style={{ color: o.junk.j3plus > 0 ? GREEN : '#BDB0A8' }}>
                    {o.junk.j3plus || '—'}
                  </td>
                  <td className="py-2.5 pl-2">
                    <button
                      onClick={() => setExpandedJunk(expandedJunk === o.ownerId ? null : o.ownerId)}
                      className="flex items-center gap-1 text-[11px] text-[#7A6A60] hover:text-[#2A1F1A]">
                      {expandedJunk === o.ownerId
                        ? <ChevronDown className="h-3 w-3" />
                        : <ChevronRight className="h-3 w-3" />}
                      Details
                    </button>
                  </td>
                </tr>
              ))}
              {owners.every(o => o.junk.total === 0) && (
                <tr>
                  <td colSpan={7} className="py-4 text-center text-[#7A6A60] text-[12px]">No junk leads in this period</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Junk drill-down per SDR */}
        {owners.filter(o => o.ownerId === expandedJunk && o.junk.details.length > 0).map(o => (
          <div key={o.ownerId} className="mt-4 rounded-[12px] border border-[#E8E0D8] overflow-hidden">
            <div className="px-4 py-2 bg-[#F9F5F1] text-[11px] font-[600] text-[#2A1F1A]">
              {o.name} — {o.junk.total} junk leads
            </div>
            <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
              <table className="w-full text-[11px]">
                <thead className="sticky top-0 bg-[#F9F5F1]">
                  <tr className="text-[#7A6A60] border-b border-[#E8E0D8]">
                    <th className="text-left px-3 py-1.5 font-[500]">Name</th>
                    <th className="text-left px-3 py-1.5 font-[500]">Company</th>
                    <th className="text-left px-3 py-1.5 font-[500]">Status</th>
                    <th className="text-left px-3 py-1.5 font-[500]">Priority</th>
                    <th className="text-right px-3 py-1.5 font-[500] text-[#C0392B]">Emails before junk</th>
                    <th className="px-3 py-1.5" />
                  </tr>
                </thead>
                <tbody>
                  {(o.junk.details as JunkDetail[]).map(l => (
                    <tr key={l.id} className="border-b border-[#F0EBE6] hover:bg-[#F9F5F1]">
                      <td className="px-3 py-1.5 font-[500] text-[#2A1F1A]">{l.name}</td>
                      <td className="px-3 py-1.5 text-[#7A6A60]">{l.company}</td>
                      <td className="px-3 py-1.5 text-[#7A6A60]">{l.status}</td>
                      <td className="px-3 py-1.5">
                        <span style={{ color: l.priority === 'high' ? RED : l.priority === 'medium' ? AMBER : MUTED }}
                          className="font-[600] uppercase text-[10px]">{l.priority}</span>
                      </td>
                      <td className="px-3 py-1.5 text-right font-[700]"
                        style={{ color: l.emailsBeforeJunk === 0 ? RED : l.emailsBeforeJunk >= 3 ? GREEN : '#2A1F1A' }}>
                        {l.emailsBeforeJunk}
                      </td>
                      <td className="px-3 py-1.5">
                        <a href={l.hubspotUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 text-[#7A6A60] hover:text-[#2A1F1A]" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <p className="text-[10px] text-[#9A8A80] mt-3">
          "0 emails" = marked junk without any outreach. Dark red = accountability issue.
        </p>
      </div>

      {/* ── No Show Drill Panel ── */}
      {noShowDrill && (
        <div id="noshow-panel" className="rounded-[16px] border border-[#D4CBC0] bg-white p-4 shadow-[0_4px_20px_rgba(40,20,10,.08)]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-[600] text-[#2A1F1A]">
              {noShowDrill.owner} — No Shows & Follow-ups
            </span>
            <button onClick={() => setNoShowDrill(null)}
              className="text-[11px] text-[#7A6A60] hover:text-[#2A1F1A] px-2 py-0.5 rounded-[6px] border border-[#E8E0D8]">
              Close
            </button>
          </div>
          <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-white">
                <tr className="text-[#7A6A60] border-b border-[#E8E0D8]">
                  <th className="text-left py-1.5 font-[500]">Name</th>
                  <th className="text-left py-1.5 font-[500]">Company</th>
                  <th className="text-left py-1.5 font-[500]">Priority</th>
                  <th className="text-left py-1.5 font-[500]">Created</th>
                  <th className="text-right py-1.5 font-[500]">Total Logged Activities</th>
                  <th className="text-right py-1.5 font-[500]">Last Contacted</th>
                  <th className="py-1.5"/>
                </tr>
              </thead>
              <tbody>
                {noShowDrill.details.map(l => {
                  const hasReachout = (l.contactedCount || 0) > 0
                  return (
                    <tr key={l.id} className="border-b border-[#F0EBE6] hover:bg-[#F9F5F1]">
                      <td className="py-2 font-[500] text-[#2A1F1A]">{l.name}</td>
                      <td className="py-2 text-[#7A6A60]">{l.company}</td>
                      <td className="py-2">
                        <span style={{ color: l.priority==='high'?RED:l.priority==='medium'?AMBER:MUTED }}
                          className="font-[600] uppercase text-[10px]">{l.priority}</span>
                      </td>
                      <td className="py-2 text-[#7A6A60]">{l.created}</td>
                      <td className="py-2 text-right font-[700]"
                        style={{ color: hasReachout ? GREEN : RED }}>
                        {hasReachout ? l.contactedCount : '0 — no follow-up ⚠️'}
                      </td>
                      <td className="py-2 text-right text-[#7A6A60]">
                        {l.lastContacted
                          ? new Date(l.lastContacted).toLocaleDateString('en-US',{month:'short',day:'numeric'})
                          : '—'}
                      </td>
                      <td className="py-2 pl-2">
                        <a href={l.hubspotUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 text-[#7A6A60] hover:text-[#2A1F1A]" />
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-[#9A8A80] mt-2">
            "Total Logged Activities" = emails + calls + notes logged in HubSpot on this contact.
            Click <ExternalLink className="inline h-3 w-3" /> to view full activity timeline in HubSpot.
          </p>
        </div>
      )}

      {/* ── Drill-down panel ── */}
      {drill && (
        <div id="drill-panel">
          <DrillPanel
            title={drill.label}
            leads={drill.leads}
            onClose={() => setDrill(null)}
          />
        </div>
      )}

    </div>
    </SectionShell>
  )
}
