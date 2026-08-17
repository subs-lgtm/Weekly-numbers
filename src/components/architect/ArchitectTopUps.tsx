'use client'

import { Zap } from 'lucide-react'
import type { WeekMetrics } from '@/hooks/useWeeklyMetrics'

type Props = { data: WeekMetrics }

const TOPUPS = [
  { key: 'topup_25_count', amount: 25, label: '$25' },
  { key: 'topup_50_count', amount: 50, label: '$50' },
  { key: 'topup_100_count', amount: 100, label: '$100' },
]

function num(data: WeekMetrics, key: string): number {
  const n = parseFloat(data[key]?.value ?? '')
  return isNaN(n) ? 0 : n
}

export function ArchitectTopUps({ data }: Props) {
  const hasAny = TOPUPS.some(t => num(data, t.key) > 0)
  const totalRevenue = TOPUPS.reduce((sum, t) => sum + num(data, t.key) * t.amount, 0)

  return (
    <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
      <div className="flex items-center gap-2 mb-4">
        <div className="inline-flex items-center justify-center rounded-full p-2 bg-[rgba(217,119,6,.08)] text-[#D97706]">
          <Zap className="h-4 w-4" />
        </div>
        <p className="eyebrow">Top-Ups</p>
        {hasAny && (
          <span className="ml-auto text-[13px] font-[600] text-[#2A1F1A]">
            Total: ${totalRevenue.toLocaleString()}
          </span>
        )}
      </div>

      {!hasAny ? (
        <p className="text-[13px] text-[#7A6A60]">No top-up data entered yet</p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {TOPUPS.map(topup => {
            const count = num(data, topup.key)
            const revenue = count * topup.amount
            return (
              <div key={topup.key} className="rounded-[12px] bg-[#F9F5F1] p-3 text-center">
                <p className="text-[11px] text-[#7A6A60] mb-1">{topup.label} Top-Up</p>
                <p className="text-[18px] font-[600] text-[#2A1F1A]">
                  {count > 0 ? `${count} times` : '—'}
                </p>
                {count > 0 && (
                  <p className="text-[12px] text-[#7A6A60] mt-0.5">${revenue.toLocaleString()}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
