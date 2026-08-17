'use client'

import { useMemo } from 'react'
import { Filter } from 'lucide-react'
import { cn } from '@/lib/utils'

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
}

const CARD_CLS = 'rounded-[20px] border border-[#D4CBC0] bg-white p-6 shadow-[0_4px_20px_rgba(40,20,10,.07)]'

// Mirrors LeadFunnelCard's methodology exactly, but scoped to Agent Studio
// form submissions only (instead of excluding them).
export function AgentStudioFunnelCard({ contacts }: Props) {
  // 1. Keep only Agent Studio submissions
  const studioOnly = useMemo(
    () => contacts.filter(c => (c.formTypes && c.formTypes.length ? c.formTypes : [c.formType]).includes('Agent Studio')),
    [contacts],
  )

  // 2. Compute funnel counts
  const funnelData = useMemo(() => {
    // Studio Lead: every Agent Studio form submission
    const lead = studioOnly.length

    // MQL: of those studio leads, how many also submitted 'Book a Demo' (buying-intent signal)
    const mqlsList = studioOnly.filter(c => {
      const forms = c.formTypes && c.formTypes.length ? c.formTypes : [c.formType]
      return forms.includes('Book a Demo')
    })
    const mql = mqlsList.length

    // SQL: of those MQLs, how many progressed to SQL stage or above
    const sql = mqlsList.filter(c => {
      const stage = c.lifecycleStage || ''
      return ['salesqualifiedlead', 'opportunity', 'customer', '249550600'].includes(stage)
    }).length

    // Demo Booked: of those MQLs, how many have demo booked status
    const demoBooked = mqlsList.filter(c => c.status === 'Demo Booked').length

    // Demo Completed: of those MQLs, how many have demo completed status
    const demoCompleted = mqlsList.filter(c => c.status === 'Demo Completed' || c.status === 'Demo Completed - PLG').length

    // Opportunity: of those MQLs, how many reached opportunity or above
    const opportunity = mqlsList.filter(c => {
      const stage = c.lifecycleStage || ''
      return ['249550600', 'customer', 'opportunity'].includes(stage)
    }).length

    // Customer: of those MQLs, how many became customers
    const customer = mqlsList.filter(c => c.lifecycleStage === 'customer').length

    return { lead, mql, sql, demoBooked, demoCompleted, opportunity, customer }
  }, [studioOnly])

  const { lead, mql, sql, demoBooked, demoCompleted, opportunity, customer } = funnelData

  // 3. Compute top scorecard rates (relative to total studio leads)
  const demoBookingRate = lead > 0 ? ((demoBooked / lead) * 100).toFixed(1) : '0'
  const mqlConvRate = lead > 0 ? ((mql / lead) * 100).toFixed(1) : '0'
  const sqlConvRate = lead > 0 ? ((sql / lead) * 100).toFixed(1) : '0'
  const oppConvRate = lead > 0 ? ((opportunity / lead) * 100).toFixed(1) : '0'
  const customerConvRate = lead > 0 ? ((customer / lead) * 100).toFixed(1) : '0'

  // 4. Funnel stages list
  const stages = [
    { label: 'Studio Lead', value: lead, color: '#5B3A34', ofLabel: null, ofBase: 0 },
    { label: 'MQL', value: mql, color: '#8A6152', ofLabel: 'of Studio Lead', ofBase: lead },
    { label: 'SQL', value: sql, color: '#C96A5A', ofLabel: 'of MQL', ofBase: mql },
    { label: 'Demo Booked', value: demoBooked, color: '#D97706', ofLabel: 'of SQL', ofBase: sql },
    { label: 'Demo Completed', value: demoCompleted, color: '#B39A86', ofLabel: 'of Demo Booked', ofBase: demoBooked },
    { label: 'Opportunity', value: opportunity, color: '#3D5A8C', ofLabel: 'of Demo Completed', ofBase: demoCompleted },
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
          <h3 className="text-[16px] font-[600] text-[#2A1F1A]">Agent Studio Lead Funnel</h3>
          <p className="text-[11px] text-[#7A6A60] mt-0.5">
            Studio Lead &rarr; MQL &rarr; SQL &rarr; Demo Booked &rarr; Demo Completed &rarr; Opportunity &rarr; Customer
          </p>
        </div>
      </div>

      {/* Scorecards row */}
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-6">
        <div className="rounded-[12px] bg-[#F9F5F1] p-3 border border-[#E8E0D8]">
          <p className="text-[9px] text-[#7A6A60] uppercase tracking-wider font-[600] mb-1">Total Studio Leads</p>
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

            return (
              <div key={stage.label} className="grid grid-cols-[120px_1fr_60px_100px_80px] gap-4 items-center px-2 py-0.5 text-[13px]">
                <div className="font-[600] text-[#2A1F1A]">{stage.label}</div>
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
            )
          })}
        </div>
      </div>

      <div className="mt-5 pt-3 border-t border-[#F2EDE8] flex justify-between items-center text-[11px] text-[#7A6A60]">
        <p className="italic max-w-[70%] leading-relaxed">
          Note: MQL (Book a Demo form submission), SQL/Opportunity/Customer (lifecycle stage), and Demo Booked/Demo Completed (SDR status) are tracked independently in this pipeline — a lead can advance on one without having advanced on another, so a later stage's count can exceed an earlier stage's count.
        </p>
        <p className="font-[600] text-[#2A1F1A]">
          Overall Studio Lead &rarr; Customer conversion: <span className="text-[#EA580C]">{lead > 0 ? ((customer / lead) * 100).toFixed(0) : '0'}%</span>
        </p>
      </div>
    </div>
  )
}
