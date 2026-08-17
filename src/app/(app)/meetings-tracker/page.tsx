"use client"

import { useEffect, useState, useMemo } from "react"
import { useWeek } from "@/lib/week-context"
import { SectionShell } from "@/components/SectionShell"
import {
  Calendar, Target, Users, TrendingUp, BarChart2, CheckCircle2,
  XCircle, DollarSign, Building2, Globe, Linkedin, FileText, Zap,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts"

const COLORS = ["#6B4C4C", "#C96A5A", "#D4A574", "#8B6B5B", "#A67C68", "#BF8A6B", "#5A8B6B", "#4C6B6B", "#6B5A8B", "#8B5A6B"]

interface MeetingsData {
  totals: {
    meetings: number
    introScheduled: number
    introCompleted: number
    noShow: number
    sqls: number
    opportunities: number
    closedWon: number
    showRate: number
  }
  funnel: { meetings: number; introScheduled: number; introCompleted: number; sql: number; opportunity: number; closedWon: number }
  bySource: Record<string, number>
  byVertical: Record<string, number>
  byProduct: Record<string, number>
  byChannel: Record<string, number>
  bySDR: Record<string, { total: number; completed: number; sql: number; opp: number }>
  byStage: Record<string, number>
  byLeadStatus: Record<string, number>
  byMonth: Record<string, number>
  byLocation: Record<string, number>
  meetings: Array<{
    date: string; company: string; contact: string; title: string
    vertical: string; source: string; product: string; channel: string
    status: string; stage: string; sdr: string; introCompleted: string
    isSql: boolean; isOpp: boolean; location: string
  }>
  rowCount: number
}

function ScoreCard({ label, value, icon: Icon, color }: {
  label: string; value: number | string; icon: typeof Calendar; color?: string
}) {
  return (
    <div className="rounded-[16px] border border-[#D4CBC0] bg-white p-4 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
      <div className="flex items-center gap-2 mb-2">
        <div className={`rounded-[8px] p-1.5 ${color || "bg-[rgba(107,76,76,.08)]"}`}>
          <Icon className="h-3.5 w-3.5 text-[#6B4C4C]" />
        </div>
        <span className="text-[11px] font-[500] text-[#7A6A60] uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-[22px] font-[700] text-[#2A1F1A]">{typeof value === "number" ? value.toLocaleString() : value}</p>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[15px] font-[600] text-[#2A1F1A] mb-3 flex items-center gap-2">{children}</h2>
}

export default function MeetingsTrackerPage() {
  const { queryStart, queryEnd } = useWeek()
  const [data, setData] = useState<MeetingsData | null>(null)
  const [loading, setLoading] = useState(true)

  // Non-calendar leads from HubSpot (Playbook, Agent Studio, Contact Us, Partner Form, etc.)
  const [nonCalLeads, setNonCalLeads] = useState<{ byFormType: Record<string, number>; total: number } | null>(null)

  useEffect(() => {
    async function fetchNonCalLeads() {
      try {
        const res = await fetch(`/api/hubspot/mqls?start=${queryStart}&end=${queryEnd}&mode=all`)
        const json = await res.json()
        if (json && !json.error && json.by_form_type) {
          const EXCLUDE = new Set(['Book a Demo', 'Email Form', 'Pre-Built Agents'])
          const filtered: Record<string, number> = {}
          let total = 0
          for (const [form, count] of Object.entries(json.by_form_type as Record<string, number>)) {
            if (!EXCLUDE.has(form)) {
              filtered[form] = count
              total += count
            }
          }
          setNonCalLeads({ byFormType: filtered, total })
        }
      } catch {}
    }
    fetchNonCalLeads()
  }, [queryStart, queryEnd])

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const params = `?startDate=${encodeURIComponent(queryStart)}&endDate=${encodeURIComponent(queryEnd)}`
        const res = await fetch(`/api/meetings-tracker${params}`)
        if (res.ok) setData(await res.json())
      } catch (e) { console.error("Failed to fetch meetings data:", e) }
      finally { setLoading(false) }
    }
    fetchData()
  }, [queryStart, queryEnd])

  // Derived chart data
  const sourceData = useMemo(() => {
    if (!data?.bySource) return []
    return Object.entries(data.bySource).filter(([k]) => k !== "Unknown").map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [data])

  const verticalData = useMemo(() => {
    if (!data?.byVertical) return []
    return Object.entries(data.byVertical).filter(([k]) => k && k !== "Unknown").map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 18) + "…" : name, fullName: name, value })).sort((a, b) => b.value - a.value).slice(0, 12)
  }, [data])

  const channelData = useMemo(() => {
    if (!data?.byChannel) return []
    return Object.entries(data.byChannel).filter(([k]) => k && k !== "Unknown").map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [data])

  const sdrData = useMemo(() => {
    if (!data?.bySDR) return []
    return Object.entries(data.bySDR).filter(([k]) => k && k !== "Unknown").map(([name, d]) => ({ name, ...d })).sort((a, b) => b.total - a.total)
  }, [data])

  const productData = useMemo(() => {
    if (!data?.byProduct) return []
    return Object.entries(data.byProduct).filter(([k]) => k && k !== "Unknown").map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  }, [data])

  const stageData = useMemo(() => {
    if (!data?.byStage) return []
    return Object.entries(data.byStage).filter(([k]) => k && k !== "Unknown").map(([name, value]) => ({ name: name.length > 25 ? name.slice(0, 23) + "…" : name, value })).sort((a, b) => b.value - a.value)
  }, [data])

  const locationData = useMemo(() => {
    if (!data?.byLocation) return []
    return Object.entries(data.byLocation).filter(([k]) => k && k !== "Unknown").map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8)
  }, [data])

  if (loading) {
    return (
      <SectionShell title="Meetings Tracker" description="All meetings booked & pipeline progression">
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-4 gap-4">{[...Array(8)].map((_, i) => <div key={i} className="h-24 bg-[#F0EBE6] rounded-[16px]" />)}</div>
        </div>
      </SectionShell>
    )
  }

  if (!data) {
    return (
      <SectionShell title="Meetings Tracker" description="All meetings booked & pipeline progression">
        <p className="text-[#7A6A60]">Failed to load meetings data.</p>
      </SectionShell>
    )
  }

  return (
    <SectionShell title="Meetings Tracker" description="All meetings booked & pipeline progression" actions={<span className="text-[11px] text-[#7A6A60] bg-[#F9F5F1] px-2 py-1 rounded-[6px]">{data.rowCount} meetings</span>}>
    <div className="space-y-8 max-w-[1400px]">

      {/* Scorecards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreCard label="Total Meetings" value={data.totals.meetings} icon={Calendar} />
        <ScoreCard label="Intro Scheduled" value={data.totals.introScheduled} icon={CheckCircle2} color="bg-[rgba(22,163,74,.08)]" />
        <ScoreCard label="Intro Completed" value={data.totals.introCompleted} icon={CheckCircle2} color="bg-[rgba(22,163,74,.08)]" />
        <ScoreCard label="Show Rate" value={`${data.totals.showRate}%`} icon={TrendingUp} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ScoreCard label="No Show / Dropped" value={data.totals.noShow} icon={XCircle} />
        <ScoreCard label="SQLs" value={data.totals.sqls} icon={Target} color="bg-[rgba(201,106,90,.08)]" />
        <ScoreCard label="Opportunities" value={data.totals.opportunities} icon={DollarSign} color="bg-[rgba(201,106,90,.08)]" />
        <ScoreCard label="Closed Won" value={data.totals.closedWon} icon={DollarSign} color="bg-[rgba(22,163,74,.08)]" />
      </div>

      {/* Funnel */}
      <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
        <SectionTitle><TrendingUp className="h-4 w-4 text-[#6B4C4C]" /> Meetings Funnel</SectionTitle>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={[
              { name: "Meetings", value: data.funnel.meetings, fill: "#6B4C4C" },
              { name: "Scheduled", value: data.funnel.introScheduled, fill: "#8B6B5B" },
              { name: "Completed", value: data.funnel.introCompleted, fill: "#A67C68" },
              { name: "SQL", value: data.funnel.sql, fill: "#C96A5A" },
              { name: "Opportunity", value: data.funnel.opportunity, fill: "#D4A574" },
              { name: "Closed Won", value: data.funnel.closedWon, fill: "#5A8B6B" },
            ]} margin={{ top: 25, right: 10, left: 10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D8" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#7A6A60" }} />
              <YAxis tick={{ fontSize: 11, fill: "#7A6A60" }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #D4CBC0", fontSize: 12 }} />
              <Bar dataKey="value" name="Count" radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 12, fill: "#2A1F1A", fontWeight: 700 }}>
                {[
                  { fill: "#6B4C4C" },
                  { fill: "#8B6B5B" },
                  { fill: "#A67C68" },
                  { fill: "#C96A5A" },
                  { fill: "#D4A574" },
                  { fill: "#5A8B6B" },
                ].map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Source & Channel Pie Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Source (Inbound/Outbound/Event) */}
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
          <SectionTitle><Globe className="h-4 w-4 text-[#6B4C4C]" /> By Source</SectionTitle>
          <div className="flex items-center gap-4">
            <div className="h-[180px] w-[180px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={sourceData} cx="50%" cy="50%" innerRadius={30} outerRadius={65} dataKey="value" nameKey="name">{sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} /></PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-1.5">
              {sourceData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-[3px]" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-[11px] text-[#2A1F1A] font-[500]">{d.name}</span>
                  <span className="text-[11px] text-[#7A6A60]">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Channel */}
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
          <SectionTitle><Linkedin className="h-4 w-4 text-[#6B4C4C]" /> By Channel</SectionTitle>
          <div className="flex items-center gap-4">
            <div className="h-[180px] w-[180px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={channelData} cx="50%" cy="50%" innerRadius={30} outerRadius={65} dataKey="value" nameKey="name">{channelData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} /></PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-1.5">
              {channelData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-[3px]" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-[11px] text-[#2A1F1A] font-[500]">{d.name}</span>
                  <span className="text-[11px] text-[#7A6A60]">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Product & Location */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
          <SectionTitle><Building2 className="h-4 w-4 text-[#6B4C4C]" /> By Product</SectionTitle>
          <div className="flex items-center gap-4">
            <div className="h-[180px] w-[180px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={productData} cx="50%" cy="50%" innerRadius={30} outerRadius={65} dataKey="value" nameKey="name">{productData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} /></PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-1.5">
              {productData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-[3px]" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-[11px] text-[#2A1F1A] font-[500]">{d.name}</span>
                  <span className="text-[11px] text-[#7A6A60]">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
          <SectionTitle><Globe className="h-4 w-4 text-[#6B4C4C]" /> By Location</SectionTitle>
          <div className="flex items-center gap-4">
            <div className="h-[180px] w-[180px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={locationData} cx="50%" cy="50%" innerRadius={30} outerRadius={65} dataKey="value" nameKey="name">{locationData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} /></PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-1.5">
              {locationData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-[3px]" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-[11px] text-[#2A1F1A] font-[500]">{d.name}</span>
                  <span className="text-[11px] text-[#7A6A60]">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Vertical Breakdown */}
      {verticalData.length > 0 && (
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
          <SectionTitle><BarChart2 className="h-4 w-4 text-[#6B4C4C]" /> By Vertical / Industry</SectionTitle>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={verticalData} layout="vertical" margin={{ top: 5, right: 50, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D8" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#7A6A60" }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#7A6A60" }} width={130} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #D4CBC0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="value" fill="#6B4C4C" radius={[0, 4, 4, 0]} name="Meetings" label={{ position: "right", fontSize: 10, fill: "#2A1F1A", formatter: (v: number) => v > 0 ? String(v) : "" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* SDR Performance */}
      {sdrData.length > 0 && (
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
          <SectionTitle><Users className="h-4 w-4 text-[#6B4C4C]" /> SDR Performance</SectionTitle>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sdrData} margin={{ top: 25, right: 10, left: 10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D8" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#7A6A60" }} />
                <YAxis tick={{ fontSize: 11, fill: "#7A6A60" }} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #D4CBC0", fontSize: 12 }} />
                <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 8 }} />
                <Bar dataKey="total" fill="#6B4C4C" radius={[4, 4, 0, 0]} name="Meetings" label={{ position: "top", fontSize: 10, fill: "#2A1F1A" }} />
                <Bar dataKey="completed" fill="#A67C68" radius={[4, 4, 0, 0]} name="Completed" label={{ position: "top", fontSize: 10, fill: "#8B6B5B" }} />
                <Bar dataKey="sql" fill="#C96A5A" radius={[4, 4, 0, 0]} name="SQLs" minPointSize={5} label={{ position: "top", fontSize: 10, fill: "#C96A5A" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Lifecycle Stage Breakdown */}
      {stageData.length > 0 && (
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
          <SectionTitle><Target className="h-4 w-4 text-[#6B4C4C]" /> By Lifecycle Stage</SectionTitle>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageData} layout="vertical" margin={{ top: 5, right: 50, left: 5, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D8" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#7A6A60" }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#7A6A60" }} width={180} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #D4CBC0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="value" fill="#8B6B5B" radius={[0, 4, 4, 0]} name="Count" label={{ position: "right", fontSize: 10, fill: "#2A1F1A" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Non-Calendar Leads — Playbook, Agent Studio, Contact Us, Partner Form */}
      {nonCalLeads && nonCalLeads.total > 0 && (
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
          <div className="flex items-center gap-2 mb-4">
            <div className="rounded-[8px] p-1.5 bg-[rgba(107,76,76,.08)]">
              <FileText className="h-3.5 w-3.5 text-[#6B4C4C]" />
            </div>
            <div>
              <SectionTitle><Zap className="h-4 w-4 text-[#D97706]" /> Non-Calendar Leads (for Jessica) — {nonCalLeads.total} this period</SectionTitle>
              <p className="text-[11px] text-[#7A6A60] -mt-2">Leads from Playbook, Agent Studio, Contact Us, Partner forms — not calendar-booked Book-a-Demo</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(nonCalLeads.byFormType)
              .sort((a, b) => b[1] - a[1])
              .map(([form, count], i) => (
                <div key={form} className="rounded-[12px] border border-[#D4CBC0] bg-[#F9F5F1] p-3">
                  <p className="text-[11px] text-[#7A6A60] mb-1">{form}</p>
                  <p className="text-[22px] font-[700] text-[#2A1F1A]">{count}</p>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Meetings Table */}
      <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
        <SectionTitle><Calendar className="h-4 w-4 text-[#6B4C4C]" /> All Meetings ({data.meetings.length})</SectionTitle>
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-white">
              <tr className="text-[#7A6A60] border-b border-[#E8E0D8]">
                <th className="text-left py-2 font-[500] px-1">Date</th>
                <th className="text-left py-2 font-[500] px-1">Company</th>
                <th className="text-left py-2 font-[500] px-1">Contact</th>
                <th className="text-left py-2 font-[500] px-1">Vertical</th>
                <th className="text-left py-2 font-[500] px-1">Source</th>
                <th className="text-left py-2 font-[500] px-1">Channel</th>
                <th className="text-left py-2 font-[500] px-1">Status</th>
                <th className="text-left py-2 font-[500] px-1">Stage</th>
                <th className="text-left py-2 font-[500] px-1">SDR</th>
                <th className="text-center py-2 font-[500] px-1">SQL</th>
              </tr>
            </thead>
            <tbody>
              {data.meetings.map((m, i) => (
                <tr key={i} className="border-b border-[#F0EBE6] hover:bg-[#F9F5F1] transition-colors">
                  <td className="py-2 px-1 text-[#7A6A60] whitespace-nowrap">{m.date}</td>
                  <td className="py-2 px-1 font-[500] text-[#2A1F1A]">{m.company}</td>
                  <td className="py-2 px-1 text-[#2A1F1A]">{m.contact}</td>
                  <td className="py-2 px-1 text-[#7A6A60]">{m.vertical}</td>
                  <td className="py-2 px-1"><span className={`px-1.5 py-0.5 rounded-[4px] text-[10px] font-[500] ${m.source === "Inbound" ? "bg-[rgba(22,163,74,.1)] text-[#16A34A]" : m.source === "Outbound" ? "bg-[rgba(201,106,90,.1)] text-[#C96A5A]" : "bg-[rgba(107,76,76,.08)] text-[#6B4C4C]"}`}>{m.source}</span></td>
                  <td className="py-2 px-1 text-[#7A6A60]">{m.channel}</td>
                  <td className="py-2 px-1 text-[#7A6A60]">{m.status}</td>
                  <td className="py-2 px-1 text-[#7A6A60]">{m.stage}</td>
                  <td className="py-2 px-1 font-[500] text-[#6B4C4C]">{m.sdr}</td>
                  <td className="py-2 px-1 text-center">{m.isSql ? <span className="text-[#16A34A]">✓</span> : <span className="text-[#D4CBC0]">–</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
    </SectionShell>
  )
}
