'use client'

import { CreditCard } from 'lucide-react'
import type { WeekMetrics } from '@/hooks/useWeeklyMetrics'

type Props = { data: WeekMetrics }

const PLANS = [
  { key: 'active_40_monthly', label: '$40/mon', period: 'Monthly' },
  { key: 'active_20_monthly', label: '$20/mon', period: 'Monthly' },
  { key: 'active_420_yearly', label: '$420/yr', period: 'Yearly' },
  { key: 'active_200_yearly', label: '$200/yr', period: 'Yearly' },
]

function num(data: WeekMetrics, key: string): number {
  const n = parseFloat(data[key]?.value ?? '')
  return isNaN(n) ? 0 : n
}

export function ArchitectSubscriptions({ data }: Props) {
  const totalActive = num(data, 'total_active_subs')
  const hasAny = totalActive > 0 || PLANS.some(p => num(data, p.key) > 0)

  return (
    <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
      <div className="flex items-center gap-2 mb-4">
        <div className="inline-flex items-center justify-center rounded-full p-2 bg-[rgba(37,99,235,.08)] text-[#2563EB]">
          <CreditCard className="h-4 w-4" />
        </div>
        <p className="eyebrow">Subscriptions</p>
      </div>

      {!hasAny ? (
        <p className="text-[13px] text-[#7A6A60]">No subscription data entered yet</p>
      ) : (
        <div className="space-y-4">
          {/* Total active */}
          <div className="flex items-baseline justify-between border-b border-[#D4CBC0]/50 pb-3">
            <span className="text-[14px] font-[600] text-[#2A1F1A]">Total Active Subscriptions</span>
            <span className="font-['Playfair_Display'] font-[500] text-[1.5rem] text-[#2A1F1A]">
              {totalActive > 0 ? totalActive.toLocaleString() : '—'}
            </span>
          </div>

          {/* Plan breakdown */}
          <div className="grid grid-cols-2 gap-3">
            {PLANS.map(plan => {
              const count = num(data, plan.key)
              return (
                <div key={plan.key} className="rounded-[12px] bg-[#F9F5F1] p-3">
                  <p className="text-[11px] text-[#7A6A60] mb-1">{plan.label}</p>
                  <p className="text-[18px] font-[600] text-[#2A1F1A]">
                    {count > 0 ? `${count} users` : '—'}
                  </p>
                  <p className="text-[10px] text-[#7A6A60]">{plan.period}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
