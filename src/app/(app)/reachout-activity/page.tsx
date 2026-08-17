'use client'

import { useEffect, useState, useCallback } from 'react'
import { useWeek } from '@/lib/week-context'
import { SectionShell } from '@/components/SectionShell'
import { RefreshCw, Target, TrendingUp, Users, AlertTriangle, Mail } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

// ── Types ──────────────────────────────────────────────────────────────────────
interface OwnerStat {
  ownerId: string; name: string; email: string
  mqls: number; high: number; medium: number; low: number; unknown: number
  demoBooked: number; demoDone: number; working: number; opp: number
  mqlsViaInstantly: number
  emailsSentToMQLs: number   // emails sent by Instantly to MQL contacts only
  opensFromMQLs: number
  repliesFromMQLs: number
}
interface ReachoutData {
  owners: OwnerStat[]
  totals: {
    mqls:number; high:number; medium:number; low:number
    demoBooked:number; demoDone:number; opp:number
    mqlsViaInstantly:number; emailsSentToMQLs:number
    opensFromMQLs:number; repliesFromMQLs:number
  }
  dateRange: { start: string; end: string }
}

// ── Colours ────────────────────────────────────────────────────────────────────
const RED = '#C0392B'; const AMBER = '#D97706'; const GREEN = '#16A34A'
const BROWN = '#6B4C4C'; const MUTED = '#7A6A60'

// ── ScoreCard ──────────────────────────────────────────────────────────────────
function Card({ label, value, sub, color, icon: Icon }: {
  label: string; value: string | number; sub?: string; color?: string; icon: typeof Users
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

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[12px] border border-[#D4CBC0] bg-white p-3 shadow-lg text-[12px]">
      <p className="font-[600] text-[#2A1F1A] mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function ReachoutActivityPage() {
  const { queryStart, queryEnd } = useWeek()
  const [data, setData] = useState<ReachoutData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/reachout-activity?start=${queryStart}&end=${queryEnd}`)
      if (!res.ok) throw new Error(`${res.status}`)
      setData(await res.json())
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }, [queryStart, queryEnd])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <SectionShell title="Reachout Activity" description="MQLs per SDR with Instantly email outreach tally">
      <div className="flex items-center gap-3 text-[#7A6A60] py-8">
        <RefreshCw className="h-4 w-4 animate-spin" />
        <span className="text-[13px]">Loading…</span>
      </div>
    </SectionShell>
  )

  if (error || !data) return (
    <SectionShell title="Reachout Activity" description="MQLs per SDR with Instantly email outreach tally">
      <div className="flex items-center gap-3 text-[#C0392B] py-8">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-[13px]">Failed: {error}</span>
        <button onClick={load} className="ml-2 text-[11px] text-[#7A6A60] underline">Retry</button>
      </div>
    </SectionShell>
  )

  const { owners, totals, dateRange } = data
  const instantlyPct = totals.mqls > 0
    ? ((totals.mqlsViaInstantly / totals.mqls) * 100).toFixed(0) : '0'

  const chartData = owners.map(o => ({
    name: o.name,
    'MQLs':             o.mqls,
    'Via Instantly':    o.mqlsViaInstantly,
    'Demo Booked':      o.demoBooked,
  }))

  return (
    <SectionShell
      title="Reachout Activity"
      description="HubSpot MQLs per SDR — tallied against Instantly email outreach"
      actions={
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#7A6A60] bg-[#F9F5F1] px-2 py-1 rounded-[6px]">
            {dateRange.start} → {dateRange.end}
          </span>
          <button onClick={load}
            className="text-[11px] text-[#7A6A60] bg-[#F9F5F1] px-2 py-1 rounded-[6px] border border-[#E8E0D8] flex items-center gap-1 hover:text-[#2A1F1A]">
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
        </div>
      }
    >
    <div className="space-y-8 max-w-[1200px]">

      {/* ── Score cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="Total MQLs"       value={totals.mqls}       icon={Users}      />
        <Card label="High Priority"    value={totals.high}       icon={AlertTriangle} color="bg-[rgba(192,57,43,.08)]" />
        <Card label="Demo Booked"      value={totals.demoBooked} icon={Target}     color="bg-[rgba(22,163,74,.08)]" />
        <Card label="Opportunities"    value={totals.opp}        icon={TrendingUp} color="bg-[rgba(37,99,235,.08)]" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="MQLs via Instantly"     value={totals.mqlsViaInstantly}  icon={Mail}  color="bg-[rgba(107,76,76,.08)]"
          sub={`${instantlyPct}% of MQLs had prior outreach`} />
        <Card label="Emails Sent (to MQLs)"  value={totals.emailsSentToMQLs}  icon={Mail}  sub="Instantly emails to matched MQL contacts only" />
        <Card label="Opens (from MQLs)"      value={totals.opensFromMQLs}     icon={Mail}  color="bg-[rgba(217,119,6,.08)]" />
        <Card label="Replies (from MQLs)"    value={totals.repliesFromMQLs}   icon={Mail}  color="bg-[rgba(22,163,74,.08)]" />
      </div>

      {/* ── SDR Table ── */}
      <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
        <p className="text-[14px] font-[600] text-[#2A1F1A] mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-[#6B4C4C]" /> Per SDR — HubSpot MQLs + Instantly Email Activity (MQL contacts only)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-[#7A6A60] border-b border-[#E8E0D8] text-right">
                <th className="text-left py-2 font-[500]">SDR</th>
                <th className="py-2 font-[500]">MQLs</th>
                <th className="py-2 font-[500] text-[#C0392B]">High</th>
                <th className="py-2 font-[500] text-[#D97706]">Med</th>
                <th className="py-2 font-[500] text-[#2563EB]">Low</th>
                <th className="py-2 font-[500] text-[#16A34A]">Demo Booked</th>
                <th className="py-2 font-[500] text-[#16A34A]">Demo Done</th>
                <th className="py-2 font-[500] text-[#2563EB]">Opp</th>
                <th className="py-2 font-[500] text-[#6B4C4C] border-l border-[#E8E0D8]">Via Instantly</th>
                <th className="py-2 font-[500]">Emails Sent</th>
                <th className="py-2 font-[500]">Opens</th>
                <th className="py-2 font-[500]">Replies</th>
                <th className="py-2 font-[500]">Instantly %</th>
              </tr>
            </thead>
            <tbody>
              {owners.map(o => {
                const pct = o.mqls > 0
                  ? ((o.mqlsViaInstantly / o.mqls) * 100).toFixed(0) : '0'
                return (
                  <tr key={o.ownerId} className="border-b border-[#F0EBE6] hover:bg-[#F9F5F1] text-right">
                    <td className="py-2.5 font-[600] text-[#2A1F1A] text-left">{o.name}</td>
                    <td className="py-2.5 font-[700] text-[#2A1F1A]">{o.mqls}</td>
                    <td className="py-2.5 font-[700]" style={{ color: o.high > 0 ? RED : '#BDB0A8' }}>{o.high || '—'}</td>
                    <td className="py-2.5" style={{ color: o.medium > 0 ? AMBER : '#BDB0A8' }}>{o.medium || '—'}</td>
                    <td className="py-2.5" style={{ color: o.low > 0 ? '#2563EB' : '#BDB0A8' }}>{o.low || '—'}</td>
                    <td className="py-2.5 font-[700]" style={{ color: o.demoBooked > 0 ? GREEN : '#BDB0A8' }}>{o.demoBooked || '—'}</td>
                    <td className="py-2.5" style={{ color: o.demoDone > 0 ? GREEN : '#BDB0A8' }}>{o.demoDone || '—'}</td>
                    <td className="py-2.5 font-[700]" style={{ color: o.opp > 0 ? '#2563EB' : '#BDB0A8' }}>{o.opp || '—'}</td>
                    {/* ── Instantly activity — only for matched MQL emails ── */}
                    <td className="py-2.5 border-l border-[#F0EBE6] font-[700]"
                      style={{ color: o.mqlsViaInstantly > 0 ? BROWN : '#BDB0A8' }}
                      title={`${o.mqlsViaInstantly} of ${o.mqls} MQLs were in ${o.name}'s Instantly campaigns`}>
                      {o.mqlsViaInstantly > 0 ? `${o.mqlsViaInstantly} / ${o.mqls}` : '—'}
                    </td>
                    <td className="py-2.5" style={{ color: o.emailsSentToMQLs > 0 ? '#2A1F1A' : '#BDB0A8' }}>
                      {o.emailsSentToMQLs || '—'}
                    </td>
                    <td className="py-2.5" style={{ color: o.opensFromMQLs > 0 ? AMBER : '#BDB0A8' }}>
                      {o.opensFromMQLs || '—'}
                    </td>
                    <td className="py-2.5 font-[700]" style={{ color: o.repliesFromMQLs > 0 ? GREEN : '#BDB0A8' }}>
                      {o.repliesFromMQLs || '—'}
                    </td>
                    <td className="py-2.5 font-[600]"
                      style={{ color: parseInt(pct) >= 50 ? GREEN : parseInt(pct) >= 20 ? AMBER : MUTED }}>
                      {o.mqls > 0 ? `${pct}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-[#9A8A80] mt-3">
          Instantly columns = activity only for MQL emails that matched this SDR's Instantly leads. "Emails Sent" = steps sent per matched lead. Not overall campaign volume.
        </p>
      </div>

      {/* ── Chart ── */}
      {chartData.some(d => d['MQLs'] > 0) && (
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_2px_12px_rgba(40,20,10,.05)]">
          <p className="text-[14px] font-[600] text-[#2A1F1A] mb-4">
            MQLs vs Instantly-attributed vs Demo Booked per SDR
          </p>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 40 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#E8E0D8" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: MUTED }} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11, fill: MUTED }} />
                <Tooltip content={<Tip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="MQLs"          fill={BROWN} radius={[4,4,0,0]} />
                <Bar dataKey="Via Instantly" fill="#6B9AC4" radius={[4,4,0,0]} />
                <Bar dataKey="Demo Booked"   fill={GREEN} radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

    </div>
    </SectionShell>
  )
}
