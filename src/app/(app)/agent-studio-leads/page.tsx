'use client'

import { useState, useMemo, useEffect } from 'react'
import { SectionShell } from '@/components/SectionShell'
import { SECTION_MAP } from '@/lib/metrics-config'
import { useWeek } from '@/lib/week-context'
import { AgentStudioFunnelCard } from '@/components/leads/AgentStudioFunnelCard'
import { AgentStudioWoWChart } from '@/components/leads/AgentStudioWoWChart'
import { AgentStudioMoMChart } from '@/components/leads/AgentStudioMoMChart'
import { AgentStudioDetailsTable } from '@/components/leads/AgentStudioDetailsTable'

function AgentStudioLeadsPageInner() {
  const { weekStart, queryStart, queryEnd } = useWeek()

  const [data, setData] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/hubspot/mqls?start=${queryStart}&end=${queryEnd}&mode=all`)
      .then(r => r.json())
      .then((currWeek) => {
        setData({ currWeek })
        setLoading(false)
      })
      .catch((e) => {
        console.error('[AgentStudioLeadsPageInner] Fetch failed:', e)
        setLoading(false)
      })
  }, [weekStart, queryStart, queryEnd])

  const isStudioForm = (forms: string[] | undefined, formType: string) =>
    (forms && forms.length ? forms : [formType]).includes('Agent Studio')

  const currWeekContacts = useMemo(() => {
    if (!data?.currWeek) return []
    const priorities = ['high', 'medium', 'low', 'unknown']
    const contacts: any[] = []
    for (const p of priorities) {
      if (data.currWeek.contacts_by_priority?.[p]) {
        contacts.push(...data.currWeek.contacts_by_priority[p])
      }
    }
    return contacts.filter((c) => isStudioForm(c.formTypes, c.formType))
  }, [data])

  const contactsByPriority = useMemo(() => {
    const raw = data?.currWeek?.contacts_by_priority || { high: [], medium: [], low: [], unknown: [] }
    return {
      high: (raw.high || []).filter((c: any) => isStudioForm(c.formTypes, c.formType)),
      medium: (raw.medium || []).filter((c: any) => isStudioForm(c.formTypes, c.formType)),
      low: (raw.low || []).filter((c: any) => isStudioForm(c.formTypes, c.formType)),
      unknown: (raw.unknown || []).filter((c: any) => isStudioForm(c.formTypes, c.formType)),
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
      {/* 1. Agent Studio Lead Funnel */}
      <AgentStudioFunnelCard contacts={currWeekContacts} />

      {/* 2. Total Studio Leads — WoW + MoM line graphs */}
      <div className="grid gap-4 md:grid-cols-2">
        <AgentStudioWoWChart
          weekStart={weekStart}
          title="WoW Trend — Total Studio Leads"
          actualLabel="Studio Leads"
        />
        <AgentStudioMoMChart
          weekStart={weekStart}
          title="MoM Trend — Total Studio Leads"
          actualLabel="Studio Leads"
        />
      </div>

      {/* 3. Priority Breakdown — Agent Studio leads only */}
      <AgentStudioDetailsTable contactsByPriority={contactsByPriority} />
    </div>
  )
}

export default function Page() {
  const section = SECTION_MAP['agent-studio-leads']

  return (
    <SectionShell
      title={section.label}
      description={section.description}
    >
      <AgentStudioLeadsPageInner />
    </SectionShell>
  )
}
