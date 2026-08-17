'use client'

import { useState, useMemo } from 'react'
import { BookOpen, GraduationCap, Mail, Handshake, Building2, Cloud, Briefcase, Tent, Inbox, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type LeadContact = {
  id: string
  formType: string
  lifecycleStage: string
  source: string
  status: string
}

type PeriodData = {
  contacts: LeadContact[]
  byFormType: Record<string, number>
}

type Props = {
  currWeek: PeriodData
  prevWeek: PeriodData
  currMonth: PeriodData
  prevMonth: PeriodData
}

const CATEGORY_DEFS = [
  { key: 'Playbook Download', label: 'Playbook Download', icon: BookOpen },
  { key: 'Masterclass', label: 'Masterclass', icon: GraduationCap },
  { key: 'Contact Us', label: 'Contact Us', icon: Mail },
  { key: 'Partner Form', label: 'Partner Form', icon: Handshake },
  { key: 'GSI and SI', label: 'GSI and SI', icon: Building2 },
  { key: 'AWS Partner Form', label: 'AWS Partner Form', icon: Cloud },
  { key: 'Accenture', label: 'Accenture', icon: Briefcase },
  { key: 'Booth Event', label: 'Booth Event', icon: Tent },
  { key: 'Email Form', label: 'Email Form', icon: Inbox },
]

function getMqlsCount(contacts: LeadContact[]) {
  const MQL_FORMS = new Set(['Book a Demo', 'Email Form', 'Pre-Built Agents', 'GSI and SI', 'Accenture', 'Partner Form'])
  return contacts.filter(c => {
    if (MQL_FORMS.has(c.formType)) return true
    const stage = c.lifecycleStage || ''
    return ['marketingqualifiedlead', 'salesqualifiedlead', 'opportunity', 'customer', '249550600'].includes(stage)
  }).length
}

function calculateGrowth(current: number, prev: number): { pct: number; label: string; dir: 'up' | 'down' | 'flat' } {
  if (current === 0 && prev === 0) return { pct: 0, label: '0%', dir: 'flat' }
  if (prev === 0) return { pct: 100, label: '+100%', dir: 'up' }
  const diff = current - prev
  const pct = Math.round((diff / prev) * 100)
  return {
    pct,
    label: `${pct > 0 ? '+' : ''}${pct}%`,
    dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat',
  }
}

export function LeadCategoriesPerformance({ currWeek, prevWeek, currMonth, prevMonth }: Props) {
  const [tab, setTab] = useState<'volume' | 'growth' | 'conversion'>('volume')

  const cardData = useMemo(() => {
    return CATEGORY_DEFS.map(def => {
      // 1. Current week count
      const count = currWeek.byFormType[def.key] || 0

      // 2. Weekly growth
      const prevWeekCount = prevWeek.byFormType[def.key] || 0
      const weeklyGrowth = calculateGrowth(count, prevWeekCount)

      // 3. Monthly growth
      const currMonthCount = currMonth.byFormType[def.key] || 0
      const prevMonthCount = prevMonth.byFormType[def.key] || 0
      const monthlyGrowth = calculateGrowth(currMonthCount, prevMonthCount)

      // 4. Conversion to MQL (current week)
      const catContacts = currWeek.contacts.filter(c => c.formType === def.key)
      const catMqls = getMqlsCount(catContacts)
      const convRate = catContacts.length > 0 ? Math.round((catMqls / catContacts.length) * 100) : 0

      return {
        ...def,
        count,
        weeklyGrowth,
        monthlyGrowth,
        convRate,
      }
    })
  }, [currWeek, prevWeek, currMonth, prevMonth])

  // Total top-of-funnel leads (sum of all 9 categories)
  const totalTopLeads = useMemo(() => {
    return cardData.reduce((sum, item) => sum + item.count, 0)
  }, [cardData])

  // Sort cards based on selected tab
  const sortedCards = useMemo(() => {
    const list = [...cardData]
    if (tab === 'volume') {
      return list.sort((a, b) => b.count - a.count)
    } else if (tab === 'growth') {
      return list.sort((a, b) => b.weeklyGrowth.pct - a.weeklyGrowth.pct)
    } else if (tab === 'conversion') {
      return list.sort((a, b) => b.convRate - a.convRate)
    }
    return list
  }, [cardData, tab])

  return (
    <div className="rounded-[20px] border border-[#D4CBC0] bg-[#F9F5F1] p-6 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
      {/* Header & Tabs */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
        <div>
          <h3 className="text-[16px] font-[600] text-[#2A1F1A]">Lead Categories Performance</h3>
          <p className="text-[12px] text-[#7A6A60] mt-0.5">Top-of-funnel informational leads &mdash; categories detected live from HubSpot</p>
        </div>
        
        {/* Pills */}
        <div className="flex items-center bg-[#E8E0D8]/60 p-1 rounded-full border border-[#D4CBC0]">
          {(['volume', 'growth', 'conversion'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-1.5 rounded-full text-[12px] font-[600] transition-all capitalize',
                tab === t ? 'bg-[#2A1F1A] text-white shadow-sm' : 'text-[#7A6A60] hover:text-[#2A1F1A]'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {sortedCards.map(card => {
          const Icon = card.icon
          return (
            <div key={card.key} className="rounded-[16px] border border-[#D4CBC0] bg-white p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-2 rounded-lg bg-[rgba(107,76,76,0.06)] text-[#6B4C4C]">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[13px] font-[600] text-[#2A1F1A] truncate">{card.label}</span>
                </div>

                <p className="text-[32px] font-[700] text-[#2A1F1A] leading-tight font-['Playfair_Display']">
                  {card.count.toLocaleString()}
                </p>
              </div>

              <div className="mt-4 space-y-2 pt-3 border-t border-[#F2EDE8] text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-[#7A6A60]">Weekly Growth</span>
                  <span className={cn(
                    'font-[600] inline-flex items-center gap-0.5',
                    card.weeklyGrowth.dir === 'up' && 'text-[#16A34A]',
                    card.weeklyGrowth.dir === 'down' && 'text-[#EA580C]',
                    card.weeklyGrowth.dir === 'flat' && 'text-[#7A6A60]'
                  )}>
                    {card.weeklyGrowth.dir === 'up' && <TrendingUp className="w-3 h-3" />}
                    {card.weeklyGrowth.dir === 'down' && <TrendingDown className="w-3 h-3" />}
                    {card.weeklyGrowth.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#7A6A60]">Monthly Growth</span>
                  <span className={cn(
                    'font-[600] inline-flex items-center gap-0.5',
                    card.monthlyGrowth.dir === 'up' && 'text-[#16A34A]',
                    card.monthlyGrowth.dir === 'down' && 'text-[#EA580C]',
                    card.monthlyGrowth.dir === 'flat' && 'text-[#7A6A60]'
                  )}>
                    {card.monthlyGrowth.dir === 'up' && <TrendingUp className="w-3 h-3" />}
                    {card.monthlyGrowth.dir === 'down' && <TrendingDown className="w-3 h-3" />}
                    {card.monthlyGrowth.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#7A6A60]">Conv. to MQL</span>
                  <span className="font-[600] text-[#2A1F1A]">{card.convRate}%</span>
                </div>
              </div>
            </div>
          )
        })}

        {/* Total TOP-OF-FUNNEL leads Card */}
        <div className="rounded-[16px] border border-[#2A1F1A] bg-[#2A1F1A] p-5 flex flex-col justify-center items-center text-center shadow-md">
          <p className="text-[10px] text-[#D4CBC0] uppercase tracking-widest font-[700] mb-2">Total Top-of-Funnel Leads</p>
          <p className="text-[42px] font-[700] text-white leading-tight font-['Playfair_Display']">
            {totalTopLeads.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  )
}
