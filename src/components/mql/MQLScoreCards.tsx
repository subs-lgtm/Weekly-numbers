'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus, Users, CheckCircle, CalendarCheck, Percent, ArrowRight, CalendarDays, Activity, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WeekMetrics } from '@/hooks/useWeeklyMetrics'
import { getDb } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

type Props = {
  data: WeekMetrics
  prevData: WeekMetrics
  /** Month-to-date total MQLs (live from HubSpot, calendar month up to today) */
  monthToDateTotal?: number | null
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

function QualifiedMQLsCard({ value, prevValue, totalMqls }: { value: string; prevValue: string; totalMqls: string }) {
  const delta = getDelta(value, prevValue)
  const hasValue = value !== '' && value !== undefined
  const totalVal = parseFloat(totalMqls) || 0
  const qualVal = parseFloat(value) || 0
  const pctOfTotal = totalVal > 0 ? Math.round((qualVal / totalVal) * 100) : 0

  return (
    <div className={CARD_CLS}>
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
    </div>
  )
}

function MeetingBookedCard({ value, prevValue }: { value: string; prevValue: string }) {
  const delta = getDelta(value, prevValue)
  const hasValue = value !== '' && value !== undefined
  const total = parseFloat(value) || 0

  return (
    <div className={CARD_CLS}>
      <div className="inline-flex items-center justify-center rounded-full p-2 mb-3" style={{ background: 'rgba(37,99,235,.08)', color: '#2563EB' }}>
        <CalendarCheck className="h-4 w-4" />
      </div>
      <p className="eyebrow mb-2">Meeting Booked</p>
      <p className="font-['Playfair_Display'] font-[500] text-[2rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">
        {hasValue ? total.toLocaleString() : '—'}
      </p>
      <DeltaPill delta={delta} suffix="WoW" />
      {prevValue && <p className="caption mt-1">prev {prevValue}</p>}
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
export function TotalMQLSummaryCards({ data, prevData }: Props) {
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
      <QualifiedMQLsCard value={data['mqls_qualified']?.value ?? ''} prevValue={prevData['mqls_qualified']?.value ?? ''} totalMqls={data['mqls_total']?.value ?? ''} />
      <MeetingBookedCard value={data['meeting_booked']?.value ?? ''} prevValue={prevData['meeting_booked']?.value ?? ''} />
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
   QUALIFICATION FUNNEL — matches reference HTML "MQL Qualification Funnel"
   section: MQL → Qualified → Working → SQL → Opportunity → Customer
   ========================================================================= */

export function QualificationFunnel({ data }: { data: WeekMetrics }) {
  const mqls = num(data, 'mqls_total')
  const working = num(data, 'working_mqls')
  const sql = num(data, 'sql_count')
  const demoBooked = num(data, 'demo_booked_count')
  const demoCompleted = num(data, 'demo_completed_count')

  let breakdown: Record<string, { working: number; linkedinAds: number; website: number; total: number }> = {}
  try {
    const raw = data['stage_breakdown']?.value
    if (raw) breakdown = JSON.parse(raw)
  } catch {}

  let mqlStatus: { new: number; working: number; demo_booked: number; demo_completed: number; sql: number; junk: number } = { new: 0, working: 0, demo_booked: 0, demo_completed: 0, sql: 0, junk: 0 }
  try {
    const raw = data['mql_status_breakdown']?.value
    if (raw) mqlStatus = JSON.parse(raw)
  } catch {}

  const subStages = [
    { label: 'New', value: mqlStatus.new || 0, color: '#3D5A8C', ofLabel: 'of MQL', ofBase: mqls || 0, breakdownKey: 'new' },
    { label: 'Working', value: mqlStatus.working || 0, color: '#8A6152', ofLabel: 'of MQL', ofBase: mqls || 0, breakdownKey: 'working' },
    { label: 'Demo Booked', value: mqlStatus.demo_booked || 0, color: '#B9822E', ofLabel: 'of MQL', ofBase: mqls || 0, breakdownKey: 'demo_booked' },
    { label: 'Demo Completed', value: mqlStatus.demo_completed || 0, color: '#A06E5B', ofLabel: 'of MQL', ofBase: mqls || 0, breakdownKey: 'demo_completed' },
    { label: 'SQL', value: mqlStatus.sql || 0, color: '#C96A5A', ofLabel: 'of MQL', ofBase: mqls || 0, breakdownKey: 'sql' },
    { label: 'Junk/Unqualified', value: mqlStatus.junk || 0, color: '#BE4A3C', ofLabel: 'of MQL', ofBase: mqls || 0, breakdownKey: 'junk' },
  ]
  // Sort sub-stages dynamically in descending order of value
  subStages.sort((a, b) => b.value - a.value)

  const stages = [
    { label: 'MQL', value: mqls || 0, color: '#5B3A34', breakdownKey: 'mqls' },
    ...subStages
  ]

  const hasAnyFunnelData = mqls > 0
  if (!hasAnyFunnelData) return null

  const maxVal = Math.max(...stages.map(s => s.value), 1)

  return (
    <div className="card">
      <div className="funnel-labels"><div>Stage</div><div /><div style={{ textAlign: 'right' }}>Count</div><div style={{ textAlign: 'right' }}>Conversion</div><div style={{ textAlign: 'right' }}>Drop-off</div></div>
      <div className="funnel-wrap" style={{ gap: '20px' }}>
        {stages.map((stage, i) => {
          const pct = Math.max((stage.value / maxVal) * 100, stage.value > 0 ? 4 : 0)
          const conv = i === 0 ? 100 : (stage as any).ofBase > 0 ? Math.round((stage.value / (stage as any).ofBase) * 100) : 0
          const drop = i === 0 ? null : 100 - conv
          const bd = breakdown[stage.breakdownKey]
          const isMql = stage.label === 'MQL'

          return (
            <div key={stage.label}>
              <div className="funnel-stage">
                <div className="funnel-name">{stage.label}</div>
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
                  {(stage as any).ofLabel && <small style={{ fontWeight: 400, color: '#7A6A60' }}> {(stage as any).ofLabel}</small>}
                </div>
                <div className="funnel-drop">{drop === null ? '—' : `${drop}%`}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
