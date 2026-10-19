'use client'

import { useMemo } from 'react'
import { Filter, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LeadListBody, type HoverLead } from '@/components/mql/MQLScoreCards'

type LeadContact = {
  id: string
  name: string
  email: string
  company: string
  jobTitle: string
  score: number
  formType: string
  formTypes?: string[]
  source: string
  status: string
  lifecycleStage: string
  owner: string
  createdate: string | null
  lastmodifieddate: string | null
  demoBooked: boolean
  demoCompleted: boolean
  demoNoShow: boolean
}

type Props = {
  contacts: LeadContact[]
  /** Activity-based counts for informational leads (those that reached the stage in the selected dates, whenever the lead came in). */
  activity?: {
    sql: number; opportunity: number; demoBooked: number; demoCompleted: number
    /** Who is behind each activity-based stage, with channel + playbook, for the source line and hover list */
    lists?: Partial<Record<'sql' | 'opportunity' | 'demoBooked' | 'demoCompleted', HoverLead[]>>
  } | null
}

const STAGE_KEY: Record<string, 'sql' | 'opportunity' | 'demoBooked' | 'demoCompleted'> = { SQL: 'sql', Opportunity: 'opportunity', 'Demo Booked': 'demoBooked', 'Demo Completed': 'demoCompleted' }
const STAGE_TITLE: Record<string, string> = {
  sql: 'SQLs - informational leads that reached SQL in this period, with channel and playbook',
  opportunity: 'Opportunities - informational leads with a marketing-sourced Studio deal created in this period',
  demoBooked: 'Demos booked in this period',
  demoCompleted: 'Demos that took place in this period (outcome mostly not set in HubSpot)',
}

const tally = (vals: (string | undefined)[]) => {
  const m = new Map<string, number>()
  for (const v of vals) if (v) m.set(v, (m.get(v) || 0) + 1)
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1])
}

const CARD_CLS = 'rounded-[20px] border border-[#D4CBC0] bg-white p-6 shadow-[0_4px_20px_rgba(40,20,10,.07)]'

export function LeadFunnelCard({ contacts, activity }: Props) {
  // 1. Filter out Agent Studio
  const nonStudio = useMemo(() => contacts.filter(c => c.formType !== 'Agent Studio'), [contacts])

  // 2. Compute funnel counts
  const funnelData = useMemo(() => {
    // Webinar added 2026-09-28: bulk webinar-signup batches (thousands in a single week) aren't
    // comparable to an actual informational-lead form fill and were swamping this card's Lead count.
    const EXCLUDED_FORMS = new Set(['Book a Demo', 'Email Form', 'Pre-Built Agents', 'Webinar'])

    // Lead: Count of contacts whose primary form type is informational (excludes direct Book a Demo forms)
    const leadsList = nonStudio.filter(c => !EXCLUDED_FORMS.has(c.formType))
    const lead = leadsList.length
    
    // MQL: Of those leads, how many also submitted 'Book a Demo' form
    const mqlsList = leadsList.filter(c => {
      const forms = c.formTypes || [c.formType]
      return forms.includes('Book a Demo')
    })
    const mql = mqlsList.length

    // SQL: Of those MQLs, how many progressed to SQL stage or above
    const sql = mqlsList.filter(c => {
      const stage = c.lifecycleStage || ''
      return ['salesqualifiedlead', 'opportunity', 'customer', '249550600'].includes(stage)
    }).length

    // Demo Booked: Of those MQLs, how many have demo booked status
    const demoBooked = mqlsList.filter(c => c.status === 'Demo Booked').length
    
    // Demo Completed: Of those MQLs, how many have demo completed status
    const demoCompleted = mqlsList.filter(c => c.status === 'Demo Completed' || c.status === 'Demo Completed - PLG').length

    // Opportunity: Of those MQLs, how many reached opportunity or above
    const opportunity = mqlsList.filter(c => {
      const stage = c.lifecycleStage || ''
      return ['249550600', 'customer', 'opportunity'].includes(stage)
    }).length

    // Customer: Of those MQLs, how many became customers
    const customer = mqlsList.filter(c => c.lifecycleStage === 'customer').length

    // SQL / Demo / Opportunity: activity-based when available, so an informational lead (e.g. a Playbook download from August)
    // that reaches SQL or books a demo in the selected dates is reflected here, matching the Summary and MQL pages.
    return {
      lead, mql,
      sql: activity?.sql ?? sql,
      demoBooked: activity?.demoBooked ?? demoBooked,
      demoCompleted: activity?.demoCompleted ?? demoCompleted,
      opportunity: activity?.opportunity ?? opportunity,
      customer,
    }
  }, [nonStudio, activity])

  const { lead, mql, sql, demoBooked, demoCompleted, opportunity, customer } = funnelData

  // 3. Compute top scorecard rates (relative to total leads)
  const demoBookingRate = lead > 0 ? ((demoBooked / lead) * 100).toFixed(1) : '0'
  const mqlConvRate = lead > 0 ? ((mql / lead) * 100).toFixed(1) : '0'
  const sqlConvRate = lead > 0 ? ((sql / lead) * 100).toFixed(1) : '0'
  const oppConvRate = lead > 0 ? ((opportunity / lead) * 100).toFixed(1) : '0'
  const customerConvRate = lead > 0 ? ((customer / lead) * 100).toFixed(1) : '0'

  // 4. Funnel stages list
  // With activity-based numbers the stages are no longer a strict chain (a lead can reach SQL or book a demo without having
  // been in this week's lead cohort), so conversion is measured against total leads instead of the previous stage.
  const act = !!activity
  const stages = [
    { label: 'Lead', value: lead, color: '#5B3A34', ofLabel: null, ofBase: 0 },
    { label: 'MQL', value: mql, color: '#8A6152', ofLabel: 'of Lead', ofBase: lead },
    { label: 'SQL', value: sql, color: '#C96A5A', ofLabel: act ? 'of Lead' : 'of MQL', ofBase: act ? lead : mql },
    { label: 'Demo Booked', value: demoBooked, color: '#D97706', ofLabel: act ? 'of Lead' : 'of SQL', ofBase: act ? lead : sql },
    { label: 'Demo Completed', value: demoCompleted, color: '#B39A86', ofLabel: 'of Demo Booked', ofBase: demoBooked },
    { label: 'Opportunity', value: opportunity, color: '#3D5A8C', ofLabel: act ? 'of Lead' : 'of Demo Completed', ofBase: act ? lead : demoCompleted },
    { label: 'Customer', value: customer, color: '#3E7A55', ofLabel: 'of Opportunity', ofBase: opportunity },
  ]

  const maxVal = Math.max(...stages.map(s => s.value), 1)

  return (
    <div className={CARD_CLS}>
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-5">
        <div className="inline-flex items-center justify-center rounded-full p-2 bg-[rgba(107,76,76,.08)] text-[#6B4C4C]">
          <Filter className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-[16px] font-[600] text-[#2A1F1A]">Lead Funnel</h3>
          <p className="text-[11px] text-[#7A6A60] mt-0.5">
            Lead &rarr; MQL &rarr; SQL &rarr; Demo Booked &rarr; Demo Completed &rarr; Opportunity &rarr; Customer
          </p>
          {activity && <p className="text-[10.5px] text-[#9A8C82] mt-0.5">SQL, Demo and Opportunity count informational leads (Playbook, Contact Us, Partner ...) that reached the stage in the selected dates, whenever the lead came in.</p>}
        </div>
      </div>

      {/* Scorecards row */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6">
        <div className="rounded-[12px] bg-[#F9F5F1] p-3 border border-[#E8E0D8]">
          <p className="text-[9px] text-[#7A6A60] uppercase tracking-wider font-[600] mb-1">Total Leads</p>
          <p className="text-[22px] font-[700] text-[#2A1F1A] font-['Playfair_Display']">{lead}</p>
        </div>
        <div className="rounded-[12px] bg-[#F9F5F1] p-3 border border-[#E8E0D8]">
          <p className="text-[9px] text-[#7A6A60] uppercase tracking-wider font-[600] mb-1">Demo Booking Rate</p>
          <p className="text-[22px] font-[700] text-[#2A1F1A] font-['Playfair_Display']">{demoBookingRate}%</p>
        </div>
        <div className="rounded-[12px] bg-[#F9F5F1] p-3 border border-[#E8E0D8]">
          <p className="text-[9px] text-[#7A6A60] uppercase tracking-wider font-[600] mb-1">MQL Conv. Rate</p>
          <p className="text-[22px] font-[700] text-[#2A1F1A] font-['Playfair_Display']">{mqlConvRate}%</p>
        </div>
        <div className="rounded-[12px] bg-[#F9F5F1] p-3 border border-[#E8E0D8]">
          <p className="text-[9px] text-[#7A6A60] uppercase tracking-wider font-[600] mb-1">SQL Conv. Rate</p>
          <p className="text-[22px] font-[700] text-[#2A1F1A] font-['Playfair_Display']">{sqlConvRate}%</p>
        </div>
        <div className="rounded-[12px] bg-[#F9F5F1] p-3 border border-[#E8E0D8]">
          <p className="text-[9px] text-[#7A6A60] uppercase tracking-wider font-[600] mb-1">Opp. Conv. Rate</p>
          <p className="text-[22px] font-[700] text-[#2A1F1A] font-['Playfair_Display']">{oppConvRate}%</p>
        </div>
        <div className="rounded-[12px] bg-[#F9F5F1] p-3 border border-[#E8E0D8]">
          <p className="text-[9px] text-[#7A6A60] uppercase tracking-wider font-[600] mb-1">Customer Conv. Rate</p>
          <p className="text-[22px] font-[700] text-[#2A1F1A] font-['Playfair_Display']">{customerConvRate}%</p>
        </div>
      </div>

      {/* Funnel list layout */}
      <div className="space-y-3.5">
        <div className="grid grid-cols-[120px_1fr_60px_100px_80px] gap-4 text-[10px] uppercase font-[600] text-[#7A6A60] tracking-wider border-b border-[#F2EDE8] pb-1.5 px-2">
          <div>Stage</div>
          <div></div>
          <div className="text-right">Count</div>
          <div className="text-right">Conversion</div>
          <div className="text-right">Drop-off</div>
        </div>

        <div className="space-y-2">
          {stages.map((stage, i) => {
            const pct = Math.max((stage.value / maxVal) * 100, stage.value > 0 ? 4 : 0)
            
            let convVal = 100
            if (i > 0) {
              if (stage.ofBase > 0) {
                convVal = Math.round((stage.value / stage.ofBase) * 100)
              } else {
                convVal = 0
              }
            }

            const dropVal = i === 0 ? null : 100 - convVal

            const key = STAGE_KEY[stage.label]
            const rows = key ? activity?.lists?.[key] : undefined
            const hasRows = !!rows && rows.length > 0
            const channels = hasRows ? tally(rows!.map(r => r.channel || 'Unattributed')) : []
            const playbooks = hasRows ? tally(rows!.map(r => r.playbook)) : []

            return (
              <div key={stage.label} className={cn('relative', hasRows && 'group/stage hover:z-40 focus-within:z-40')} tabIndex={hasRows ? 0 : undefined}>
              <div className="grid grid-cols-[120px_1fr_60px_100px_80px] gap-4 items-center px-2 py-0.5 text-[13px]">
                <div className="font-[600] text-[#2A1F1A]">
                  {stage.label}
                  {hasRows && <span className="block text-[10px] font-[500] text-[#2563EB] underline decoration-dotted underline-offset-2">hover for who</span>}
                </div>
                <div className="h-6 rounded-md bg-[#F9F5F1] overflow-hidden flex items-center relative">
                  <div
                    className="h-full rounded-md flex items-center justify-end px-3 transition-all duration-500 text-[11px] font-[700] text-white"
                    style={{ width: `${pct}%`, background: stage.color }}
                  >
                    {stage.value > 0 ? stage.value.toLocaleString() : ''}
                  </div>
                </div>
                <div className="text-right font-[600] text-[#2A1F1A]">
                  {stage.value.toLocaleString()}
                </div>
                <div className={cn('text-right font-[600]', i === 0 || convVal >= 40 ? 'text-[#16A34A]' : 'text-[#EA580C]')}>
                  {i === 0 ? '100%' : `${convVal}%`}
                  {stage.ofLabel && <div className="text-[9px] font-[400] text-[#7A6A60] normal-case">{stage.ofLabel}</div>}
                </div>
                <div className="text-right text-[#7A6A60] font-[500]">
                  {dropVal === null ? '—' : `${dropVal}%`}
                </div>
              </div>
              {hasRows && (
                <div className="px-2 pl-[136px] pb-1 text-[10.5px] leading-snug text-[#7A6A60]">
                  <span>Source: {channels.map(([c, n]) => `${n} ${c}`).join(' · ')}</span>
                  {playbooks.length > 0 && <span className="text-[#6B4C4C]"> · Playbook: {playbooks.map(([p, n]) => `${p}${n > 1 ? ` (${n})` : ''}`).join(', ')}</span>}
                </div>
              )}
              {hasRows && (
                <div className="hidden group-hover/stage:block group-focus-within/stage:block absolute left-0 sm:left-[130px] top-full z-50 pt-1 w-[440px] max-w-[88vw]">
                  <LeadListBody rows={rows!} title={STAGE_TITLE[key]} footer="Informational leads (Playbook, Contact Us, Partner ...), counted in the period the stage happened, whenever the lead came in." />
                </div>
              )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-5 pt-3 border-t border-[#F2EDE8] flex justify-between items-center text-[11px] text-[#7A6A60]">
        <p className="italic max-w-[70%] leading-relaxed">
          Note: MQL (Book a Demo form submission), SQL/Opportunity/Customer (lifecycle stage), and Demo Booked/Demo Completed (SDR status) are tracked independently in this pipeline — a lead can advance on one without having advanced on another, so a later stage's count can exceed an earlier stage's count.
        </p>
        <p className="font-[600] text-[#2A1F1A]">
          Overall Lead &rarr; Customer conversion: <span className="text-[#EA580C]">{lead > 0 ? ((customer / lead) * 100).toFixed(0) : '0'}%</span>
        </p>
      </div>
    </div>
  )
}
