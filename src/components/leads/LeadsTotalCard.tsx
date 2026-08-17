'use client'

import { TrendingUp, TrendingDown, Minus, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WeekMetrics } from '@/hooks/useWeeklyMetrics'

type Props = {
  data: WeekMetrics
  prevData: WeekMetrics
  totalWithStudio?: number
  studioCount?: number
  prevTotalWithStudio?: number
}

function num(data: WeekMetrics, key: string): number {
  const n = parseFloat(data[key]?.value ?? '')
  return isNaN(n) ? 0 : n
}

function Delta({ current, prev, label }: { current: number; prev: number; label: string }) {
  const diff   = prev > 0 ? Math.round(((current - prev) / prev) * 100) : 0
  const dir    = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {prev > 0 && (
        <div className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
          dir === 'up' && 'delta-up',
          dir === 'down' && 'delta-down',
          dir === 'flat' && 'delta-flat',
        )}>
          {dir === 'up' && <TrendingUp className="h-3 w-3" />}
          {dir === 'down' && <TrendingDown className="h-3 w-3" />}
          {dir === 'flat' && <Minus className="h-3 w-3" />}
          {dir === 'up' ? '+' : ''}{diff}% vs prev week
        </div>
      )}
      {prev > 0 && <span className="text-[12px] text-[#7A6A60]">Prev: {prev.toLocaleString()}</span>}
      <span className="text-[11px] text-[#7A6A60]">{label}</span>
    </div>
  )
}

export function LeadsTotalCard({ data, prevData, totalWithStudio = 0, studioCount = 0, prevTotalWithStudio = 0 }: Props) {
  const current = num(data, 'leads_total')          // without Agent Studio
  const prev    = num(prevData, 'leads_total')

  return (
    <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-6 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
      <div className="flex items-center gap-3 mb-5">
        <div className="inline-flex items-center justify-center rounded-full p-2.5 bg-[rgba(107,76,76,.08)] text-[#6B4C4C]">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <p className="eyebrow">Total Leads</p>
          <p className="text-[11px] text-[#7A6A60]">HubSpot — all sources this week · excl. Book a Demo &amp; Agent Studio</p>
        </div>
      </div>

      {/* Primary number — without Agent Studio */}
      <p className="font-['Playfair_Display'] font-[500] text-[2.5rem] leading-[1.1] tracking-[-0.02em] text-[#2A1F1A]">
        {current > 0 ? current.toLocaleString() : '—'}
      </p>
      <div className="mt-2">
        <Delta current={current} prev={prev} label="excl. Agent Studio" />
      </div>

      {/* Comparison row — with Agent Studio */}
      {studioCount > 0 && (
        <div className="mt-4 pt-4 border-t border-[#F2EDE8]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-[#7A6A60] uppercase tracking-wider font-[500] mb-1">With Agent Studio</p>
              <p className="text-[1.6rem] font-['Playfair_Display'] font-[500] text-[#6B4C4C]">
                {totalWithStudio.toLocaleString()}
              </p>
              <div className="mt-1">
                <Delta current={totalWithStudio} prev={prevTotalWithStudio} label="incl. Agent Studio" />
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-[#7A6A60] uppercase tracking-wider font-[500] mb-1">Agent Studio alone</p>
              <p className="text-[1.6rem] font-['Playfair_Display'] font-[500] text-[#8A6060]">
                {studioCount.toLocaleString()}
              </p>
              <p className="text-[11px] text-[#7A6A60] mt-0.5">
                {totalWithStudio > 0 ? Math.round((studioCount / totalWithStudio) * 100) : 0}% of total
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
