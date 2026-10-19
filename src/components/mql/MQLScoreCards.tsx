'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus, Users, CheckCircle, CalendarCheck, Percent, ArrowRight, CalendarDays, Activity, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WeekMetrics } from '@/hooks/useWeeklyMetrics'
import { getDb } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { extractUseCase, classifyUseCase } from '@/lib/use-case-themes'

type Props = {
  data: WeekMetrics
  prevData: WeekMetrics
  /** Month-to-date total MQLs (live from HubSpot, calendar month up to today) */
  monthToDateTotal?: number | null
  /** Leads with a meeting booked in the selected period — shown in the Meeting Booked card's hover list. */
  meetingContacts?: MeetingRow[]
  /** Leads behind the Qualified MQLs card (score > 40) for its hover list. */
  qualifiedContacts?: HoverLead[]
}


function formatValue(value: string, unit: 'number' | 'percent'): string {
  if (!value && value !== '0') return '—'
  if (unit === 'percent') return `${value}%`
  const n = parseFloat(value)
  if (isNaN(n)) return value
  return n.toLocaleString()
}

function getDelta(current: string, prev: string): { pct: number; dir: 'up' | 'down' | 'flat' } | null {
  const c = parseFloat(current)
  const p = parseFloat(prev)
  if (isNaN(c) || isNaN(p) || p === 0) return null
  const pct = Math.round(((c - p) / p) * 100)
  return { pct, dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' }
}

function num(data: WeekMetrics, key: string): number {
  const n = parseFloat(data[key]?.value ?? '')
  return isNaN(n) ? 0 : n
}

const CARD_CLS = cn(
  'group relative w-full rounded-[20px] p-5 transition-all duration-200',
  'bg-[#FFFFFF] border border-[#D4CBC0]',
  'shadow-[0_4px_20px_rgba(40,20,10,.07)]',
  'hover:shadow-[0_8px_40px_rgba(40,20,10,.13)] hover:-translate-y-1',
)

function DeltaPill({ delta, suffix }: { delta: { pct: number; dir: 'up' | 'down' | 'flat' } | null; suffix: string }) {
  if (!delta) return null
  return (
    <div className={cn('mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', delta.dir === 'up' && 'delta-up', delta.dir === 'down' && 'delta-down', delta.dir === 'flat' && 'delta-flat')}>
      {delta.dir === 'up' && <TrendingUp className="h-3 w-3" />}
      {delta.dir === 'down' && <TrendingDown className="h-3 w-3" />}
      {delta.dir === 'flat' && <Minus className="h-3 w-3" />}
      {delta.dir === 'up' ? '+' : ''}{delta.pct}% {suffix}
    </div>
  )
}

/* =========================================================================
   TOTAL MQL SUMMARY — 5 cards in priority order:
   Total MQLs, Goal MQLs, Qualified MQLs, Meeting Booked, MQL → Demo Rate (%)
   ========================================================================= */

function WeeklyMQLsCard({ value, prevValue }: { value: string; prevValue: string }) {
  const delta = getDelta(value, prevValue)
  const hasValue = value !== '' && value !== undefined
  const total = parseFloat(value) || 0

  return (
    <div className={CARD_CLS}>
      <div className="inline-flex items-center justify-center rounded-full p-2 mb-3" style={{ background: 'rgba(107,76,76,.08)', color: '#6B4C4C' }}>
        <Users className="h-4 w-4" />
      </div>
      <p className="eyebrow mb-2">Total MQLs</p>
      <p className="font-['Playfair_Display'] font-[500] text-[2rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">
        {hasValue ? total.toLocaleString() : '—'}
      </p>
      <DeltaPill delta={delta} suffix="WoW" />
      {prevValue && <p className="caption mt-1">prev {prevValue}</p>}
    </div>
  )
}

function GoalVsActualCard({ value, goal }: { value: string; goal: number }) {
  const total = parseFloat(value) || 0
  const pct = total > 0 ? Math.round((total / goal) * 100) : 0

  return (
    <div className={CARD_CLS}>
      <div className="inline-flex items-center justify-center rounded-full p-2 mb-3" style={{ background: 'rgba(217,119,6,.08)', color: '#D97706' }}>
        <Target className="h-4 w-4" />
      </div>
      <p className="eyebrow mb-2">Goal MQLs</p>
      <div className="flex items-baseline gap-1.5">
        <p className="font-['Playfair_Display'] font-[500] text-[2rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">
          {total.toLocaleString()}
        </p>
        <span className="text-[14px] text-[#7A6A60] font-[400]">/ {goal}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-[#F2EDE8] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(pct, 100)}%`, background: pct >= 100 ? '#16A34A' : '#D97706' }} />
      </div>
      <p className="caption mt-1.5">{pct}% of weekly goal</p>
    </div>
  )
}

function QualifiedMQLsCard({ value, prevValue, totalMqls, rows = [] }: { value: string; prevValue: string; totalMqls: string; rows?: HoverLead[] }) {
  const delta = getDelta(value, prevValue)
  const hasValue = value !== '' && value !== undefined
  const totalVal = parseFloat(totalMqls) || 0
  const qualVal = parseFloat(value) || 0
  const pctOfTotal = totalVal > 0 ? Math.round((qualVal / totalVal) * 100) : 0

  return (
    <div className={cn(CARD_CLS, 'hover:z-40 focus-within:z-40')} tabIndex={0}>
      <div className="inline-flex items-center justify-center rounded-full p-2 mb-3" style={{ background: 'rgba(22,163,74,.08)', color: '#16A34A' }}>
        <CheckCircle className="h-4 w-4" />
      </div>
      <p className="eyebrow mb-2">Qualified MQLs</p>
      <p className="font-['Playfair_Display'] font-[500] text-[2rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">
        {hasValue ? qualVal.toLocaleString() : '—'}
      </p>
      <DeltaPill delta={delta} suffix="WoW" />
      {totalVal > 0 && <p className="caption mt-1 text-[#D97706]">{pctOfTotal}% of total (score &gt; 40)</p>}
      {prevValue && <p className="caption mt-1">prev {prevValue}</p>}
      {rows.length > 0 && <p className="caption mt-1.5 text-[#2563EB] underline decoration-dotted underline-offset-2">hover to see who</p>}
      {rows.length > 0 && (
        <div className="hidden group-hover:block group-focus-within:block absolute left-0 top-full z-50 pt-2 w-[440px] max-w-[88vw]">
          <LeadListBody rows={rows} title="Qualified MQLs (lead score above 40) - company, use case and score" footer="Book a Demo leads created in the selected dates with a lead score above 40, highest score first." />
        </div>
      )}
    </div>
  )
}

function fmtMeetingDate(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function MeetingBookedCard({ value, prevValue, contacts }: { value: string; prevValue: string; contacts: MeetingRow[] }) {
  const delta = getDelta(value, prevValue)
  const hasValue = value !== '' && value !== undefined
  const total = parseFloat(value) || 0
  const rows = [...contacts].sort((a, b) => (b.bookedAt || '').localeCompare(a.bookedAt || ''))

  return (
    <div className={cn(CARD_CLS, 'hover:z-40 focus-within:z-40')} tabIndex={0}>
      <div className="inline-flex items-center justify-center rounded-full p-2 mb-3" style={{ background: 'rgba(37,99,235,.08)', color: '#2563EB' }}>
        <CalendarCheck className="h-4 w-4" />
      </div>
      <p className="eyebrow mb-2">Meeting Booked</p>
      <p className="font-['Playfair_Display'] font-[500] text-[2rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">
        {hasValue ? total.toLocaleString() : '—'}
      </p>
      <DeltaPill delta={delta} suffix="WoW" />
      {prevValue && <p className="caption mt-1">prev {prevValue}</p>}
      {rows.length > 0 && (
        <p className="caption mt-1.5 text-[#2563EB] underline decoration-dotted underline-offset-2">hover to see who</p>
      )}
      {/* Hover list - leads whose meeting was BOOKED in the selected dates. pt-2 (not margin) keeps the hover bridge unbroken. */}
      {rows.length > 0 && (
        <div className="hidden group-hover:block group-focus-within:block absolute right-0 top-full z-50 pt-2 w-[440px] max-w-[88vw]">
          <MeetingListBody rows={rows} title="Meetings booked in this period - company, use case and latest SDR note" footer="Counts unique leads from marketing forms (not Agent Studio-only users) whose meeting was booked in the selected dates, whenever the lead itself came in." />
        </div>
      )}
    </div>
  )
}

function MQLToDemoRateCard({ value, prevValue }: { value: string; prevValue: string }) {
  const delta = getDelta(value, prevValue)
  const hasValue = value !== '' && value !== undefined

  return (
    <div className={CARD_CLS}>
      <div className="inline-flex items-center justify-center rounded-full p-2 mb-3" style={{ background: 'rgba(201,106,90,.08)', color: '#C96A5A' }}>
        <Percent className="h-4 w-4" />
      </div>
      <p className="eyebrow mb-2">MQL → Demo Rate</p>
      <p className="font-['Playfair_Display'] font-[500] text-[2rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">
        {hasValue ? `${value}%` : '—'}
      </p>
      <DeltaPill delta={delta} suffix="WoW" />
      <p className="caption mt-1.5 italic">Auto-calculated</p>
      {prevValue && <p className="caption mt-1">prev {prevValue}%</p>}
    </div>
  )
}

/** Total MQL Summary — 5 cards in priority order, matches spec requirements. */
export function TotalMQLSummaryCards({ data, prevData, meetingContacts = [], qualifiedContacts = [] }: Props) {
  const [weeklyGoal, setWeeklyGoal] = useState<number>(100)

  // Load weekly MQL goal from Firestore
  useEffect(() => {
    const db = getDb()
    getDoc(doc(db, 'goals', 'current'))
      .then(snap => {
        if (snap.exists()) {
          const data = snap.data()
          const val = parseFloat(data.weekly_mqls)
          if (!isNaN(val) && val > 0) {
            setWeeklyGoal(val)
          }
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
      <WeeklyMQLsCard value={data['mqls_total']?.value ?? ''} prevValue={prevData['mqls_total']?.value ?? ''} />
      <GoalVsActualCard value={data['mqls_total']?.value ?? ''} goal={weeklyGoal} />
      <QualifiedMQLsCard value={data['mqls_qualified']?.value ?? ''} prevValue={prevData['mqls_qualified']?.value ?? ''} totalMqls={data['mqls_total']?.value ?? ''} rows={qualifiedContacts} />
      <MeetingBookedCard value={data['meeting_booked']?.value ?? ''} prevValue={prevData['meeting_booked']?.value ?? ''} contacts={meetingContacts} />
      <MQLToDemoRateCard value={data['mql_to_demo_rate']?.value ?? ''} prevValue={prevData['mql_to_demo_rate']?.value ?? ''} />
    </div>
  )
}

/* =========================================================================
   OTHER METRICS — relocated MTD Monthly MQLs and Weekly SQLs cards
   ========================================================================= */

function MonthlyMQLsCard({ value, prevValue }: { value: number; prevValue: number | null }) {
  const delta = prevValue !== null ? getDelta(value.toString(), prevValue.toString()) : null

  return (
    <div className={CARD_CLS}>
      <div className="inline-flex items-center justify-center rounded-full p-2 mb-3" style={{ background: 'rgba(124,58,237,.08)', color: '#7C3AED' }}>
        <CalendarDays className="h-4 w-4" />
      </div>
      <p className="eyebrow mb-2">Monthly MQLs (MTD)</p>
      <p className="font-['Playfair_Display'] font-[500] text-[2rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">
        {value.toLocaleString()}
      </p>
      <DeltaPill delta={delta} suffix="MoM" />
      {prevValue !== null && <p className="caption mt-1">prev {prevValue.toLocaleString()}</p>}
    </div>
  )
}

function WeeklySQLCard({ value, prevValue }: { value: string; prevValue: string }) {
  const total = parseFloat(value) || 0
  const prev = parseFloat(prevValue) || 0
  const diff = total - prev
  const pct = prev > 0 ? Math.round((diff / prev) * 100) : total > 0 ? 100 : 0
  const dir = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'

  return (
    <div className={CARD_CLS}>
      <div className="inline-flex items-center justify-center rounded-full p-2 mb-3" style={{ background: 'rgba(61,90,140,.08)', color: '#3D5A8C' }}>
        <Activity className="h-4 w-4" />
      </div>
      <p className="eyebrow mb-2">Weekly SQLs</p>
      <p className="font-['Playfair_Display'] font-[500] text-[2rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">
        {total > 0 ? total.toLocaleString() : '—'}
      </p>
      {prev > 0 && (
        <div className={cn('mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', dir === 'up' && 'delta-up', dir === 'down' && 'delta-down', dir === 'flat' && 'delta-flat')}>
          {dir === 'up' && <TrendingUp className="h-3 w-3" />}
          {dir === 'down' && <TrendingDown className="h-3 w-3" />}
          {dir === 'flat' && <Minus className="h-3 w-3" />}
          {dir === 'up' ? '+' : ''}{pct}% vs last week
        </div>
      )}
    </div>
  )
}

export function OtherMQLMetrics({ data, prevData, monthToDateTotal, prevMonthToDateTotal }: Props & { prevMonthToDateTotal?: number | null }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
      <MonthlyMQLsCard value={monthToDateTotal ?? 0} prevValue={prevMonthToDateTotal ?? null} />
      <WeeklySQLCard value={data['sql_count']?.value ?? ''} prevValue={prevData['sql_count']?.value ?? ''} />
    </div>
  )
}

/* =========================================================================
   QUALIFICATION FUNNELS — split 2026-09-07 into two independent, single-
   dimension tables (was one merged "MQL Qualification Funnel" table that
   checked lifecyclestage BEFORE falling back to hs_lead_status, so a
   contact already at SQL with a stale "Demo Completed" lead status just
   vanished from the Demo Completed row — confusing when someone expects
   their raw HubSpot status to be reflected somewhere). Each table below
   counts every MQL exactly once, using ONLY its own property — no
   cross-checking the other dimension, so nothing gets silently overridden.
   Shared rendering via FunnelTable(); MQLLeadStatusFunnel and
   MQLLifecycleStatusFunnel below are the two exported entry points.
   ========================================================================= */

export type MeetingRow = {
  ads?: boolean; formType?: string; bookedAt?: string | null; booked?: boolean; held?: boolean
  id: string; name?: string; company?: string; jobTitle?: string; message?: string; platformTools?: string
  status: 'completed' | 'held' | 'no_show' | 'upcoming' | 'canceled'; meetingAt?: string | null
  title?: string; notes?: string; noteBy?: string; noteAt?: string | null; outcome?: string
}
const CHANNEL_CLS: Record<string, string> = {
  'Paid Campaigns': 'bg-[#EFE3E0] text-[#6B4C4C]', Direct: 'bg-[#F6E3DE] text-[#A8483A]', 'Organic Search': 'bg-[#E1EEEE] text-[#2F6F6F]',
  Referral: 'bg-[#F3EBCB] text-[#7A6420]', Social: 'bg-[#E9E3F1] text-[#5E4A82]',
}

/** SQL / Opportunity hover lists (who + channel source) from the route's pipeline_activity. */
export function buildPipelineHover(pa: any): { sql: HoverLead[]; opportunity: HoverLead[] } {
  const sd = (iso?: string | null) => { if (!iso) return ''; const d = new Date(iso); return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
  const chip = (r: any) => ({ chip: r.channel || 'Unattributed', chipCls: CHANNEL_CLS[r.channel] || 'bg-[#EEE7DC] text-[#7A6A60]' })
  return {
    sql: (pa?.sql?.details || []).map((r: any): HoverLead => ({
      id: r.id, name: r.name, company: r.company, jobTitle: r.jobTitle, message: r.message, platformTools: r.platformTools, ...chip(r),
      meta: [r.via === 'opportunity' ? 'Moved to Opportunity' : 'Entered SQL', sd(r.at), String(r.formType || '').split(';')[0], r.via === 'opportunity' && r.dealName ? r.dealName : ''].filter(Boolean).join(' · '),
    })),
    opportunity: (pa?.opportunity?.details || []).map((r: any): HoverLead => ({
      id: r.id, name: r.name, company: r.company, jobTitle: r.jobTitle, message: r.message, platformTools: r.platformTools, ...chip(r),
      meta: [r.dealName, r.dealAmount ? '$' + Math.round(r.dealAmount).toLocaleString() : '', r.dealStage, r.dealSource, sd(r.at), String(r.formType || '').split(';')[0]].filter(Boolean).join(' · '),
    })),
  }
}

type FunnelStage = {
  label: string; value: number; color: string; breakdownKey: string; ofLabel?: string; ofBase?: number
  /** Hover list (Demo Booked / Demo Completed - built from HubSpot Meetings) */
  hoverRows?: MeetingRow[]; hoverTitle?: string; hoverFooter?: string
  /** Hover list of leads (SQL / Opportunity rows) with their channel source */
  leadRows?: HoverLead[]
}

const MEETING_STATUS_LABEL: Record<MeetingRow['status'], { label: string; cls: string }> = {
  completed: { label: 'Completed (confirmed)', cls: 'bg-[#E6F3EA] text-[#2F6A45]' },
  no_show: { label: 'No-show', cls: 'bg-[#FBE9E6] text-[#A33A2E]' },
  held: { label: 'Held - outcome not set in HubSpot', cls: 'bg-[#FBF1E4] text-[#8A5A14]' },
  upcoming: { label: 'Upcoming', cls: 'bg-[#E8EEF8] text-[#2D4C86]' },
  canceled: { label: 'Cancelled / rescheduled', cls: 'bg-[#EEE7DC] text-[#7A6A60]' },
}

function MeetingHoverList({ rows, title, footer }: { rows: MeetingRow[]; title: string; footer?: string }) {
  return (
    <div className="hidden group-hover/stage:block group-focus-within/stage:block absolute left-0 sm:left-[140px] top-full z-50 pt-1 w-[440px] max-w-[88vw]">
      <MeetingListBody rows={rows} title={title} footer={footer} />
    </div>
  )
}

/** Same list, positioned for the Summary page's key-number cards (named group `mtg`). `align` keeps it on-screen for right-hand cards. */
export function SummaryMeetingsPopover({ rows, title, footer, align = 'left' }: { rows: MeetingRow[]; title: string; footer?: string; align?: 'left' | 'right' }) {
  return (
    <div className={cn('hidden group-hover/mtg:block group-focus-within/mtg:block absolute top-full z-50 pt-1 w-[440px] max-w-[88vw]', align === 'right' ? 'right-0' : 'left-0')}>
      <MeetingListBody rows={rows} title={title} footer={footer} />
    </div>
  )
}

/** A lead row for the SQL / Opportunity / Qualified MQL hover lists (company, person, use case + one detail line). */
export type HoverLead = {
  id: string; name?: string; company?: string; jobTitle?: string; message?: string; platformTools?: string
  chip?: string; chipCls?: string; meta?: string
}

export function LeadListBody({ rows, title, footer }: { rows: HoverLead[]; title: string; footer?: string }) {
  return (
    <div className="rounded-[14px] border border-[#D4CBC0] bg-white shadow-[0_12px_32px_rgba(40,20,10,.18)] p-3 text-left max-h-[360px] overflow-y-auto">
      <p className="text-[10.5px] uppercase tracking-[.06em] text-[#7A6A60] font-[600] mb-2">{title}</p>
      {rows.length === 0 ? <p className="text-[12px] text-[#7A6A60]">None in this period.</p> : (
        <ul className="space-y-3">
          {rows.map(c => {
            const uc = extractUseCase({ message: c.message, platformTools: c.platformTools })
            const theme = classifyUseCase(uc.text)
            const snippet = uc.text.replace(/\s+/g, ' ').slice(0, 140)
            return (
              <li key={c.id} className="border-b border-[#EEE7DC] last:border-0 pb-2.5 last:pb-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-[700] text-[#2A1F1A] truncate">{c.company && c.company !== '—' ? c.company : '(no company)'}</span>
                  {c.chip && <span className={`shrink-0 rounded-full px-2 py-[1px] text-[10px] font-[600] ${c.chipCls || 'bg-[#EEE7DC] text-[#7A6A60]'}`}>{c.chip}</span>}
                </div>
                <p className="text-[11.5px] text-[#7A6A60] truncate">
                  {[c.name && c.name !== '—' ? c.name : '', c.jobTitle && c.jobTitle !== '—' ? c.jobTitle : ''].filter(Boolean).join(' · ')}
                </p>
                {c.meta && <p className="text-[10.5px] text-[#9A8C82]">{c.meta}</p>}
                <div className="mt-1 flex items-start gap-1.5">
                  <span className="shrink-0 rounded-full px-2 py-[1px] text-[10.5px] font-[600] text-white" style={{ background: theme.color }}>{theme.label}</span>
                  {snippet && theme.key !== 'none' && <span className="text-[11.5px] leading-snug text-[#2A1F1A]">{snippet}{uc.text.length > 140 ? '…' : ''}</span>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {footer && <p className="mt-2 pt-2 border-t border-[#EEE7DC] text-[11px] text-[#8A5A14]">{footer}</p>}
    </div>
  )
}

/** Lead hover list for the Summary page's key-number cards (named group `mtg`). */
export function SummaryLeadPopover({ rows, title, footer, align = 'left' }: { rows: HoverLead[]; title: string; footer?: string; align?: 'left' | 'right' }) {
  return (
    <div className={cn('hidden group-hover/mtg:block group-focus-within/mtg:block absolute top-full z-50 pt-1 w-[440px] max-w-[88vw]', align === 'right' ? 'right-0' : 'left-0')}>
      <LeadListBody rows={rows} title={title} footer={footer} />
    </div>
  )
}

function MeetingListBody({ rows, title, footer }: { rows: MeetingRow[]; title: string; footer?: string }) {
  return (
    <>
      <div className="rounded-[14px] border border-[#D4CBC0] bg-white shadow-[0_12px_32px_rgba(40,20,10,.18)] p-3 text-left max-h-[360px] overflow-y-auto">
        <p className="text-[10.5px] uppercase tracking-[.06em] text-[#7A6A60] font-[600] mb-2">{title}</p>
        {rows.length === 0 ? <p className="text-[12px] text-[#7A6A60]">None in this period.</p> : (
          <ul className="space-y-3">
            {rows.map(c => {
              const uc = extractUseCase({ message: c.message, platformTools: c.platformTools })
              const theme = classifyUseCase(uc.text)
              const snippet = uc.text.replace(/\s+/g, ' ').slice(0, 140)
              const st = MEETING_STATUS_LABEL[c.status]
              const when = fmtMeetingDate(c.meetingAt)
              return (
                <li key={c.id} className="border-b border-[#EEE7DC] last:border-0 pb-2.5 last:pb-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-[700] text-[#2A1F1A] truncate">{c.company && c.company !== '—' ? c.company : '(no company)'}</span>
                    <span className={`shrink-0 rounded-full px-2 py-[1px] text-[10px] font-[600] ${st.cls}`}>{st.label}</span>
                  </div>
                  <p className="text-[11.5px] text-[#7A6A60] truncate">
                    {[c.name && c.name !== '—' ? c.name : '', c.jobTitle && c.jobTitle !== '—' ? c.jobTitle : ''].filter(Boolean).join(' · ')}
                  </p>
                  {(c.bookedAt || when) && (
                    <p className="text-[10.5px] text-[#9A8C82]">{c.bookedAt ? `Booked ${fmtMeetingDate(c.bookedAt)}` : ''}{c.bookedAt && when ? ' · ' : ''}{when ? `Meeting ${when}` : ''}{c.formType ? ` · ${c.formType.split(';')[0]}` : ''}</p>
                  )}
                  <div className="mt-1 flex items-start gap-1.5">
                    <span className="shrink-0 rounded-full px-2 py-[1px] text-[10.5px] font-[600] text-white" style={{ background: theme.color }}>{theme.label}</span>
                    {snippet && theme.key !== 'none' && <span className="text-[11.5px] leading-snug text-[#2A1F1A]">{snippet}{uc.text.length > 140 ? '…' : ''}</span>}
                  </div>
                  <div className="mt-1.5 rounded-[8px] bg-[#F9F5F1] px-2 py-1.5">
                    <p className="text-[10px] uppercase tracking-[.05em] text-[#7A6A60] font-[600]">
                      Latest SDR note{c.noteBy ? ` · ${c.noteBy}` : ''}{c.noteAt ? ` · ${fmtMeetingDate(c.noteAt)}` : ''}
                    </p>
                    <p className="text-[11.5px] leading-snug text-[#2A1F1A]">{c.notes ? c.notes : <span className="text-[#9A8C82]">No notes on the meeting yet.</span>}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {footer && <p className="mt-2 pt-2 border-t border-[#EEE7DC] text-[11px] text-[#8A5A14]">{footer}</p>}
      </div>
    </>
  )
}

function FunnelTable({
  stages, breakdown, countHeader = 'Count',
}: {
  stages: FunnelStage[]
  breakdown: Record<string, { working: number; linkedinAds: number; website: number; total: number }>
  countHeader?: string
}) {
  const maxVal = Math.max(...stages.map(s => s.value), 1)

  return (
    <div className="card">
      <div className="funnel-labels"><div>Stage</div><div /><div style={{ textAlign: 'right' }}>{countHeader}</div><div style={{ textAlign: 'right' }}>Conversion</div><div style={{ textAlign: 'right' }}>Drop-off</div></div>
      <div className="funnel-wrap" style={{ gap: '20px' }}>
        {stages.map((stage, i) => {
          const pct = Math.max((stage.value / maxVal) * 100, stage.value > 0 ? 4 : 0)
          const conv = i === 0 ? 100 : (stage.ofBase ?? 0) > 0 ? Math.round((stage.value / (stage.ofBase as number)) * 100) : 0
          const drop = i === 0 ? null : 100 - conv
          const bd = breakdown[stage.breakdownKey]

          return (
            <div key={stage.label} className={cn('relative', (stage.hoverRows || stage.leadRows) && 'group/stage hover:z-40 focus-within:z-40')} tabIndex={(stage.hoverRows || stage.leadRows) ? 0 : undefined}>
              <div className="funnel-stage">
                <div className="funnel-name">
                  {stage.label}
                  {(stage.hoverRows || stage.leadRows) && <span className="block text-[10px] font-[500] text-[#2563EB] underline decoration-dotted underline-offset-2">hover for details</span>}
                </div>
                <div className="flex flex-col gap-1.5 w-full">
                  <div className="funnel-track w-full">
                    <div className="funnel-fill" style={{ width: `${pct}%`, background: stage.color }}>
                      {stage.value > 0 ? stage.value.toLocaleString() : ''}
                    </div>
                  </div>
                  {bd && stage.value > 0 && (bd.working > 0 || bd.linkedinAds > 0 || bd.website > 0) && (
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] text-[#7A6A60] font-[500] mt-0.5 pl-1">
                      <span>Sources: {bd.linkedinAds} Ads • {bd.website} Website</span>
                      {bd.working > 0 && stage.label !== 'Working' && (
                        <span className="inline-flex items-center rounded-full bg-[#FFFBEB] px-1.5 py-0.5 text-[9px] font-[600] text-[#D97706] border border-[#FEF3C7]">
                          ⚡ {bd.working} in Working status
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="funnel-conv">{stage.value.toLocaleString()}</div>
                <div className={cn('funnel-conv', i === 0 || conv >= 50 ? 'pos' : 'neg')}>
                  {i === 0 ? '100%' : `${conv}%`}
                  {stage.ofLabel && <small style={{ fontWeight: 400, color: '#7A6A60' }}> {stage.ofLabel}</small>}
                </div>
                <div className="funnel-drop">{drop === null ? '—' : `${drop}%`}</div>
              </div>
              {stage.hoverRows && <MeetingHoverList rows={stage.hoverRows} title={stage.hoverTitle || stage.label} footer={stage.hoverFooter} />}
              {stage.leadRows && (
                <div className="hidden group-hover/stage:block group-focus-within/stage:block absolute left-0 sm:left-[140px] top-full z-50 pt-1 w-[440px] max-w-[88vw]">
                  <LeadListBody rows={stage.leadRows} title={stage.hoverTitle || stage.label} footer={stage.hoverFooter} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// "MQL — Lead Status Funnel": pure hs_lead_status breakdown, never consults lifecyclestage.
export function MQLLeadStatusFunnel({ data }: { data: WeekMetrics }) {
  const mqls = num(data, 'mqls_total')

  let breakdown: Record<string, { working: number; linkedinAds: number; website: number; total: number }> = {}
  try {
    const raw = data['lead_status_stage_breakdown']?.value
    if (raw) breakdown = JSON.parse(raw)
  } catch {}

  let leadStatus: { new: number; working: number; demo_booked: number; demo_completed: number; junk: number } = { new: 0, working: 0, demo_booked: 0, demo_completed: 0, junk: 0 }
  try {
    const raw = data['lead_status_breakdown']?.value
    if (raw) leadStatus = JSON.parse(raw)
  } catch {}

  // Activity-based meetings for the selected dates (booked in the period / held in the period). Falls back to the lead-cohort
  // meetings_funnel, then to lead status, only if unavailable.
  let meetings: { booked: number; completed: number; completed_confirmed: number; held_unconfirmed: number; no_show: number; upcoming: number; canceled_only?: number; details: MeetingRow[] } | null = null
  try {
    const raw = data['meetings_activity']?.value || data['meetings_funnel']?.value
    if (raw && raw !== 'null') meetings = JSON.parse(raw)
  } catch {}
  const bookedRows = meetings ? meetings.details.filter(d => d.booked !== false) : []
  const completedRows = meetings ? meetings.details.filter(d => d.status === 'completed' || d.status === 'held') : []

  // Source split under the two meeting-based rows must come from the same meetings population (not hs_lead_status).
  if (meetings) {
    const split = (rows: MeetingRow[]) => {
      const ads = rows.filter(r => r.ads).length
      return { working: 0, linkedinAds: ads, website: rows.length - ads, total: rows.length }
    }
    breakdown = {
      ...breakdown,
      demo_booked: split(bookedRows),
      demo_completed: split(completedRows),
    }
  }

  const subStages: FunnelStage[] = [
    { label: 'New', value: leadStatus.new || 0, color: '#3D5A8C', ofLabel: 'of MQL', ofBase: mqls || 0, breakdownKey: 'new' },
    { label: 'Working', value: leadStatus.working || 0, color: '#8A6152', ofLabel: 'of MQL', ofBase: mqls || 0, breakdownKey: 'working' },
    // Demo Booked / Demo Completed come from the HubSpot MEETINGS object (outcome + the SDR's meeting notes), not from
    // hs_lead_status - falls back to the lead-status numbers only if the meetings data is unavailable.
    {
      label: 'Demo Booked', value: meetings ? meetings.booked : (leadStatus.demo_booked || 0), color: '#B9822E', ofLabel: 'of MQL', ofBase: mqls || 0, breakdownKey: 'demo_booked',
      hoverRows: meetings ? bookedRows : undefined, hoverTitle: 'Demo booked - meetings booked in this period, with company, use case and latest SDR note',
    },
    {
      label: 'Demo Completed', value: meetings ? meetings.completed : (leadStatus.demo_completed || 0), color: '#A06E5B', ofLabel: 'of MQL', ofBase: mqls || 0, breakdownKey: 'demo_completed',
      hoverRows: meetings ? completedRows : undefined,
      hoverTitle: 'Demo completed - meetings that took place in this period, with the SDR\'s latest note',
      hoverFooter: meetings
        ? `${meetings.completed_confirmed} confirmed Completed in HubSpot; ${meetings.held_unconfirmed} took place but nobody set the meeting outcome (counted, since they were not cancelled, rescheduled or marked no-show). Unique leads from marketing forms; counted in the period the meeting happened, whenever the lead came in.`
        : undefined,
    },
    { label: 'Junk/Unqualified', value: leadStatus.junk || 0, color: '#BE4A3C', ofLabel: 'of MQL', ofBase: mqls || 0, breakdownKey: 'junk' },
  ]
  subStages.sort((a, b) => b.value - a.value)

  const stages: FunnelStage[] = [
    { label: 'MQL', value: mqls || 0, color: '#5B3A34', breakdownKey: 'mqls' },
    ...subStages,
  ]

  if (!(mqls > 0)) return null
  return <FunnelTable stages={stages} breakdown={breakdown} />
}

// "MQL — Lifecycle Status Funnel": pure lifecyclestage breakdown (current-stage-exact, same
// SQL_EXACT/OPP_EXACT definition as the rest of the dashboard), never consults hs_lead_status.
// Kept in natural funnel order (not sorted by value) since MQL -> SQL -> Opportunity -> Customer
// is a genuine progression, unlike the lead-status sub-stages above.
export function MQLLifecycleStatusFunnel({ data }: { data: WeekMetrics }) {
  const mqls = num(data, 'mqls_total')

  let breakdown: Record<string, { working: number; linkedinAds: number; website: number; total: number }> = {}
  try {
    const raw = data['lifecycle_status_stage_breakdown']?.value
    if (raw) breakdown = JSON.parse(raw)
  } catch {}

  let lifecycleStatus: { mql: number; sql: number; opportunity: number; customer: number } = { mql: 0, sql: 0, opportunity: 0, customer: 0 }
  try {
    const raw = data['lifecycle_status_breakdown']?.value
    if (raw) lifecycleStatus = JSON.parse(raw)
  } catch {}

  // SQL / Opportunity are activity-based (marketing leads that reached the stage in the selected dates, whenever the lead came in),
  // the same numbers as the Summary cards. Falls back to the cohort lifecycle counts if the activity data is unavailable.
  let act: { sql: { count: number; ads: number }; opportunity: { count: number; ads: number } } | null = null
  try { const raw = data['pipeline_activity_counts']?.value; if (raw && raw !== 'null') act = JSON.parse(raw) } catch {}
  if (act) {
    breakdown = {
      ...breakdown,
      sql: { working: 0, linkedinAds: act.sql.ads, website: act.sql.count - act.sql.ads, total: act.sql.count },
      opportunity: { working: 0, linkedinAds: act.opportunity.ads, website: act.opportunity.count - act.opportunity.ads, total: act.opportunity.count },
    }
  }
  let leadLists: { sql: HoverLead[]; opportunity: HoverLead[] } | null = null
  try { const raw = data['pipeline_activity_leads']?.value; if (raw && raw !== 'null') leadLists = JSON.parse(raw) } catch {}
  const sqlCount = act ? act.sql.count : (lifecycleStatus.sql || 0)
  const oppCount = act ? act.opportunity.count : (lifecycleStatus.opportunity || 0)

  const stages: FunnelStage[] = [
    { label: 'MQL', value: mqls || 0, color: '#5B3A34', breakdownKey: 'mqls' },
    {
      label: 'SQL', value: sqlCount, color: '#C96A5A', ofLabel: 'of MQL', ofBase: mqls || 0, breakdownKey: 'sql',
      leadRows: act && leadLists ? leadLists.sql : undefined,
      hoverTitle: 'SQLs - marketing leads that entered SQL or moved to Opportunity in this period, with channel source',
      hoverFooter: 'Counted in the period it happened, whenever the lead itself came in. Stages HubSpot copied from the company record are excluded.',
    },
    {
      label: 'Opportunity', value: oppCount, color: '#3D5A8C', ofLabel: 'of MQL', ofBase: mqls || 0, breakdownKey: 'opportunity',
      leadRows: act && leadLists ? leadLists.opportunity : undefined,
      hoverTitle: 'Opportunities - marketing leads with a Studio deal created in this period, with channel source',
      hoverFooter: 'Deal-based, like the Executive Dashboard: marketing-sourced Studio Deals created in the selected dates, linked to a lead from a marketing form.',
    },
    { label: 'Customer', value: lifecycleStatus.customer || 0, color: '#3E7A55', ofLabel: 'of MQL', ofBase: mqls || 0, breakdownKey: 'customer' },
  ]

  if (!(mqls > 0)) return null
  return <FunnelTable stages={stages} breakdown={breakdown} />
}

