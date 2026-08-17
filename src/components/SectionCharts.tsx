'use client'

import {
  MetricsChart,
  SourceBreakdownBar,
  FunnelChart,
  GoalsVsActualsBar,
  DonutChart,
  RadialGauge,
} from '@/components/MetricsChart'
import { SECTION_MAP } from '@/lib/metrics-config'
import type { MetricDef } from '@/lib/metrics-config'

type Props = {
  sectionKey: string
  weekStart: string
  data: Record<string, { value: string; notes: string; updatedBy: string }>
  customMetrics?: MetricDef[]
}

/** Helper: parse a numeric value from the data bag */
function num(data: Props['data'], key: string): number {
  const n = parseFloat(data[key]?.value ?? '')
  return isNaN(n) ? 0 : n
}

/** Helper: get top N numeric MetricDefs for a section */
function topNumericMetrics(sectionKey: string, n: number): MetricDef[] {
  const section = SECTION_MAP[sectionKey]
  if (!section) return []
  return section.metrics.filter(m => m.unit !== 'text').slice(0, n)
}

/* ─── Section-specific chart configs ─── */

function LeadsCharts({ data }: Props) {
  const sourceKeys = [
    { key: 'leads_organic', label: 'Organic / SEO' },
    { key: 'leads_paid', label: 'Paid Ads' },
    { key: 'leads_email', label: 'Email Outreach' },
    { key: 'leads_events', label: 'Events' },
    { key: 'leads_referral', label: 'Referral / Partner' },
    { key: 'leads_direct', label: 'Direct / Other' },
  ]
  const funnelStages = [
    { key: 'leads_to_demo', label: 'Leads → Demo' },
    { key: 'demo_to_sql', label: 'Demo → SQL' },
    { key: 'sql_to_opportunity', label: 'SQL → Opportunity' },
    { key: 'opportunity_to_customer', label: 'Opportunity → Customer' },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SourceBreakdownBar data={data} keys={sourceKeys} title="Lead Source Breakdown" />
      <FunnelChart data={data} stages={funnelStages} title="Conversion Funnel" />
    </div>
  )
}

function MQLsCharts({ data }: Props) {
  const pairs = [
    { actualKey: 'mqls_total', goalKey: 'goal_mqls', label: 'MQLs' },
    { actualKey: 'book_a_demo_total', goalKey: 'goal_demos', label: 'Book a Demo' },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <GoalsVsActualsBar data={data} pairs={pairs} title="MQLs — Goals vs Actuals" />
      <RadialGauge value={num(data, 'mql_to_demo_rate')} label="MQL → Demo Rate" title="Conversion Rate" />
    </div>
  )
}

function AdsCharts({ sectionKey, weekStart }: Props) {
  const barMetrics: MetricDef[] = [
    { key: 'spend_total', label: 'Total Spend', unit: 'currency' },
    { key: 'conversions', label: 'Conversions', unit: 'number' },
    { key: 'demos_booked', label: 'Demos Booked', unit: 'number' },
  ]
  const trendMetrics: MetricDef[] = [
    { key: 'clicks', label: 'Clicks', unit: 'number' },
    { key: 'impressions', label: 'Impressions', unit: 'number' },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <MetricsChart sectionKey={sectionKey} weekStart={weekStart} metrics={barMetrics} />
      <MetricsChart sectionKey={sectionKey} weekStart={weekStart} metrics={trendMetrics} />
    </div>
  )
}

function SEOCharts({ sectionKey, weekStart }: Props) {
  const trendMetrics: MetricDef[] = [
    { key: 'organic_sessions', label: 'Organic Sessions', unit: 'number' },
  ]
  const barMetrics: MetricDef[] = [
    { key: 'keywords_top10', label: 'Top 10', unit: 'number' },
    { key: 'keywords_top20', label: 'Top 20', unit: 'number' },
    { key: 'keywords_top50', label: 'Top 50', unit: 'number' },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <MetricsChart sectionKey={sectionKey} weekStart={weekStart} metrics={trendMetrics} />
      <MetricsChart sectionKey={sectionKey} weekStart={weekStart} metrics={barMetrics} />
    </div>
  )
}

function EmailCharts({ data, sectionKey, weekStart }: Props) {
  // data used for DonutChart, sectionKey+weekStart for MetricsChart
  const barMetrics: MetricDef[] = [
    { key: 'emails_sent', label: 'Emails Sent', unit: 'number' },
    { key: 'unique_opens', label: 'Unique Opens', unit: 'number' },
    { key: 'clicks', label: 'Clicks', unit: 'number' },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <MetricsChart sectionKey={sectionKey} weekStart={weekStart} metrics={barMetrics} />
      <DonutChart value={num(data, 'open_rate')} label="Open Rate" title="Email Open Rate" />
    </div>
  )
}

function StudioSignupsCharts({ sectionKey, weekStart }: Props) {
  const barMetrics: MetricDef[] = [
    { key: 'new_signups', label: 'Total Sign-ups', unit: 'number' },
    { key: 'qualified_signups', label: 'Qualified Sign-ups', unit: 'number' },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <MetricsChart sectionKey={sectionKey} weekStart={weekStart} metrics={barMetrics} />
      <MetricsChart sectionKey={sectionKey} weekStart={weekStart} metrics={topNumericMetrics(sectionKey, 4)} />
    </div>
  )
}

function ArchitectCharts({ data, sectionKey, weekStart }: Props) {
  const pairs = [
    { actualKey: 'revenue', goalKey: 'goal_revenue', label: 'Revenue' },
  ]
  const trendMetrics: MetricDef[] = [
    { key: 'arr', label: 'ARR', unit: 'currency' },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <GoalsVsActualsBar data={data} pairs={pairs} title="Revenue — Goals vs Actuals" />
      <MetricsChart sectionKey={sectionKey} weekStart={weekStart} metrics={trendMetrics} />
    </div>
  )
}

function PartnerEmergingCharts({ data, sectionKey, weekStart }: Props) {
  const pairs = [
    { actualKey: 'new_partners', goalKey: 'goal_partners', label: 'New Partners' },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <GoalsVsActualsBar data={data} pairs={pairs} title="Partners — Goals vs Actuals" />
      <MetricsChart sectionKey={sectionKey} weekStart={weekStart} metrics={topNumericMetrics(sectionKey, 4)} />
    </div>
  )
}

function PartnerAWSCharts({ data, sectionKey, weekStart }: Props) {
  const pairs = [
    { actualKey: 'pipeline_value', goalKey: 'goal_pipeline', label: 'Pipeline' },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <GoalsVsActualsBar data={data} pairs={pairs} title="AWS — Goals vs Actuals" />
      <MetricsChart sectionKey={sectionKey} weekStart={weekStart} metrics={topNumericMetrics(sectionKey, 4)} />
    </div>
  )
}

function PartnerGSICharts({ data, sectionKey, weekStart }: Props) {
  const pairs = [
    { actualKey: 'pipeline_value', goalKey: 'goal_pipeline', label: 'Pipeline' },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <GoalsVsActualsBar data={data} pairs={pairs} title="GSI — Goals vs Actuals" />
      <MetricsChart sectionKey={sectionKey} weekStart={weekStart} metrics={topNumericMetrics(sectionKey, 4)} />
    </div>
  )
}

function LyzrGPTCharts({ data, sectionKey, weekStart }: Props) {
  const pairs = [
    { actualKey: 'active_users', goalKey: 'goal_users', label: 'Active Users' },
  ]
  const trendMetrics: MetricDef[] = [
    { key: 'sessions', label: 'Sessions', unit: 'number' },
    { key: 'new_signups', label: 'New Signups', unit: 'number' },
    { key: 'demos_booked', label: 'Demos', unit: 'number' },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <GoalsVsActualsBar data={data} pairs={pairs} title="Lyzr GPT — Goals vs Actuals" />
      <MetricsChart sectionKey={sectionKey} weekStart={weekStart} metrics={trendMetrics} />
    </div>
  )
}

function PrebuiltAgentsCharts({ data, sectionKey, weekStart }: Props) {
  const sourceKeys = [
    { key: 'installs', label: 'Agent Installs' },
    { key: 'active_users', label: 'Active Users' },
    { key: 'demos_booked', label: 'Demos from Agents' },
  ]
  const trendMetrics: MetricDef[] = [
    { key: 'installs', label: 'Installs', unit: 'number' },
    { key: 'active_users', label: 'Active Users', unit: 'number' },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SourceBreakdownBar data={data} keys={sourceKeys} title="Agent Metrics Breakdown" />
      <MetricsChart sectionKey={sectionKey} weekStart={weekStart} metrics={trendMetrics} />
    </div>
  )
}

function PlaybooksCharts({ data, sectionKey, weekStart }: Props) {
  const sourceKeys = [
    { key: 'ai_agents_playbook', label: 'AI Agents' },
    { key: 'hr_playbook', label: 'HR' },
    { key: 'banking_playbook', label: 'Banking' },
    { key: 'sales_playbook', label: 'Sales' },
    { key: 'insurance_playbook', label: 'Insurance' },
    { key: 'healthcare_playbook', label: 'Healthcare' },
    { key: 'other_playbooks', label: 'Other' },
  ]
  const funnelStages = [
    { key: 'total_downloads', label: 'Downloads' },
    { key: 'total_leads', label: 'Leads' },
    { key: 'demos_from_playbooks', label: 'Demos' },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SourceBreakdownBar data={data} keys={sourceKeys} title="Downloads by Playbook Type" />
      <FunnelChart data={data} stages={funnelStages} title="Playbook Conversion Funnel" />
    </div>
  )
}

function ContentCharts({ data, sectionKey, weekStart }: Props) {
  const sourceKeys = [
    { key: 'blogs_published', label: 'Blogs Published' },
    { key: 'blogs_in_progress', label: 'In Progress' },
    { key: 'case_studies_published', label: 'Case Studies' },
  ]
  const trendMetrics: MetricDef[] = [
    { key: 'blog_sessions', label: 'Blog Sessions', unit: 'number' },
    { key: 'blog_leads', label: 'Leads from Blog', unit: 'number' },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SourceBreakdownBar data={data} keys={sourceKeys} title="Content Output" />
      <MetricsChart sectionKey={sectionKey} weekStart={weekStart} metrics={trendMetrics} />
    </div>
  )
}

function EventsCharts({ data, sectionKey, weekStart }: Props) {
  const funnelStages = [
    { key: 'registrations', label: 'Registrations' },
    { key: 'attendees', label: 'Attendees' },
    { key: 'leads_from_events', label: 'Leads Generated' },
    { key: 'demos_from_events', label: 'Demos Booked' },
  ]
  const trendMetrics: MetricDef[] = [
    { key: 'events_attended', label: 'Events Attended', unit: 'number' },
    { key: 'events_hosted', label: 'Webinars Hosted', unit: 'number' },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FunnelChart data={data} stages={funnelStages} title="Event Conversion Funnel" />
      <MetricsChart sectionKey={sectionKey} weekStart={weekStart} metrics={trendMetrics} />
    </div>
  )
}

function PagesCharts({ data, sectionKey, weekStart }: Props) {
  const sourceKeys = [
    { key: 'pages_published', label: 'Published' },
    { key: 'pages_updated', label: 'Updated' },
    { key: 'landing_pages', label: 'Landing Pages' },
  ]
  const trendMetrics: MetricDef[] = [
    { key: 'page_sessions', label: 'Sessions', unit: 'number' },
    { key: 'conversions', label: 'Conversions', unit: 'number' },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SourceBreakdownBar data={data} keys={sourceKeys} title="Pages Output" />
      <MetricsChart sectionKey={sectionKey} weekStart={weekStart} metrics={trendMetrics} />
    </div>
  )
}

function GitAgentCharts({ sectionKey, weekStart }: Props) {
  const trendMetrics: MetricDef[] = [
    { key: 'active_users', label: 'Active Users', unit: 'number' },
    { key: 'repos_connected', label: 'Repos Connected', unit: 'number' },
    { key: 'tasks_completed', label: 'Tasks Completed', unit: 'number' },
  ]
  const revenueMetrics: MetricDef[] = [
    { key: 'revenue', label: 'Revenue', unit: 'currency' },
    { key: 'demos_booked', label: 'Demos', unit: 'number' },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <MetricsChart sectionKey={sectionKey} weekStart={weekStart} metrics={trendMetrics} />
      <MetricsChart sectionKey={sectionKey} weekStart={weekStart} metrics={revenueMetrics} />
    </div>
  )
}


/* ─── Router: maps sectionKey → chart component ─── */

const CHART_MAP: Record<string, React.FC<Props>> = {
  leads: LeadsCharts,
  mqls: MQLsCharts,
  ads: AdsCharts,
  seo: SEOCharts,
  email: EmailCharts,
  'studio-signups': StudioSignupsCharts,
  architect: ArchitectCharts,
  'partners-emerging': PartnerEmergingCharts,
  'partners-aws': PartnerAWSCharts,
  'partners-gsi': PartnerGSICharts,
  'lyzr-gpt': LyzrGPTCharts,
  'prebuilt-agents': PrebuiltAgentsCharts,
  content: ContentCharts,
  playbooks: PlaybooksCharts,
  events: EventsCharts,
  pages: PagesCharts,
  'git-agent': GitAgentCharts,
}

export function SectionCharts({ sectionKey, weekStart, data, customMetrics }: Props) {
  const ChartComponent = CHART_MAP[sectionKey]
  const numericCustom = (customMetrics ?? []).filter(m => m.unit !== 'text')

  return (
    <>
      {ChartComponent && (
        <ChartComponent sectionKey={sectionKey} weekStart={weekStart} data={data} customMetrics={customMetrics} />
      )}
      {numericCustom.length > 0 && (
        <MetricsChart sectionKey={sectionKey} weekStart={weekStart} metrics={numericCustom} />
      )}
    </>
  )
}
