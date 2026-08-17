'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, Minus, Repeat, CreditCard, XCircle, DollarSign, BarChart3, ArrowRight, Users, Layers, AppWindow } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WeekMetrics } from '@/hooks/useWeeklyMetrics'

type Props = { data: WeekMetrics; prevData: WeekMetrics }

function fmt(value: string, unit: 'number' | 'currency'): string {
  if (!value && value !== '0') return '—'
  const n = parseFloat(value)
  if (isNaN(n)) return value
  if (unit === 'currency') {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
    return `$${n.toLocaleString()}`
  }
  return n.toLocaleString()
}

function delta(cur: string, prev: string) {
  const c = parseFloat(cur), p = parseFloat(prev)
  if (isNaN(c) || isNaN(p) || p === 0) return null
  const pct = Math.round(((c - p) / p) * 100)
  return { pct, dir: pct > 0 ? 'up' as const : pct < 0 ? 'down' as const : 'flat' as const }
}

type CardDef = {
  key: string
  label: string
  icon: React.ReactNode
  unit: 'number' | 'currency'
  accentColor: string
  accentBg: string
}

function SimpleCard({ card, data, prevData }: { card: CardDef; data: WeekMetrics; prevData: WeekMetrics }) {
  const val = data[card.key]?.value ?? ''
  const prev = prevData[card.key]?.value ?? ''
  const d = delta(val, prev)
  const hasValue = val !== '' && val !== undefined
  return (
    <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)] hover:shadow-[0_8px_40px_rgba(40,20,10,.13)] hover:-translate-y-1 transition-all duration-200">
      <div className="inline-flex items-center justify-center rounded-full p-2 mb-3" style={{ background: card.accentBg, color: card.accentColor }}>{card.icon}</div>
      <p className="eyebrow mb-2">{card.label}</p>
      <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">
        {hasValue ? fmt(val, card.unit) : '—'}
      </p>
      {d && (
        <div className={cn('mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', d.dir === 'up' && 'delta-up', d.dir === 'down' && 'delta-down', d.dir === 'flat' && 'delta-flat')}>
          {d.dir === 'up' && <TrendingUp className="h-3 w-3" />}
          {d.dir === 'down' && <TrendingDown className="h-3 w-3" />}
          {d.dir === 'flat' && <Minus className="h-3 w-3" />}
          {d.dir === 'up' ? '+' : ''}{d.pct}% WoW
        </div>
      )}
      {prev && <p className="caption mt-1">Prev: {fmt(prev, card.unit)}</p>}
    </div>
  )
}

/** MRR card with Week / Month / Lifetime toggle */
function MRRCard({ data, prevData }: { data: WeekMetrics; prevData: WeekMetrics }) {
  const [view, setView] = useState<'week' | 'month' | 'lifetime'>('week')

  const keyMap = {
    week: 'mrr',
    month: 'mrr_month',
    lifetime: 'lifetime_revenue',
  }

  const val = data[keyMap[view]]?.value ?? ''
  const prev = prevData[keyMap[view]]?.value ?? ''
  const d = view !== 'lifetime' ? delta(val, prev) : null
  const hasValue = val !== '' && val !== undefined

  return (
    <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)] hover:shadow-[0_8px_40px_rgba(40,20,10,.13)] hover:-translate-y-1 transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <div className="inline-flex items-center justify-center rounded-full p-2" style={{ background: 'rgba(22,163,74,.08)', color: '#16A34A' }}>
          <DollarSign className="h-4 w-4" />
        </div>
        {/* Toggle */}
        <div className="flex rounded-full border border-[#D4CBC0] overflow-hidden text-[10px] font-[600]">
          {(['week', 'month', 'lifetime'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                'px-2 py-0.5 capitalize transition-colors',
                view === v ? 'bg-[#6B4C4C] text-[#F9F5F1]' : 'text-[#7A6A60] hover:bg-[#F2EDE8]'
              )}
            >
              {v === 'lifetime' ? 'All' : v === 'week' ? 'Wk' : 'Mo'}
            </button>
          ))}
        </div>
      </div>
      <p className="eyebrow mb-2">MRR{view === 'lifetime' ? ' / Lifetime Revenue' : ''}</p>
      <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">
        {hasValue ? fmt(val, 'currency') : '—'}
      </p>
      {d && (
        <div className={cn('mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', d.dir === 'up' && 'delta-up', d.dir === 'down' && 'delta-down', d.dir === 'flat' && 'delta-flat')}>
          {d.dir === 'up' && <TrendingUp className="h-3 w-3" />}
          {d.dir === 'down' && <TrendingDown className="h-3 w-3" />}
          {d.dir === 'flat' && <Minus className="h-3 w-3" />}
          {d.dir === 'up' ? '+' : ''}{d.pct}% vs prev
        </div>
      )}
      {view === 'lifetime' && <p className="caption mt-1 italic">Total revenue collected (all-time)</p>}
    </div>
  )
}

const CORE_CARDS: CardDef[] = [
  { key: 'ltr', label: 'LTR', icon: <Repeat className="h-4 w-4" />, unit: 'number', accentColor: '#6B4C4C', accentBg: 'rgba(107,76,76,.08)' },
  { key: 'total_paid_subs', label: 'Total Paid Subs', icon: <CreditCard className="h-4 w-4" />, unit: 'number', accentColor: '#2563EB', accentBg: 'rgba(37,99,235,.08)' },
  { key: 'cancelled_subs', label: 'Cancelled Subs', icon: <XCircle className="h-4 w-4" />, unit: 'number', accentColor: '#DC2626', accentBg: 'rgba(220,38,38,.08)' },
  { key: 'arr', label: 'ARR', icon: <BarChart3 className="h-4 w-4" />, unit: 'currency', accentColor: '#D97706', accentBg: 'rgba(217,119,6,.08)' },
  { key: 'studio_plan_to_app', label: 'Studio Plan → App', icon: <ArrowRight className="h-4 w-4" />, unit: 'number', accentColor: '#7C3AED', accentBg: 'rgba(124,58,237,.08)' },
]

const USER_CARDS: CardDef[] = [
  { key: 'total_users', label: 'Total Users', icon: <Users className="h-4 w-4" />, unit: 'number', accentColor: '#6B4C4C', accentBg: 'rgba(107,76,76,.08)' },
  { key: 'studio_users', label: 'Studio Users', icon: <Layers className="h-4 w-4" />, unit: 'number', accentColor: '#2563EB', accentBg: 'rgba(37,99,235,.08)' },
  { key: 'apps_built', label: 'Apps Built', icon: <AppWindow className="h-4 w-4" />, unit: 'number', accentColor: '#16A34A', accentBg: 'rgba(22,163,74,.08)' },
  { key: 'lifetime_revenue', label: 'Lifetime Revenue', icon: <DollarSign className="h-4 w-4" />, unit: 'currency', accentColor: '#D97706', accentBg: 'rgba(217,119,6,.08)' },
]

export function ArchitectScoreCards({ data, prevData }: Props) {
  return (
    <div className="space-y-4">
      {/* Row 1: Users + Lifetime Revenue */}
      <div>
        <p className="eyebrow px-1 mb-2">Users & Revenue</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {USER_CARDS.map(card => (
            <SimpleCard key={card.key} card={card} data={data} prevData={prevData} />
          ))}
        </div>
      </div>

      {/* Row 2: Core metrics + MRR toggle */}
      <div>
        <p className="eyebrow px-1 mb-2">Subscriptions & Revenue</p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {CORE_CARDS.map(card => (
            <SimpleCard key={card.key} card={card} data={data} prevData={prevData} />
          ))}
          <MRRCard data={data} prevData={prevData} />
        </div>
      </div>
    </div>
  )
}
