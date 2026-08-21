'use client'

import { useCallback, useMemo, useState, useEffect } from 'react'
import { SectionShell } from '@/components/SectionShell'
import { SECTION_MAP } from '@/lib/metrics-config'
import { useWeek } from '@/lib/week-context'
import { getDb } from '@/lib/firebase'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { format, subWeeks } from 'date-fns'
import { TotalMQLSummaryCards, OtherMQLMetrics, QualificationFunnel } from '@/components/mql/MQLScoreCards'
import { MQLWoWChart } from '@/components/mql/MQLWoWChart'
import { MQLMTDChart } from '@/components/mql/MQLMTDChart'
import { MQLToSQLConversionChart } from '@/components/mql/MQLToSQLConversionChart'
import { SQLToOppConversionChart } from '@/components/mql/SQLToOppConversionChart'
import { MQLHubSpotData } from '@/components/mql/MQLHubSpotData'
import { OpportunityACVChart } from '@/components/mql/OpportunityACVChart'
import { ChannelBreakdownGrid } from '@/components/mql/ChannelBreakdownGrid'
import { MQLJourneyFunnel } from '@/components/mql/MQLJourneyFunnel'
import { PriorityAnalysis } from '@/components/mql/PriorityAnalysis'
import { PriorityDetailsTable } from '@/components/mql/PriorityDetailsTable'
import { MQLAgingBuckets } from '@/components/mql/MQLAgingBuckets'
import { PipelineTrendChart } from '@/components/mql/PipelineTrendChart'


function MQLPageInner() {
  const { weekStart, isWeekMode, queryStart, queryEnd } = useWeek()

  type PriorityContact = {
    id: string; name: string; email: string; company: string; jobTitle: string
    score: number; formType: string; source: string; status: string; lifecycleStage: string
    owner: string; createdate: string | null; lastmodifieddate: string | null
    demoBooked: boolean; demoCompleted: boolean; demoNoShow: boolean
  }
  type ContactsByPriority = { high: PriorityContact[]; medium: PriorityContact[]; low: PriorityContact[]; unknown: PriorityContact[] }
  type Funnel = { mqls: number; meeting_booked: number; demo_booked: number; demo_completed: number; demo_no_show: number; sql: number; opportunity: number; customer: number }

  // Live HubSpot data
  const [hubspotData, setHubspotData] = useState<{
    total: number
    qualified: number
    qualified_mqls: number
    meeting_booked: number
    paid_mqls: number
    working_mqls: number
    book_demo_linkedin_ads: number
    book_demo_website: number
    stage_breakdown: Record<string, { working: number; linkedinAds: number; website: number; total: number }>
    mql_status_breakdown?: { new: number; working: number; demo_booked: number; demo_completed: number; sql: number; junk: number }
    funnel: Funnel
    lifecycle_stage_funnel?: { total: number; mql_plus: number; sql_plus: number; opportunity_plus: number; customer: number }
    lead_status_funnel?: { total: number; working_plus: number; demo_booked_plus: number; demo_completed_plus: number; associated_with_deal: number }
    contacts_by_priority?: ContactsByPriority
    by_source_category?: Record<string, number>
    by_source_funnel?: Record<string, { total: number; mql: number; sql: number; opportunity: number; customer: number; working: number; pipelineValue: number }>
  } | null>(null)

  // Previous week HubSpot data for WoW deltas
  const [prevHubspotData, setPrevHubspotData] = useState<{
    total: number
    qualified_mqls: number
    meeting_booked: number
    funnel?: Funnel
  } | null>(null)

  // Month-to-date total MQLs (calendar month up to today) — for the Monthly MQLs card
  const [monthToDateTotal, setMonthToDateTotal] = useState<number | null>(null)
  // Previous month, same day-of-month range — for a true MoM delta on the Monthly MQLs card
  const [prevMonthToDateTotal, setPrevMonthToDateTotal] = useState<number | null>(null)
  // Month-to-date funnel — for the MQL Journey "this month" bracket
  const [monthToDateFunnel, setMonthToDateFunnel] = useState<Funnel | null>(null)



  const allContacts = useMemo(() => {
    if (!hubspotData?.contacts_by_priority) return []
    const priorities = ['high', 'medium', 'low', 'unknown']
    const list: any[] = []
    for (const p of priorities) {
      const key = p as keyof ContactsByPriority
      if (hubspotData.contacts_by_priority[key]) {
        list.push(...hubspotData.contacts_by_priority[key])
      }
    }
    return list
  }, [hubspotData])

  const handleHubSpotData = useCallback((d: typeof hubspotData) => {
    setHubspotData(d)
    // Sync HubSpot total to Firestore so WoW/MoM charts can read it
    if (d && d.total > 0 && isWeekMode) {
      const db = getDb()
      const ref = doc(db, 'weekly_metrics', weekStart, 'sections', 'mqls', 'entries', 'mqls_total')
      setDoc(ref, { value: String(d.total), notes: 'Live from HubSpot', updatedBy: 'hubspot', updatedAt: serverTimestamp() }, { merge: true }).catch(() => {})
    }
  }, [weekStart, isWeekMode])

  // Fetch previous week data from HubSpot for WoW comparison
  useEffect(() => {
    if (!isWeekMode) return
    const prevWeekStart = format(subWeeks(new Date(weekStart + 'T00:00:00'), 1), 'yyyy-MM-dd')
    const prevWeekEnd = weekStart
    fetch(`/api/hubspot/mqls?start=${prevWeekStart}&end=${prevWeekEnd}`)
      .then(r => r.json())
      .then(json => {
        if (json && !json.error) {
          setPrevHubspotData({
            total: json.total || 0,
            qualified_mqls: json.qualified_mqls || 0,
            meeting_booked: json.funnel?.meeting_booked || 0,
            funnel: json.funnel,
          })
        }
      })
      .catch(() => {})
  }, [weekStart, isWeekMode])

  // Fetch month-to-date total (calendar month containing weekStart, up to selected week's end or today) for the Monthly MQLs card
  useEffect(() => {
    const anchor = new Date(weekStart + 'T00:00:00')
    const monthStart = format(new Date(anchor.getFullYear(), anchor.getMonth(), 1), 'yyyy-MM-dd')
    const monthEnd = isWeekMode ? queryEnd : format(new Date(), 'yyyy-MM-dd')
    fetch(`/api/hubspot/mqls?start=${monthStart}&end=${monthEnd}`)
      .then(r => r.json())
      .then(json => {
        if (json && !json.error) {
          setMonthToDateTotal(json.total || 0)
          if (json.funnel) setMonthToDateFunnel(json.funnel)
        }
      })
      .catch(() => {})
  }, [weekStart, queryEnd, isWeekMode])

  // Fetch previous month, same day-of-month range (e.g. Aug 1 - Aug 9 vs Jul 1 - Jul 9) for a true MoM delta
  useEffect(() => {
    const anchor = new Date(weekStart + 'T00:00:00')
    const endDate = isWeekMode ? new Date(queryEnd + 'T00:00:00') : new Date()
    // Go back 1 day since queryEnd is exclusive
    if (isWeekMode) endDate.setDate(endDate.getDate() - 1)

    const prevMonthStart = format(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1), 'yyyy-MM-dd')
    const prevMonthEnd = format(new Date(anchor.getFullYear(), anchor.getMonth() - 1, endDate.getDate()), 'yyyy-MM-dd')
    fetch(`/api/hubspot/mqls?start=${prevMonthStart}&end=${prevMonthEnd}`)
      .then(r => r.json())
      .then(json => { if (json && !json.error) setPrevMonthToDateTotal(json.total || 0) })
      .catch(() => {})
  }, [weekStart, queryEnd, isWeekMode])

  // Build enriched data from HubSpot for scorecards
  const enrichedData = useMemo(() => {
    const d: Record<string, { value: string; notes: string; updatedBy: string; updatedAt: any }> = {}

    if (hubspotData) {
      d['mqls_total'] = {
        value: hubspotData.total.toString(),
        notes: 'Live from HubSpot',
        updatedBy: 'hubspot',
        updatedAt: null,
      }
      d['mqls_qualified'] = {
        value: hubspotData.qualified_mqls.toString(),
        notes: 'Live from HubSpot (lead score > 40)',
        updatedBy: 'hubspot',
        updatedAt: null,
      }
      d['meeting_booked'] = {
        value: hubspotData.meeting_booked.toString(),
        notes: 'Live from HubSpot (hs_latest_meeting_activity)',
        updatedBy: 'hubspot',
        updatedAt: null,
      }
      d['sql_count'] = {
        value: hubspotData.funnel.sql.toString(),
        notes: 'Live from HubSpot (lifecyclestage)',
        updatedBy: 'hubspot',
        updatedAt: null,
      }
      d['opportunity_count'] = {
        value: hubspotData.funnel.opportunity.toString(),
        notes: 'Live from HubSpot (lifecyclestage)',
        updatedBy: 'hubspot',
        updatedAt: null,
      }
      d['customer_count'] = {
        value: hubspotData.funnel.customer.toString(),
        notes: 'Live from HubSpot (lifecyclestage)',
        updatedBy: 'hubspot',
        updatedAt: null,
      }
      d['demo_booked_count'] = {
        value: hubspotData.funnel.demo_booked.toString(),
        notes: 'Live from HubSpot (hs_lead_status = Demo Booked)',
        updatedBy: 'hubspot',
        updatedAt: null,
      }
      d['demo_completed_count'] = {
        value: hubspotData.funnel.demo_completed.toString(),
        notes: 'Live from HubSpot (hs_lead_status = Demo Completed)',
        updatedBy: 'hubspot',
        updatedAt: null,
      }
      d['working_mqls'] = {
        value: (hubspotData.working_mqls || 0).toString(),
        notes: 'Live from HubSpot (hs_lead_status = Working)',
        updatedBy: 'hubspot',
        updatedAt: null,
      }
      d['book_demo_linkedin_ads'] = {
        value: (hubspotData.book_demo_linkedin_ads || 0).toString(),
        notes: 'Book a Demo leads from Paid Campaigns',
        updatedBy: 'hubspot',
        updatedAt: null,
      }
      d['book_demo_website'] = {
        value: (hubspotData.book_demo_website || 0).toString(),
        notes: 'Book a Demo leads from Website (non-paid)',
        updatedBy: 'hubspot',
        updatedAt: null,
      }
      // Store stage breakdown as JSON for the funnel component
      d['stage_breakdown'] = {
        value: JSON.stringify(hubspotData.stage_breakdown || {}),
        notes: 'Per-stage working/ads/website breakdown',
        updatedBy: 'hubspot',
        updatedAt: null,
      }
      d['mql_status_breakdown'] = {
        value: JSON.stringify(hubspotData.mql_status_breakdown || {}),
        notes: 'MQL Status breakdown: new, working, junk, sql',
        updatedBy: 'hubspot',
        updatedAt: null,
      }
    }

    // Auto-calculate MQL → Demo Rate
    const totalMQLs = parseFloat(d['mqls_total']?.value ?? '')
    const meetingBooked = parseFloat(d['meeting_booked']?.value ?? '')
    if (!isNaN(totalMQLs) && !isNaN(meetingBooked) && totalMQLs > 0) {
      const rate = ((meetingBooked / totalMQLs) * 100).toFixed(1)
      d['mql_to_demo_rate'] = {
        value: rate,
        notes: 'Auto-calculated',
        updatedBy: 'system',
        updatedAt: null,
      }
    }



    return d
  }, [hubspotData])

  // Enrich previous week data with live HubSpot prev data for WoW deltas
  const enrichedPrevData = useMemo(() => {
    const d: Record<string, { value: string; notes: string; updatedBy: string; updatedAt: any }> = {}
    if (prevHubspotData) {
      d['mqls_total'] = {
        value: prevHubspotData.total.toString(),
        notes: 'Live from HubSpot',
        updatedBy: 'hubspot',
        updatedAt: null,
      }
      d['mqls_qualified'] = {
        value: prevHubspotData.qualified_mqls.toString(),
        notes: 'Live from HubSpot (lead score > 40)',
        updatedBy: 'hubspot',
        updatedAt: null,
      }
      d['meeting_booked'] = {
        value: prevHubspotData.meeting_booked.toString(),
        notes: 'Live from HubSpot',
        updatedBy: 'hubspot',
        updatedAt: null,
      }
      if (prevHubspotData.funnel?.sql !== undefined) {
        d['sql_count'] = {
          value: prevHubspotData.funnel.sql.toString(),
          notes: 'Live from HubSpot (lifecyclestage)',
          updatedBy: 'hubspot',
          updatedAt: null,
        }
      }
      // Auto-calculate prev MQL → Demo Rate
      if (prevHubspotData.total > 0 && prevHubspotData.meeting_booked > 0) {
        d['mql_to_demo_rate'] = {
          value: ((prevHubspotData.meeting_booked / prevHubspotData.total) * 100).toFixed(1),
          notes: 'Auto-calculated',
          updatedBy: 'system',
          updatedAt: null,
        }
      }
    }
    return d
  }, [prevHubspotData])

  const hasData = hubspotData !== null

  // Tab state: 'week' = date range selected, 'alltime' = all-time view
  const [activeTab, setActiveTab] = useState<'week' | 'alltime'>('week')

  // All-time uses a very wide date range (Lyzr founded 2023)
  const allTimeStart = '2023-01-01'
  const allTimeEnd = format(new Date(), 'yyyy-MM-dd')
  const effectiveStart = activeTab === 'alltime' ? allTimeStart : (queryStart || weekStart)
  const effectiveEnd   = activeTab === 'alltime' ? allTimeEnd  : (queryEnd   || format(new Date(weekStart + 'T00:00:00'), 'yyyy-MM-dd'))

  // Date range label for the "Last Week" tab
  const weekLabel = queryStart && queryEnd
    ? `${queryStart} → ${queryEnd}`
    : `${weekStart} → ${format(new Date(weekStart + 'T00:00:00'), 'yyyy-MM-dd')}`

  return (
    <div className="flex flex-col space-y-6">

      {/*
        MQLHubSpotData drives every section below via the onData callback (sets
        hubspotData/hasData). It must be mounted unconditionally so its fetch
        effect actually fires — but its own chart grid (by-priority/form/source
        bar charts + drill-down drawer) isn't part of the reference layout, so
        we push it to the visual bottom of the page via flex `order` while
        keeping a single mount point (avoids a duplicate API call and avoids
        a mount deadlock where hasData never becomes true).
      */}
      {/* Hidden data-fetch: MQLHubSpotData drives hubspotData state via onData callback.
          Rendered off-screen so it still fetches but shows no UI here. */}
      <div style={{ display: 'none' }}>
        <MQLHubSpotData
          weekStart={weekStart}
          queryStart={effectiveStart}
          queryEnd={effectiveEnd}
          onData={activeTab === 'week' ? handleHubSpotData : () => {}}
          includePipeline
        />
      </div>

      {!hasData && (
        <div className="rounded-[20px] border border-[#D4CBC0] bg-[#F9F5F1] p-8 flex items-center justify-center gap-3" style={{ order: 1 }}>
          <div className="w-5 h-5 border-2 border-[#6B4C4C] border-t-transparent rounded-full animate-spin" />
          <p className="text-[14px] text-[#7A6A60]">Loading live data from HubSpot…</p>
        </div>
      )}

      {hasData && (
        <div className="flex flex-col space-y-6" style={{ order: 1 }}>
          {/* 1. TOTAL MQL SUMMARY */}
          <div className="section-label first">Total MQL Summary</div>
          <TotalMQLSummaryCards
            data={enrichedData}
            prevData={enrichedPrevData}
          />

          {/* 2. TREND CHARTS */}
          <div className="section-label">Trend Charts</div>
          <div className="row-2">
            <MQLWoWChart sectionKey="mqls" weekStart={weekStart} />
            <MQLToSQLConversionChart sectionKey="mqls" weekStart={weekStart} />
          </div>
          <SQLToOppConversionChart sectionKey="mqls" weekStart={weekStart} />

          {/* 3. CHANNEL WISE BREAKDOWN */}
          {hubspotData?.by_source_category && (
            <ChannelBreakdownGrid bySourceCategory={hubspotData.by_source_category} total={hubspotData.total} />
          )}

          {/* 4. MQL QUALIFICATION FUNNEL */}
          <div className="section-label">MQL Qualification Funnel</div>
          <div className="section-sub">Internal qualification path — feeds the leakage analysis below</div>
          <QualificationFunnel data={enrichedData} />

          {/* 5. MQL JOURNEY (LIFECYCLE) */}
          <div className="section-label">MQL Journey</div>
          <div className="section-sub">The complete lifecycle from Marketing Qualified Lead to closed Customer</div>
          {hubspotData?.funnel && <MQLJourneyFunnel funnel={hubspotData.funnel} monthlyFunnel={monthToDateFunnel ?? undefined} />}

          {/* 7. PRIORITY ANALYSIS */}
          <div className="section-label">Priority Analysis</div>
          <div className="section-sub">Response performance and downstream conversion by lead-score priority</div>
          {hubspotData?.contacts_by_priority && (
            <PriorityAnalysis contactsByPriority={hubspotData.contacts_by_priority} />
          )}

          {/* 8. PIPELINE GENERATED TREND */}
          <div className="section-label">Pipeline Generated Trend</div>
          <div className="section-sub">Weekly pipeline creation and movement trends</div>
          <PipelineTrendChart queryEnd={effectiveEnd} />

          {/* 9. OPPORTUNITY ACV PIPELINE */}
          <div className="section-label">Opportunity ACV Pipeline</div>
          <div className="section-sub">Pipeline value trend and distribution of active deals</div>
          <OpportunityACVChart />

          {/* 10. PRIORITY DETAILS */}
          <div className="section-label">Priority Details</div>
          {hubspotData?.contacts_by_priority && (
            <PriorityDetailsTable contactsByPriority={hubspotData.contacts_by_priority} dateRangeLabel={`${effectiveStart} → ${effectiveEnd}`} />
          )}

          {/* 11. MQL AGING */}
          <div className="section-label">MQL Aging</div>
          <div className="section-sub">How long MQLs have sat without progressing to the next stage</div>
          {hubspotData?.contacts_by_priority && (
            <MQLAgingBuckets contactsByPriority={hubspotData.contacts_by_priority} />
          )}

          {/* 12. MOM TREND — closes the section */}
          <div className="section-label">MoM Trend</div>
          <div className="section-sub">Month-over-month MQLs, goals vs actuals</div>
          <MQLMTDChart sectionKey="mqls" weekStart={weekStart} />
        </div>
      )}
    </div>
  )
}

export default function Page() {
  const section = SECTION_MAP['mqls']
  return (
    <SectionShell title={section.label} description={section.description}>
      <MQLPageInner />
    </SectionShell>
  )
}
