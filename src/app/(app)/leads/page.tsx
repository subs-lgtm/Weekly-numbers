'use client'

import { useState, useMemo, useEffect } from 'react'
import { SectionShell } from '@/components/SectionShell'
import { SECTION_MAP } from '@/lib/metrics-config'
import { useWeek } from '@/lib/week-context'
import { LeadFunnelCard } from '@/components/leads/LeadFunnelCard'
import { LeadCategoriesPerformance } from '@/components/leads/LeadCategoriesPerformance'
import { LeadsComparisonCards } from '@/components/leads/LeadsComparisonCards'
import { LeadsWoWChart } from '@/components/leads/LeadsWoWChart'
import { LeadsMoMChart } from '@/components/leads/LeadsMoMChart'
import { LeadsDetailsTable } from '@/components/leads/LeadsDetailsTable'
import { format, subWeeks, subMonths, startOfMonth, endOfMonth, addDays } from 'date-fns'

function LeadsPageInner() {
  const { weekStart, queryStart, queryEnd } = useWeek()

  // MoM: compare the month the selected week falls in vs the previous month
  const selectedDate = useMemo(() => new Date(weekStart + 'T00:00:00'), [weekStart])
  const currentMonth = useMemo(() => startOfMonth(selectedDate), [selectedDate])
  const prevMonth = useMemo(() => subMonths(currentMonth, 1), [currentMonth])

  const currentMonthStart = useMemo(() => format(currentMonth, 'yyyy-MM-dd'), [currentMonth])
  const currentMonthEnd = useMemo(() => format(addDays(endOfMonth(currentMonth), 1), 'yyyy-MM-dd'), [currentMonth])
  const prevMonthStart = useMemo(() => format(prevMonth, 'yyyy-MM-dd'), [prevMonth])
  const prevMonthEnd = useMemo(() => format(addDays(endOfMonth(prevMonth), 1), 'yyyy-MM-dd'), [prevMonth])

  const [data, setData] = useState<{
    currWeek: any
    prevWeek: any
    currMonth: any
    prevMonth: any
  } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    const prevWeekStart = format(subWeeks(new Date(weekStart + 'T00:00:00'), 1), 'yyyy-MM-dd')
    
    Promise.all([
      fetch(`/api/hubspot/mqls?start=${queryStart}&end=${queryEnd}&mode=all`).then(r => r.json()),
      fetch(`/api/hubspot/mqls?start=${prevWeekStart}&end=${queryStart}&mode=all`).then(r => r.json()),
      fetch(`/api/hubspot/mqls?start=${currentMonthStart}&end=${currentMonthEnd}&mode=all`).then(r => r.json()),
      fetch(`/api/hubspot/mqls?start=${prevMonthStart}&end=${prevMonthEnd}&mode=all`).then(r => r.json()),
    ]).then(([currW, prevW, currM, prevM]) => {
      setData({
        currWeek: currW,
        prevWeek: prevW,
        currMonth: currM,
        prevMonth: prevM,
      })
      setLoading(false)
    }).catch((e) => {
      console.error('[LeadsPageInner] Fetch failed:', e)
      setLoading(false)
    })
  }, [weekStart, queryStart, queryEnd, currentMonthStart, currentMonthEnd, prevMonthStart, prevMonthEnd])

  const currWeekContacts = useMemo(() => {
    if (!data?.currWeek) return []
    const priorities = ['high', 'medium', 'low', 'unknown']
    const contacts = []
    for (const p of priorities) {
      if (data.currWeek.contacts_by_priority?.[p]) {
        contacts.push(...data.currWeek.contacts_by_priority[p])
      }
    }
    return contacts.filter(c => c.formType !== 'Agent Studio')
  }, [data])

  const prevWeekContacts = useMemo(() => {
    if (!data?.prevWeek) return []
    const priorities = ['high', 'medium', 'low', 'unknown']
    const contacts = []
    for (const p of priorities) {
      if (data.prevWeek.contacts_by_priority?.[p]) {
        contacts.push(...data.prevWeek.contacts_by_priority[p])
      }
    }
    return contacts.filter(c => c.formType !== 'Agent Studio')
  }, [data])

  const currMonthContacts = useMemo(() => {
    if (!data?.currMonth) return []
    const priorities = ['high', 'medium', 'low', 'unknown']
    const contacts = []
    for (const p of priorities) {
      if (data.currMonth.contacts_by_priority?.[p]) {
        contacts.push(...data.currMonth.contacts_by_priority[p])
      }
    }
    return contacts.filter(c => c.formType !== 'Agent Studio')
  }, [data])

  const prevMonthContacts = useMemo(() => {
    if (!data?.prevMonth) return []
    const priorities = ['high', 'medium', 'low', 'unknown']
    const contacts = []
    for (const p of priorities) {
      if (data.prevMonth.contacts_by_priority?.[p]) {
        contacts.push(...data.prevMonth.contacts_by_priority[p])
      }
    }
    return contacts.filter(c => c.formType !== 'Agent Studio')
  }, [data])

  const contactsByPriority = useMemo(() => {
    const raw = data?.currWeek?.contacts_by_priority || { high: [], medium: [], low: [], unknown: [] }
    const EXCLUDED_FORMS = new Set(['Agent Studio', 'Book a Demo', 'Email Form', 'Pre-Built Agents'])
    return {
      high: (raw.high || []).filter((c: any) => !EXCLUDED_FORMS.has(c.formType)),
      medium: (raw.medium || []).filter((c: any) => !EXCLUDED_FORMS.has(c.formType)),
      low: (raw.low || []).filter((c: any) => !EXCLUDED_FORMS.has(c.formType)),
      unknown: (raw.unknown || []).filter((c: any) => !EXCLUDED_FORMS.has(c.formType)),
    }
  }, [data])

  if (loading || !data) {
    return (
      <div className="rounded-[20px] border border-[#D4CBC0] bg-[#F9F5F1] p-8 text-center flex items-center justify-center gap-3">
        <div className="w-5 h-5 border-2 border-[#6B4C4C] border-t-transparent rounded-full animate-spin" />
        <p className="text-[14px] text-[#7A6A60]">Loading live data from HubSpot…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. Lead Categories Performance */}
      <LeadCategoriesPerformance
        currWeek={{ contacts: currWeekContacts, byFormType: data.currWeek.by_form_type || {} }}
        prevWeek={{ contacts: prevWeekContacts, byFormType: data.prevWeek.by_form_type || {} }}
        currMonth={{ contacts: currMonthContacts, byFormType: data.currMonth.by_form_type || {} }}
        prevMonth={{ contacts: prevMonthContacts, byFormType: data.prevMonth.by_form_type || {} }}
      />

      {/* 2. Comparison cards — WoW and MoM */}
      <LeadsComparisonCards weekStart={weekStart} />

      {/* 3. Total Leads — WoW + MoM line graphs */}
      <div className="grid gap-4 md:grid-cols-2">
        <LeadsWoWChart
          sectionKey="leads"
          weekStart={weekStart}
          actualKey="leads_total"
          goalKey="goal_leads"
          title="WoW Trend — Total Leads"
          actualLabel="Actual Leads"
          goalLabel="Goal Leads"
        />
        <LeadsMoMChart
          sectionKey="leads"
          weekStart={weekStart}
          actualKey="leads_total"
          goalKey="goal_leads"
          title="MoM Trend — Total Leads"
          actualLabel="Actual Leads"
          goalLabel="Goal Leads"
        />
      </div>

      {/* 4. Lead Funnel */}
      <LeadFunnelCard contacts={currWeekContacts} />

      {/* 5. Leads Details Table */}
      <LeadsDetailsTable contactsByPriority={contactsByPriority} />
    </div>
  )
}

export default function Page() {
  const section = SECTION_MAP['leads']

  return (
    <SectionShell
      title={section.label}
      description={section.description}
    >
      <LeadsPageInner />
    </SectionShell>
  )
}
