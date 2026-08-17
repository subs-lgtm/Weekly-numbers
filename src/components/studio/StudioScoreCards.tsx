'use client'

import { TrendingUp, TrendingDown, Minus, Users, CalendarDays, Calendar, Infinity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWeeklyMetrics } from '@/hooks/useWeeklyMetrics'
import { useWeek } from '@/lib/week-context'
import type { WeekMetrics } from '@/hooks/useWeeklyMetrics'

type Props = { data: WeekMetrics; prevData: WeekMetrics }

function num(data: WeekMetrics, key: string): number {
  const n = parseFloat(data[key]?.value ?? '')
  return isNaN(n) ? 0 : n
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function delta(cur: number, prev: number) {
  if (prev === 0) return null
  const pct = Math.round(((cur - prev) / prev) * 100)
  return { pct, dir: pct > 0 ? 'up' as const : pct < 0 ? 'down' as const : 'flat' as const }
}

type CardProps = {
  label: string
  value: number
  prevValue?: number
  icon: React.ReactNode
  accentColor: string
  accentBg: string
  subtitle?: string
}

function Card({ label, value, prevValue, icon, accentColor, accentBg, subtitle }: CardProps) {
  const d = prevValue !== undefined ? delta(value, prevValue) : null
  return (
    <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)] hover:shadow-[0_8px_40px_rgba(40,20,10,.13)] hover:-translate-y-1 transition-all duration-200">
      <div className="inline-flex items-center justify-center rounded-full p-2 mb-3" style={{ background: accentBg, color: accentColor }}>
        {icon}
      </div>
      <p className="eyebrow mb-2">{label}</p>
      <p className="font-['Playfair_Display'] font-[500] text-[2rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">
        {value > 0 ? fmt(value) : '—'}
      </p>
      {subtitle && <p className="caption mt-1">{subtitle}</p>}
      {d && (
        <div className={cn('mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', d.dir === 'up' && 'delta-up', d.dir === 'down' && 'delta-down', d.dir === 'flat' && 'delta-flat')}>
          {d.dir === 'up' && <TrendingUp className="h-3 w-3" />}
          {d.dir === 'down' && <TrendingDown className="h-3 w-3" />}
          {d.dir === 'flat' && <Minus className="h-3 w-3" />}
          {d.dir === 'up' ? '+' : ''}{d.pct}% vs prev
        </div>
      )}
      {prevValue !== undefined && prevValue > 0 && (
        <p className="caption mt-1">Prev: {fmt(prevValue)}</p>
      )}
    </div>
  )
}

export function StudioScoreCards({ data, prevData }: Props) {
  const { weekStart, range } = useWeek()

  // Lifetime signups is a SNAPSHOT metric — always fetch from the anchor week directly,
  // never sum across weeks (that would double-count).
  const { data: anchorWeekData } = useWeeklyMetrics('studio-signups', weekStart)
  const lifetimeSignups = num(anchorWeekData, 'lifetime_signups')

  const totalUsers = num(data, 'total_users')
  const prevTotalUsers = num(prevData, 'total_users')
  const signupsLastWeek = num(data, 'signups_last_week')
  const prevSignupsLastWeek = num(prevData, 'signups_last_week')
  const signupsMTD = num(data, 'signups_mtd')
  const prevSignupsMTD = num(prevData, 'signups_mtd')

  // Label adapts to the selected period
  const totalUsersLabel = range.mode === 'week'
    ? 'Total Users'
    : `Total Users (${range.label})`

  const signupsLabel = range.mode === 'week'
    ? 'Signups Last Week'
    : `Signups (${range.label})`

  const momLabel = range.mode === 'week'
    ? 'Signups MoM'
    : `Signups MoM (${range.label})`

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Card
        label={totalUsersLabel}
        value={totalUsers}
        prevValue={prevTotalUsers}
        icon={<Users className="h-4 w-4" />}
        accentColor="#6B4C4C"
        accentBg="rgba(107,76,76,.08)"
      />
      <Card
        label={signupsLabel}
        value={signupsLastWeek}
        prevValue={prevSignupsLastWeek}
        icon={<CalendarDays className="h-4 w-4" />}
        accentColor="#2563EB"
        accentBg="rgba(37,99,235,.08)"
      />
      <Card
        label={momLabel}
        value={signupsMTD}
        prevValue={prevSignupsMTD}
        icon={<Calendar className="h-4 w-4" />}
        accentColor="#16A34A"
        accentBg="rgba(22,163,74,.08)"
      />
      <Card
        label="Lifetime Total Signups"
        value={lifetimeSignups}
        icon={<Infinity className="h-4 w-4" />}
        accentColor="#D97706"
        accentBg="rgba(217,119,6,.08)"
        subtitle={`Snapshot as of week of ${weekStart}`}
      />
    </div>
  )
}
