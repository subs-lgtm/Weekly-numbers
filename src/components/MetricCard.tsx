'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MetricDef } from '@/lib/metrics-config'

type Props = {
  metric: MetricDef
  value: string
  prevValue: string
  onClick?: () => void
}

function formatValue(value: string, unit?: MetricDef['unit']): string {
  if (!value && value !== '0') return '—'
  if (unit === 'currency') {
    const n = parseFloat(value)
    if (isNaN(n)) return value
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
    return `$${n.toLocaleString()}`
  }
  if (unit === 'percent') return `${value}%`
  if (unit === 'number') {
    const n = parseFloat(value)
    if (isNaN(n)) return value
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
    return n.toLocaleString()
  }
  return value
}

function getDelta(current: string, prev: string): { pct: number; dir: 'up' | 'down' | 'flat' } | null {
  const c = parseFloat(current)
  const p = parseFloat(prev)
  if (isNaN(c) || isNaN(p) || p === 0) return null
  const pct = Math.round(((c - p) / p) * 100)
  return { pct, dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' }
}

export function MetricCard({ metric, value, prevValue, onClick }: Props) {
  const delta = getDelta(value, prevValue)
  const hasValue = value !== '' && value !== undefined

  return (
    <button
      onClick={onClick}
      className={cn(
        'group w-full text-left rounded-[20px] p-5 transition-all duration-200',
        'bg-[#FFFFFF] border border-[#D4CBC0]',
        'shadow-[0_4px_20px_rgba(40,20,10,.07)]',
        'hover:shadow-[0_8px_40px_rgba(40,20,10,.13)] hover:-translate-y-1',
        !hasValue && 'opacity-70'
      )}
    >
      {/* Eyebrow label */}
      <p className="eyebrow mb-3">{metric.label}</p>

      {/* Value */}
      <p
        className="font-['Playfair_Display'] font-[500] text-[2.074rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]"
      >
        {hasValue ? formatValue(value, metric.unit) : (
          <span className="text-[#D4CBC0] text-[1.2rem]">Click to enter</span>
        )}
      </p>

      {/* Delta */}
      {delta && (
        <div className={cn(
          'mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
          delta.dir === 'up'   && 'delta-up',
          delta.dir === 'down' && 'delta-down',
          delta.dir === 'flat' && 'delta-flat',
        )}>
          {delta.dir === 'up'   && <TrendingUp className="h-3 w-3" />}
          {delta.dir === 'down' && <TrendingDown className="h-3 w-3" />}
          {delta.dir === 'flat' && <Minus className="h-3 w-3" />}
          {delta.dir === 'up' ? '+' : ''}{delta.pct}% WoW
        </div>
      )}

      {/* Prev week */}
      {prevValue && (
        <p className="caption mt-1">
          Prev: {formatValue(prevValue, metric.unit)}
        </p>
      )}
    </button>
  )
}
