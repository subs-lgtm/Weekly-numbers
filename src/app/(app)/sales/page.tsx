"use client"

import { useEffect, useState, useMemo } from "react"
import { useWeek } from "@/lib/week-context"
import { SectionShell } from "@/components/SectionShell"
import {
  Phone, Mail, Linkedin, MessageSquare, Calendar, Target,
  TrendingUp, Users, BarChart2, Zap, DollarSign, Globe, Package, Briefcase, Megaphone,
} from "lucide-react"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from "recharts"

// Types
interface SDRData {
  totals: {
    totalTouches: number
    meetingsBooked: number
    meetingsHeld: number
    emailsSent: number
    callAttempts: number
    liMessages: number
    liRequests: number
    liAccepted: number
    liFollowups: number
    contactsMapped: number
    liveConversations: number
    negativeResponses: number
    positiveResponses: number
    totalResponses: number
    sqls: number
    opps: number
    pipelineValue: number
  }
  byBDR: Record<string, {
    totalTouches: number; meetingsBooked: number; meetingsHeld: number
    emailsSent: number; callAttempts: number; liMessages: number; liRequests: number
    liAccepted: number; positiveResponses: number; totalResponses: number
    sqls: number; opps: number; pipelineValue: number; campaigns: number
  }>
  byChannel: Record<string, { touches: number; meetings: number }>
  byRegion: Record<string, { touches: number; meetings: number; count: number }>
  byProduct: Record<string, { touches: number; meetings: number; count: number }>
  byIndustry: Record<string, { touches: number; meetings: number; count: number }>
  byCampaign: Record<string, { touches: number; meetings: number; responses: number; count: number }>
  byPersona: Record<string, { touches: number; meetings: number; count: number }>
  weeklyTrend: Record<string, { touches: number; meetings: number; responses: number; sqls: number }>
  uniqueWeeks: string[]
  rowCount: number
}

// Colors
const COLORS = ["#6B4C4C", "#C96A5A", "#D4A574", "#8B6B5B", "#A67C68", "#BF8A6B", "#9C7561", "#7A5C4F", "#5A8B6B", "#4C6B6B", "#6B5A8B", "#8B5A6B"]
const PIE_COLORS_REGION = ["#6B4C4C", "#C96A5A", "#D4A574", "#5A8B6B", "#4C6B6B"]
const PIE_COLORS_PRODUCT = ["#8B6B5B", "#C96A5A", "#D4A574", "#5A8B6B", "#6B5A8B", "#4C6B6B"]

function ScoreCard({ label, value, icon: Icon, suffix, color }: {
  label: string; value: number | string; icon: typeof Phone; suffix?: string; color?: string
}) {
  return (
    <div className="rounded-[16px] border border-[#D4CBC0] bg-white p-4 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
      <div className="flex items-center gap-2 mb-2">
        <div className={`rounded-[8px] p-1.5 ${color || "bg-[rgba(107,76,76,.08)]"}`}>
          <Icon className="h-3.5 w-3.5 text-[#6B4C4C]" />
        </div>
        <span className="text-[11px] font-[500] text-[#7A6A60] uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-[22px] font-[700] text-[#2A1F1A]">
        {typeof value === "number" ? value.toLocaleString() : value}
        {suffix && <span className="text-[13px] font-[500] text-[#7A6A60] ml-1">{suffix}</span>}
      </p>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[15px] font-[600] text-[#2A1F1A] mb-3 flex items-center gap-2">
      {children}
    </h2>
  )
}

export default function SalesPage() {
  const { queryStart, queryEnd } = useWeek()
  const [data, setData] = useState<SDRData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const params = `?startDate=${encodeURIComponent(queryStart)}&endDate=${encodeURIComponent(queryEnd)}`
        const res = await fetch(`/api/sdr-activity${params}`)
        if (res.ok) {
          const json = await res.json()
          setData(json)
        }
      } catch (e) {
        console.error("Failed to fetch SDR data:", e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [queryStart, queryEnd])

  // BDR performance chart data
  const bdrChartData = useMemo(() => {
    if (!data?.byBDR) return []
    return Object.entries(data.byBDR)
      .filter(([name]) => name)
      .map(([name, d]) => ({
        name,
        touches: d.totalTouches,
        meetings: d.meetingsBooked,
        emails: d.emailsSent,
        calls: d.callAttempts,
        linkedin: d.liMessages,
        responses: d.totalResponses,
      }))
      .sort((a, b) => b.touches - a.touches)
  }, [data])

  // Channel pie chart data
  const channelChartData = useMemo(() => {
    if (!data?.byChannel) return []
    return Object.entries(data.byChannel)
      .filter(([ch]) => ch && ch !== "Other" && ch !== "Unknown")
      .map(([name, d]) => ({ name, value: d.touches, meetings: d.meetings }))
      .sort((a, b) => b.value - a.value)
  }, [data])

  // Weekly trend data
  const trendChartData = useMemo(() => {
    if (!data?.weeklyTrend) return []
    return Object.entries(data.weeklyTrend)
      .filter(([week]) => week)
      .map(([week, d]) => ({ week: week.replace(/,?\s*2026/, "").trim(), ...d }))
      .slice(-12)
  }, [data])

  // Region pie chart data — include all, give 0-touch items min value for visibility
  const regionChartData = useMemo(() => {
    if (!data?.byRegion) return []
    return Object.entries(data.byRegion)
      .filter(([name]) => name && name !== "Unknown")
      .map(([name, d]) => ({ name, value: Math.max(d.touches, 1), actualTouches: d.touches, meetings: d.meetings, count: d.count }))
      .sort((a, b) => b.actualTouches - a.actualTouches)
  }, [data])

  // Product Pitched pie chart data — include all, give 0-touch items min value
  const productChartData = useMemo(() => {
    if (!data?.byProduct) return []
    return Object.entries(data.byProduct)
      .filter(([name]) => name && name !== "Unknown" && name !== "")
      .map(([name, d]) => ({ name, value: Math.max(d.touches, 1), actualTouches: d.touches, meetings: d.meetings, count: d.count }))
      .sort((a, b) => b.actualTouches - a.actualTouches)
  }, [data])

  // Industry bar chart data
  const industryChartData = useMemo(() => {
    if (!data?.byIndustry) return []
    return Object.entries(data.byIndustry)
      .filter(([name]) => name && name !== "Unknown" && name !== "")
      .map(([name, d]) => ({
        name: name.length > 20 ? name.slice(0, 18) + "…" : name,
        fullName: name,
        touches: d.touches,
        meetings: d.meetings,
        count: d.count,
      }))
      .sort((a, b) => b.touches - a.touches)
      .slice(0, 15)
  }, [data])

  // Campaign bar chart data (top 12 by touches)
  const campaignChartData = useMemo(() => {
    if (!data?.byCampaign) return []
    return Object.entries(data.byCampaign)
      .filter(([name]) => name && name !== "Unknown" && name !== "")
      .map(([name, d]) => ({
        name: name.length > 25 ? name.slice(0, 23) + "…" : name,
        fullName: name,
        touches: d.touches,
        meetings: d.meetings,
        responses: d.responses,
      }))
      .sort((a, b) => b.touches - a.touches)
      .slice(0, 12)
  }, [data])

  // Computed rates
  const meetingConversionRate = useMemo(() => {
    if (!data?.totals) return "0%"
    const { totalTouches, meetingsBooked } = data.totals
    if (totalTouches === 0) return "0%"
    return ((meetingsBooked / totalTouches) * 100).toFixed(2) + "%"
  }, [data])

  const responseRate = useMemo(() => {
    if (!data?.totals) return "0%"
    const { totalTouches, totalResponses } = data.totals
    if (totalTouches === 0) return "0%"
    return ((totalResponses / totalTouches) * 100).toFixed(2) + "%"
  }, [data])

  if (loading) {
    return (
      <SectionShell title="SDR Weekly Activity" description="Outbound sales development performance">
        <div className="animate-pulse space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => <div key={i} className="h-24 bg-[#F0EBE6] rounded-[16px]" />)}
          </div>
        </div>
      </SectionShell>
    )
  }

  if (!data) {
    return (
      <SectionShell title="SDR Weekly Activity" description="Outbound sales development performance">
        <p className="text-[#7A6A60]">Failed to load SDR activity data.</p>
      </SectionShell>
    )
  }

  return (
    <SectionShell
      title="SDR Weekly Activity"
      description="Outbound sales development performance"
      actions={<span className="text-[11px] text-[#7A6A60] bg-[#F9F5F1] px-2 py-1 rounded-[6px]">{data.rowCount} activities</span>}
    >
    <div className="space-y-8 max-w-[1400px]">

      {/* === SCORECARDS === */}
      {/* Activity Volume */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreCard label="Total Touches" value={data.totals.totalTouches} icon={Zap} />
        <ScoreCard label="Contacts Mapped" value={data.totals.contactsMapped} icon={Users} />
        <ScoreCard label="Emails Sent" value={data.totals.emailsSent} icon={Mail} />
        <ScoreCard label="Call Attempts" value={data.totals.callAttempts} icon={Phone} />
      </div>

      {/* LinkedIn Activity */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ScoreCard label="LI Requests Sent" value={data.totals.liRequests} icon={Linkedin} />
        <ScoreCard label="LI Accepted" value={data.totals.liAccepted} icon={Linkedin} color="bg-[rgba(22,163,74,.08)]" />
        <ScoreCard label="LI Messages Sent" value={data.totals.liMessages} icon={Linkedin} />
        <ScoreCard label="LI Follow Ups" value={data.totals.liFollowups} icon={Linkedin} />
      </div>

      {/* Responses & Conversations */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ScoreCard label="Live Conversations" value={data.totals.liveConversations} icon={Phone} color="bg-[rgba(22,163,74,.08)]" />
        <ScoreCard label="Positive Responses" value={data.totals.positiveResponses} icon={MessageSquare} color="bg-[rgba(22,163,74,.08)]" />
        <ScoreCard label="Negative Responses" value={data.totals.negativeResponses} icon={MessageSquare} />
        <ScoreCard label="Total Responses" value={data.totals.totalResponses} icon={MessageSquare} />
      </div>

      {/* Outcomes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ScoreCard label="Meetings Booked" value={data.totals.meetingsBooked} icon={Calendar} color="bg-[rgba(22,163,74,.08)]" />
        <ScoreCard label="Meetings Held" value={data.totals.meetingsHeld} icon={Users} />
        <ScoreCard label="SQLs Created" value={data.totals.sqls} icon={Target} color="bg-[rgba(201,106,90,.08)]" />
        <ScoreCard label="Opportunities" value={data.totals.opps} icon={DollarSign} color="bg-[rgba(201,106,90,.08)]" />
      </div>

      {/* Rates & Pipeline */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ScoreCard label="Response Rate" value={responseRate} icon={TrendingUp} />
        <ScoreCard label="Meeting Conv. Rate" value={meetingConversionRate} icon={BarChart2} />
        <ScoreCard label="Pipeline Value" value={`$${data.totals.pipelineValue.toLocaleString()}`} icon={DollarSign} color="bg-[rgba(22,163,74,.08)]" />
        <ScoreCard label="LI Accept Rate" value={data.totals.liRequests > 0 ? ((data.totals.liAccepted / data.totals.liRequests) * 100).toFixed(1) + "%" : "0%"} icon={TrendingUp} />
      </div>

      {/* === CHARTS === */}

      {/* BDR Performance */}
      <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
        <SectionTitle><Users className="h-4 w-4 text-[#6B4C4C]" /> BDR Performance — Total Touches &amp; Meetings</SectionTitle>
        <div className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bdrChartData} margin={{ top: 25, right: 10, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D8" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#7A6A60" }} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11, fill: "#7A6A60" }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v)} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #D4CBC0", fontSize: 12 }} formatter={(val: number) => val.toLocaleString()} />
              <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 10 }} />
              <Bar dataKey="touches" fill="#6B4C4C" radius={[4, 4, 0, 0]} name="Total Touches" label={{ position: "top", fontSize: 10, fill: "#2A1F1A", formatter: (v: number) => v > 0 ? v.toLocaleString() : "" }} />
              <Bar dataKey="meetings" fill="#C96A5A" radius={[4, 4, 0, 0]} name="Meetings Booked" minPointSize={8} label={{ position: "top", fontSize: 10, fill: "#C96A5A", fontWeight: 700, formatter: (v: number) => String(v) }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* BDR Activity Breakdown */}
      <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
        <SectionTitle><BarChart2 className="h-4 w-4 text-[#6B4C4C]" /> BDR Activity Breakdown (Emails / Calls / LinkedIn)</SectionTitle>
        <div className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bdrChartData} margin={{ top: 25, right: 10, left: 10, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D8" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#7A6A60" }} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11, fill: "#7A6A60" }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #D4CBC0", fontSize: 12 }} formatter={(val: number) => val.toLocaleString()} />
              <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 10 }} />
              <Bar dataKey="emails" fill="#6B4C4C" name="Emails" radius={[3, 3, 0, 0]} minPointSize={8} label={{ position: "top", fontSize: 9, fill: "#6B4C4C", fontWeight: 600, formatter: (v: number) => v > 0 ? v.toLocaleString() : "0" }} />
              <Bar dataKey="calls" fill="#C96A5A" name="Calls" radius={[3, 3, 0, 0]} minPointSize={8} label={{ position: "top", fontSize: 9, fill: "#C96A5A", fontWeight: 600, formatter: (v: number) => v > 0 ? v.toLocaleString() : "0" }} />
              <Bar dataKey="linkedin" fill="#D4A574" name="LinkedIn" radius={[3, 3, 0, 0]} minPointSize={8} label={{ position: "top", fontSize: 9, fill: "#8B6B5B", fontWeight: 600, formatter: (v: number) => v > 0 ? v.toLocaleString() : "0" }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Weekly Outbound Touches Line Chart */}
      {trendChartData.length > 0 && (
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
          <SectionTitle><TrendingUp className="h-4 w-4 text-[#6B4C4C]" /> Weekly Outbound Touches</SectionTitle>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendChartData} margin={{ top: 30, right: 20, left: 10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D8" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#7A6A60" }} angle={-20} textAnchor="end" height={45} />
                <YAxis tick={{ fontSize: 11, fill: "#7A6A60" }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v)} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #D4CBC0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="touches" stroke="#6B4C4C" strokeWidth={2.5} dot={{ r: 5, fill: "#6B4C4C", stroke: "#fff", strokeWidth: 2 }} name="Total Outbound Touches" label={{ position: "top", fontSize: 10, fill: "#6B4C4C", fontWeight: 600, offset: 12, formatter: (v: number) => v > 0 ? v.toLocaleString() : "0" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Weekly Meetings & Responses */}
      {trendChartData.length > 0 && (
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
          <SectionTitle><Calendar className="h-4 w-4 text-[#C96A5A]" /> Weekly Meetings Booked &amp; Responses</SectionTitle>
          <div className="h-[360px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendChartData} margin={{ top: 35, right: 30, left: 10, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D8" />
                <XAxis dataKey="week" tick={{ fontSize: 10, fill: "#7A6A60" }} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11, fill: "#7A6A60" }} allowDecimals={false} domain={[-3, "dataMax + 5"]} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #D4CBC0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="responses" stroke="#D4A574" strokeWidth={2.5} dot={{ r: 5, fill: "#D4A574", stroke: "#fff", strokeWidth: 2 }} name="Responses" label={{ position: "top", fontSize: 11, fill: "#8B6B5B", fontWeight: 600, offset: 10, formatter: (v: number) => String(v) }} />
                <Line type="monotone" dataKey="meetings" stroke="#C96A5A" strokeWidth={3} dot={{ r: 6, fill: "#C96A5A", stroke: "#fff", strokeWidth: 2 }} name="Meetings Booked" label={{ position: "bottom", fontSize: 12, fill: "#C96A5A", fontWeight: 700, offset: 10, formatter: (v: number) => String(v) }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Region & Product Pie Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Region Distribution */}
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
          <SectionTitle><Globe className="h-4 w-4 text-[#6B4C4C]" /> Region Distribution (by Touches)</SectionTitle>
          <div className="flex items-center gap-4">
            <div className="h-[220px] w-[220px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={regionChartData}
                    cx="50%" cy="50%"
                    innerRadius={35} outerRadius={70}
                    dataKey="value"
                    nameKey="name"
                  >
                    {regionChartData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS_REGION[i % PIE_COLORS_REGION.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #D4CBC0", fontSize: 12 }} formatter={(val: number, name: string, props: { payload?: { actualTouches?: number } }) => `${props.payload?.actualTouches ?? val} touches`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-1.5">
              {regionChartData.map((d, i) => {
                const totalTouches = regionChartData.reduce((s, x) => s + x.actualTouches, 0)
                const pct = totalTouches > 0 ? Math.round((d.actualTouches / totalTouches) * 100) : 0
                return (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-[3px] flex-shrink-0" style={{ backgroundColor: PIE_COLORS_REGION[i % PIE_COLORS_REGION.length] }} />
                    <span className="text-[11px] text-[#2A1F1A] font-[500]">{d.name}</span>
                    <span className="text-[11px] text-[#7A6A60]">{pct}%</span>
                    <span className="text-[10px] text-[#9A8A80]">({d.actualTouches.toLocaleString()})</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Product Pitched Distribution */}
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
          <SectionTitle><Package className="h-4 w-4 text-[#6B4C4C]" /> Product Pitched (by Touches)</SectionTitle>
          <div className="flex items-center gap-4">
            <div className="h-[220px] w-[220px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={productChartData}
                    cx="50%" cy="50%"
                    innerRadius={35} outerRadius={70}
                    dataKey="value"
                    nameKey="name"
                  >
                    {productChartData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS_PRODUCT[i % PIE_COLORS_PRODUCT.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #D4CBC0", fontSize: 12 }} formatter={(val: number, name: string, props: { payload?: { actualTouches?: number } }) => `${props.payload?.actualTouches ?? val} touches`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-1.5">
              {productChartData.map((d, i) => {
                const totalTouches = productChartData.reduce((s, x) => s + x.actualTouches, 0)
                const pct = totalTouches > 0 ? Math.round((d.actualTouches / totalTouches) * 100) : 0
                return (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-[3px] flex-shrink-0" style={{ backgroundColor: PIE_COLORS_PRODUCT[i % PIE_COLORS_PRODUCT.length] }} />
                    <span className="text-[11px] text-[#2A1F1A] font-[500]">{d.name}</span>
                    <span className="text-[11px] text-[#7A6A60]">{pct}%</span>
                    <span className="text-[10px] text-[#9A8A80]">({d.actualTouches.toLocaleString()})</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Industry Breakdown Bar Chart */}
      {industryChartData.length > 0 && (
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
          <SectionTitle><Briefcase className="h-4 w-4 text-[#6B4C4C]" /> Industry / Segment Breakdown (Top 15 by Touches)</SectionTitle>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={industryChartData} layout="vertical" margin={{ top: 10, right: 60, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D8" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#7A6A60" }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#7A6A60" }} width={140} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #D4CBC0", fontSize: 12 }} formatter={(val: number) => val.toLocaleString()} labelFormatter={(l) => industryChartData.find(d => d.name === l)?.fullName || l} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="touches" fill="#6B4C4C" radius={[0, 4, 4, 0]} name="Touches" label={{ position: "right", fontSize: 10, fill: "#2A1F1A", formatter: (v: number) => v > 0 ? v.toLocaleString() : "" }} />
                <Bar dataKey="meetings" fill="#C96A5A" radius={[0, 4, 4, 0]} name="Meetings" minPointSize={5} label={{ position: "right", fontSize: 10, fill: "#C96A5A", fontWeight: 600, formatter: (v: number) => v > 0 ? String(v) : "" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Campaign Performance Bar Chart */}
      {campaignChartData.length > 0 && (
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
          <SectionTitle><Megaphone className="h-4 w-4 text-[#6B4C4C]" /> Top Campaigns (by Touches)</SectionTitle>
          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={campaignChartData} layout="vertical" margin={{ top: 10, right: 70, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D8" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#7A6A60" }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}k` : String(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#7A6A60" }} width={170} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #D4CBC0", fontSize: 12 }} formatter={(val: number) => val.toLocaleString()} labelFormatter={(l) => campaignChartData.find(d => d.name === l)?.fullName || l} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="touches" fill="#8B6B5B" radius={[0, 4, 4, 0]} name="Touches" label={{ position: "right", fontSize: 10, fill: "#2A1F1A", formatter: (v: number) => v > 0 ? v.toLocaleString() : "" }} />
                <Bar dataKey="meetings" fill="#C96A5A" radius={[0, 4, 4, 0]} name="Meetings" minPointSize={5} label={{ position: "right", fontSize: 10, fill: "#C96A5A", fontWeight: 600, formatter: (v: number) => v > 0 ? String(v) : "" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Channel & Leaderboard side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Channel Distribution Pie */}
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
          <SectionTitle><Zap className="h-4 w-4 text-[#6B4C4C]" /> Channel Distribution (by Touches)</SectionTitle>
          <div className="h-[300px]">
            {channelChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={channelChartData}
                    cx="50%" cy="45%"
                    innerRadius={40} outerRadius={75}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percent, cx: cxVal, cy: cyVal, midAngle, outerRadius: oR }) => {
                      const RADIAN = Math.PI / 180
                      const radius = (oR as number) + 30
                      const x = (cxVal as number) + radius * Math.cos(-midAngle * RADIAN)
                      const y = (cyVal as number) + radius * Math.sin(-midAngle * RADIAN)
                      return <text x={x} y={y} fill="#2A1F1A" textAnchor={x > (cxVal as number) ? "start" : "end"} dominantBaseline="central" fontSize={11} fontWeight={500}>{`${name} ${(percent * 100).toFixed(0)}%`}</text>
                    }}
                    labelLine={{ strokeWidth: 1, stroke: "#D4CBC0" }}
                  >
                    {channelChartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #D4CBC0", fontSize: 12 }} formatter={(val: number) => val.toLocaleString() + " touches"} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-[13px] text-[#7A6A60] text-center pt-20">No channel data</p>}
          </div>
        </div>

        {/* BDR Leaderboard Table */}
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
          <SectionTitle><Target className="h-4 w-4 text-[#6B4C4C]" /> BDR Leaderboard</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[#7A6A60] border-b border-[#E8E0D8]">
                  <th className="text-left py-2 font-[500]">BDR</th>
                  <th className="text-right py-2 font-[500]">Touches</th>
                  <th className="text-right py-2 font-[500]">Emails</th>
                  <th className="text-right py-2 font-[500]">Calls</th>
                  <th className="text-right py-2 font-[500]">Meetings</th>
                  <th className="text-right py-2 font-[500]">SQLs</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.byBDR)
                  .filter(([name]) => name)
                  .sort((a, b) => b[1].totalTouches - a[1].totalTouches)
                  .map(([name, d], i) => (
                    <tr key={name} className="border-b border-[#F0EBE6] hover:bg-[#F9F5F1] transition-colors">
                      <td className="py-2.5 font-[500] text-[#2A1F1A]">
                        <span className="text-[#7A6A60] mr-1">{i + 1}.</span> {name}
                      </td>
                      <td className="py-2.5 text-right text-[#2A1F1A] font-[600]">{d.totalTouches.toLocaleString()}</td>
                      <td className="py-2.5 text-right text-[#6B4C4C]">{d.emailsSent.toLocaleString()}</td>
                      <td className="py-2.5 text-right text-[#8B6B5B]">{d.callAttempts.toLocaleString()}</td>
                      <td className="py-2.5 text-right font-[600] text-[#C96A5A]">{d.meetingsBooked}</td>
                      <td className="py-2.5 text-right font-[600] text-[#5A8B6B]">{d.sqls}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    </SectionShell>
  )
}
