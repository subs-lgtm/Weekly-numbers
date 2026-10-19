'use client'

import { useCallback, useMemo, useState, useEffect } from 'react'
import { SectionShell } from '@/components/SectionShell'
import { SECTION_MAP } from '@/lib/metrics-config'
import { useWeek } from '@/lib/week-context'
import { getDb } from '@/lib/firebase'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { format, subWeeks } from 'date-fns'
import { TotalMQLSummaryCards, OtherMQLMetrics, MQLLeadStatusFunnel, MQLLifecycleStatusFunnel } from '@/components/mql/MQLScoreCards'
import { MQLWoWChart } from '@/components/mql/MQLWoWChart'
import { MQLMTDChart } from '@/components/mql/MQLMTDChart'
import { MQLToSQLConversionChart } from '@/components/mql/MQLToSQLConversionChart'
import { SQLToOppConversionChart } from '@/components/mql/SQLToOppConversionChart'
import { MQLPriorityTrendChart } from '@/components/mql/MQLPriorityTrendChart'
import { MQLHubSpotData } from '@/components/mql/MQLHubSpotData'
import { OpportunityACVChart } from '@/components/mql/OpportunityACVChart'
import { ChannelBreakdownGrid } from '@/components/mql/ChannelBreakdownGrid'
import { PreSignupJourney } from '@/components/mql/PreSignupJourney'
import { MQLJourneyFunnel } from '@/components/mql/MQLJourneyFunnel'
import { PriorityAnalysis } from '@/components/mql/PriorityAnalysis'
import { PriorityDetailsTable } from '@/components/mql/PriorityDetailsTable'
import { MQLUseCases } from '@/components/mql/MQLUseCases'
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
  type Funnel = { mqls: number; meeting_booked: number; demo_booked: number; demo_completed: number; demo_no_show: number; sql: number; opportunity: number; customer: number; closed_won_count?: number }

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
    lead_status_breakdown?: { new: number; working: number; demo_booked: number; demo_completed: number; junk: number }
    lead_status_stage_breakdown?: Record<string, { working: number; linkedinAds: number; website: number; total: number }>
    lifecycle_status_breakdown?: { mql: number; sql: number; opportunity: number; customer: number }
    lifecycle_status_stage_breakdown?: Record<string, { working: number; linkedinAds: number; website: number; total: number }>
    funnel: Funnel
    lifecycle_stage_funnel?: { total: number; mql_plus: number; sql_plus: number; opportunity_plus: number; customer: number }
    lead_status_funnel?: { total: number; working_plus: number; demo_booked_plus: number; demo_completed_plus: number; associated_with_deal: number }
    contacts_by_priority?: ContactsByPriority
    meetings_funnel?: any
    meetings_activity?: any
    pipeline_activity?: any
    by_source_category?: Record<string, number>
    by_source_funnel?: Record<string, { total: number; mql: number; sql: number; opportunity: number; customer: number; working: number; pipelineValue: number }>
  } | null>(null)

  // Previous week HubSpot data for WoW deltas
  const [prevHubspotData, setPrevHubspotData] = useState<{
    total: number
    qualified_mqls: number
    meeting_booked: number
    funnel?: Funnel
    sql_activity?: number
    opp_activity?: number
    demo_completed_activity?: number
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

  // Leads whose meeting was BOOKED in the selected dates (activity-based) - same population as the Meeting Booked card.
  const meetingContacts = useMemo(() => (hubspotData?.meetings_activity?.details || []).filter((d: any) => d.booked), [hubspotData])

  // Qualified MQLs (lead score above 40) for the card's hover list, highest score first.
  const qualifiedContacts = useMemo(() => {
    const cp = hubspotData?.contacts_by_priority as Record<string, any[]> | undefined
    if (!cp) return []
    const label: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low', unknown: 'Unscored' }
    const cls: Record<string, string> = { high: 'bg-[#FBE9E6] text-[#A33A2E]', medium: 'bg-[#FBF1E4] text-[#8A5A14]', low: 'bg-[#E8EEF8] text-[#2D4C86]', unknown: 'bg-[#EEE7DC] text-[#7A6A60]' }
    return Object.entries(cp).flatMap(([prio, list]) => (list || []).filter(c => (c.score ?? 0) > 40).map(c => ({
      id: c.id, name: c.name, company: c.company, jobTitle: c.jobTitle, message: c.message, platformTools: c.platformTools,
      chip: `${label[prio] || prio} · ${Math.round(c.score)}`, chipCls: cls[prio], meta: [c.source, c.status].filter(x => x && x !== '—').join(' · '), _score: c.score,
    }))).sort((a, b) => b._score - a._score)
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
            meeting_booked: json.meetings_activity?.booked ?? (json.funnel?.meeting_booked || 0),
            funnel: json.funnel,
            sql_activity: json.pipeline_activity?.sql?.count,
            opp_activity: json.pipeline_activity?.opportunity?.count,
            demo_completed_activity: json.meetings_activity?.completed,
          })
        }
      })
      .catch(() => {})
  }, [weekStart, isWeekMode])

  // Fetch month-to-date total for the Monthly MQLs card / MQL Journey "this month" bracket.
  // Deliberately anchored to the REAL current calendar month (today's date), not to whatever
  // week is selected in the page's date picker — "MTD" means "this month, so far" regardless
  // of what historical week someone is browsing elsewhere on the page. Previously this used
  // the selected week's own month as the anchor but still extended the end out to the picker's
  // queryEnd; when the selected week straddled a month boundary (e.g. a week starting Aug 31
  // running through Sep 6) that silently produced a cross-month range (Aug 1 - Sep 6) instead
  // of a single month — fixed per explicit request on 2026-09-07.
  useEffect(() => {
    const today = new Date()
    const monthStart = format(new Date(today.getFullYear(), today.getMonth(), 1), 'yyyy-MM-dd')
    const monthEnd = format(today, 'yyyy-MM-dd') // exclusive end (LT) -> effectively "through yesterday"
    fetch(`/api/hubspot/mqls?start=${monthStart}&end=${monthEnd}&includeClosedWon=1&nocache=1`)
      .then(r => r.json())
      .then(json => {
        if (json && !json.error) {
          setMonthToDateTotal(json.total || 0)
          if (json.funnel) setMonthToDateFunnel(json.funnel)
        }
      })
      .catch(() => {})
  }, [])

  // Fetch previous calendar month, same day-of-month range as today, for a true MoM delta.
  // Also anchored to the real current month for the same reason as above.
  useEffect(() => {
    const today = new Date()
    const prevMonthStart = format(new Date(today.getFullYear(), today.getMonth() - 1, 1), 'yyyy-MM-dd')
    const prevMonthEnd = format(new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()), 'yyyy-MM-dd')
    fetch(`/api/hubspot/mqls?start=${prevMonthStart}&end=${prevMonthEnd}&nocache=1`)
      .then(r => r.json())
      .then(json => { if (json && !json.error) setPrevMonthToDateTotal(json.total || 0) })
      .catch(() => {})
  }, [])

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
        // Activity-based: unique marketing-form leads whose meeting was booked in the selected dates (falls back to the old cohort count).
        value: (hubspotData.meetings_activity?.booked ?? hubspotData.meeting_booked).toString(),
        notes: 'Live from HubSpot (meetings booked in period)',
        updatedBy: 'hubspot',
        updatedAt: null,
      }
      d['sql_count'] = {
        // Activity-based: marketing-form leads that ENTERED the SQL stage in the selected dates (falls back to the cohort count).
        value: (hubspotData.pipeline_activity?.sql?.count ?? hubspotData.funnel.sql).toString(),
        notes: 'Live from HubSpot (SQL stage entered in period)',
        updatedBy: 'hubspot',
        updatedAt: null,
      }
      d['opportunity_count'] = {
        // Activity-based: marketing-form leads linked to a marketing-sourced Studio deal created in the selected dates.
        value: (hubspotData.pipeline_activity?.opportunity?.count ?? hubspotData.funnel.opportunity).toString(),
        notes: 'Live from HubSpot (Studio deals created in period)',
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
        value: (hubspotData.meetings_activity?.completed ?? hubspotData.funnel.demo_completed).toString(),
        notes: 'Live from HubSpot (meetings held in period)',
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
      // Pure single-dimension breakdowns for the two split funnel tables (2026-09-07)
      d['lead_status_breakdown'] = {
        value: JSON.stringify(hubspotData.lead_status_breakdown || {}),
        notes: 'Pure hs_lead_status breakdown: new, working, demo_booked, demo_completed, junk',
        updatedBy: 'hubspot',
        updatedAt: null,
      }
      d['meetings_funnel'] = {
        value: JSON.stringify(hubspotData.meetings_funnel || null),
        notes: 'Live from HubSpot (Meetings object)',
        updatedBy: 'hubspot',
        updatedAt: null,
      }
      d['meetings_activity'] = {
        value: JSON.stringify(hubspotData.meetings_activity || null),
        notes: 'Live from HubSpot (Meetings object, by activity in period)',
        updatedBy: 'hubspot',
        updatedAt: null,
      }
      d['lead_status_stage_breakdown'] = {
        value: JSON.stringify(hubspotData.lead_status_stage_breakdown || {}),
        notes: 'Per-lead-status working/ads/website breakdown',
        updatedBy: 'hubspot',
        updatedAt: null,
      }
      d['lifecycle_status_breakdown'] = {
        value: JSON.stringify(hubspotData.lifecycle_status_breakdown || {}),
        notes: 'Pure lifecyclestage breakdown: mql, sql, opportunity, customer',
        updatedBy: 'hubspot',
        updatedAt: null,
      }
      d['lifecycle_status_stage_breakdown'] = {
        value: JSON.stringify(hubspotData.lifecycle_status_stage_breakdown || {}),
        notes: 'Per-lifecycle-stage working/ads/website breakdown',
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
      if (prevHubspotData.sql_activity !== undefined || prevHubspotData.funnel?.sql !== undefined) {
        d['sql_count'] = {
          value: (prevHubspotData.sql_activity ?? prevHubspotData.funnel?.sql ?? 0).toString(),
          notes: 'Live from HubSpot (SQL stage entered in period)',
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
            meetingContacts={meetingContacts}
            qualifiedContacts={qualifiedContacts}
          />

          {/* 2. TREND CHARTS */}
          <div className="section-label">Trend Charts</div>
          <div className="row-2">
            <MQLWoWChart sectionKey="mqls" weekStart={weekStart} />
            <MQLToSQLConversionChart sectionKey="mqls" weekStart={weekStart} />
          </div>
          <SQLToOppConversionChart sectionKey="mqls" weekStart={weekStart} />
          <div className="row-3">
            <MQLPriorityTrendChart sectionKey="mqls" weekStart={weekStart} priority="high" />
            <MQLPriorityTrendChart sectionKey="mqls" weekStart={weekStart} priority="medium" />
            <MQLPriorityTrendChart sectionKey="mqls" weekStart={weekStart} priority="low" />
          </div>

          {/* 3. CHANNEL WISE BREAKDOWN */}
          {hubspotData?.by_source_category && (
            <ChannelBreakdownGrid bySourceCategory={hubspotData.by_source_category} total={hubspotData.total} />
          )}

          {/* 3b. WHAT VISITORS DO ON THE SITE BEFORE SIGNING UP (GA4) — Organic / Direct / Google Ads */}
          <PreSignupJourney start={effectiveStart} end={effectiveEnd} hubspotByChannel={hubspotData?.by_source_category} />

          {/* 4. MQL QUALIFICATION FUNNELS — split into two independent, single-dimension
              tables (2026-09-07) so a contact's raw hs_lead_status and their lifecyclestage
              never override one another; see MQLScoreCards.tsx's header comment. */}
          <div className="section-label">MQL — Lead Status Funnel</div>
          <div className="section-sub">Based on HubSpot's hs_lead_status field only — where each contact literally sits right now</div>
          <MQLLeadStatusFunnel data={enrichedData} />

          <div className="section-label">MQL — Lifecycle Status Funnel</div>
          <div className="section-sub">Based on HubSpot's lifecyclestage field only — independent of lead status, feeds the leakage analysis below</div>
          <MQLLifecycleStatusFunnel data={enrichedData} />

          {/* 5. CONSOLIDATED MQL LIFECYCLE STATUS — was "MQL Journey"; renamed and narrowed to
              pure lifecyclestage stages (Demo Booked/Completed removed — those are lead-status
              concepts, now fully covered by the Lead Status funnel above) per explicit request. */}
          <div className="section-label">Consolidated MQL Lifecycle Status</div>
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

          {/* 10b. USE CASES — what the MQLs said they came for */}
          <div className="section-label">Use Cases</div>
          <div className="section-sub">What problem each MQL said they are trying to solve, grouped into themes</div>
          {hubspotData?.contacts_by_priority && (
            <MQLUseCases contacts={allContacts} dateRangeLabel={`${effectiveStart} → ${effectiveEnd}`} />
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
