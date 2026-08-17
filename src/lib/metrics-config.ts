/**
 * Central metrics config — defines every section and its metrics.
 * This drives both the inline edit tables and the Firestore data model.
 *
 * Firestore path: weekly_metrics/{weekStart}/{section}/{metricKey}
 * Document shape: { value: number, notes: string, updatedBy: string, updatedAt: Timestamp }
 */

export type MetricDef = {
  key: string
  label: string
  unit?: 'number' | 'currency' | 'percent' | 'text'
  description?: string
}

export type SectionDef = {
  key: string
  label: string
  description: string
  metrics: MetricDef[]
}

export const SECTIONS: SectionDef[] = [
  {
    key: 'ads',
    label: 'Ads / Performance Marketing',
    description: 'Campaign spend, MQLs, platform-wise spend, and performance metrics',
    metrics: [
      // Top-level WoW scorecards + line graph
      { key: 'total_spend', label: 'Total Spend Last Week', unit: 'currency' },
      { key: 'goal_spend', label: 'Goal Spend', unit: 'currency' },
      { key: 'total_mqls', label: "Total MQL's Last Week", unit: 'number' },
      { key: 'goal_mqls', label: "Goal MQL's", unit: 'number' },
      { key: 'cost_per_mql', label: 'Total Cost Per MQL Last Week', unit: 'currency' },
      // Platform-wise spend
      { key: 'spend_google', label: 'Google Ads Spend', unit: 'currency' },
      { key: 'spend_linkedin', label: 'LinkedIn Ads Spend', unit: 'currency' },
      { key: 'spend_meta', label: 'Meta Ads Spend', unit: 'currency' },
      // Performance scorecards
      { key: 'impressions', label: 'Impressions', unit: 'number' },
      { key: 'clicks', label: 'Clicks', unit: 'number' },
      { key: 'ctr', label: 'CTR (%)', unit: 'percent' },
      { key: 'cpm', label: 'CPM ($)', unit: 'currency' },
      { key: 'cpc', label: 'CPC ($)', unit: 'currency' },
      { key: 'conversions', label: 'Conversions', unit: 'number' },
      { key: 'cost_per_conversion', label: 'Cost Per Conversion', unit: 'currency' },
    ],
  },
  {
    key: 'seo',
    label: 'SEO',
    description: 'Organic traffic, clicks, impressions, backlinks, and keyword positions',
    metrics: [
      { key: 'organic_traffic', label: 'Organic Traffic', unit: 'number' },
      { key: 'goal_organic_traffic', label: 'Goal Organic Traffic', unit: 'number' },
      { key: 'total_backlinks', label: 'Total Backlinks', unit: 'number' },
    ],
  },
  {
    key: 'email',
    label: 'Email Marketing',
    description: 'Emails sent, open/click/reply rates, leads, and campaign data from Instantly',
    metrics: [
      { key: 'emails_sent', label: 'Total Emails Sent', unit: 'number' },
      { key: 'goal_emails_sent', label: 'Goal Emails Sent', unit: 'number' },
      { key: 'open_rate', label: 'Open Rate (%)', unit: 'percent' },
      { key: 'click_rate', label: 'Click Rate (%)', unit: 'percent' },
      { key: 'reply_rate', label: 'Reply Rate (%)', unit: 'percent' },
      { key: 'opportunities', label: 'Opportunities (from Instantly)', unit: 'number' },
    ],
  },
  {
    key: 'events',
    label: 'Events',
    description: 'Total leads, meetings booked, and tasks',
    metrics: [
      { key: 'total_leads', label: 'Total Number of Leads', unit: 'number' },
      { key: 'meetings_booked', label: 'Meetings Booked', unit: 'number' },
    ],
  },
  {
    key: 'mqls',
    label: 'MQLs',
    description: 'Overall MQLs, Meeting Booked — goals vs actuals WoW & MoM',
    metrics: [
      { key: 'mqls_total', label: 'Total MQLs', unit: 'number' },
      { key: 'goal_mqls', label: 'Goal MQLs (Monthly)', unit: 'number' },
      { key: 'mqls_qualified', label: 'Qualified MQLs', unit: 'number' },
      { key: 'meeting_booked', label: 'Meeting Booked', unit: 'number' },
      { key: 'mql_to_demo_rate', label: 'MQL → Demo Rate (%)', unit: 'percent' },
      { key: 'demos_booked_sdr', label: 'Demos Booked by SDRs', unit: 'number' },
      // Conversion funnel
      { key: 'sql_count', label: 'SQL (Demo Happened + Qualified)', unit: 'number' },
      { key: 'opportunity_count', label: 'Opportunities', unit: 'number' },
      { key: 'customer_count', label: 'Customers Won', unit: 'number' },
    ],
  },
  {
    key: 'leads',
    label: 'Leads',
    description: 'Total leads from HubSpot, domain breakup, and masterclass leads',
    metrics: [
      { key: 'leads_total', label: 'Total Leads', unit: 'number' },
      { key: 'goal_leads', label: 'Goal Leads', unit: 'number' },
      // Breakup by domain
      { key: 'leads_book_demo', label: 'Book a Demo', unit: 'number' },
      { key: 'leads_playbooks', label: 'Playbooks', unit: 'number' },
      { key: 'leads_studio', label: 'Agent Studio', unit: 'number' },
      { key: 'leads_lyzrgpt', label: 'LyzrGPT', unit: 'number' },
      { key: 'leads_prebuilt', label: 'Pre-Built Agents', unit: 'number' },
      { key: 'leads_partner', label: 'Partner / Emerging', unit: 'number' },
      { key: 'leads_masterclass', label: 'Masterclass / Events', unit: 'number' },
      { key: 'leads_contact_us', label: 'Contact Us', unit: 'number' },
      { key: 'leads_other', label: 'Other', unit: 'number' },
      // Masterclass specific
      { key: 'masterclass_leads', label: 'Masterclass Leads', unit: 'number' },
      { key: 'goal_masterclass', label: 'Goal Masterclass Leads', unit: 'number' },
    ],
  },
  {
    key: 'agent-studio-leads',
    label: 'Agent Studio Leads',
    description: 'Lead funnel, WoW/MoM trends, and priority breakdown for Agent Studio form submissions',
    metrics: [],
  },
  {
    key: 'okrs',
    label: "OKR's",
    description: 'Objectives & Key Results — qualitative weekly status',
    metrics: [],
  },
  {
    key: 'playbooks',
    label: 'Playbooks',
    description: 'Total leads, organic vs ads split, ad spend, and top playbooks',
    metrics: [
      { key: 'total_leads', label: 'Total Leads', unit: 'number' },
      { key: 'goal_leads', label: 'Goal Leads', unit: 'number' },
      { key: 'leads_organic', label: 'Leads — Organic', unit: 'number' },
      { key: 'leads_ads', label: 'Leads — Ads', unit: 'number' },
      { key: 'total_ad_spent', label: 'Total Ad Spent', unit: 'currency' },
      { key: 'cost_per_lead', label: 'Cost Per Playbook Lead', unit: 'currency' },
    ],
  },
  {
    key: 'content',
    label: 'Content / Blogs',
    description: 'Blogs, case studies, sessions, and leads',
    metrics: [
      { key: 'blogs_published', label: 'Blogs Published', unit: 'number' },
      { key: 'case_studies_published', label: 'Case Studies Published', unit: 'number' },
      { key: 'blog_sessions', label: 'Blog Sessions (GA4)', unit: 'number' },
      { key: 'case_study_sessions', label: 'Case Studies (GA4)', unit: 'number' },
      { key: 'leads_from_blogs', label: 'Leads from Blogs', unit: 'number' },
      { key: 'leads_from_case_studies', label: 'Leads from Case Studies', unit: 'number' },
    ],
  },
  {
    key: 'studio-signups',
    label: 'Agent Studio',
    description: 'Total users, signups — WoW & MoM goals vs actuals, lifetime totals',
    metrics: [
      { key: 'total_users', label: 'Total Users', unit: 'number' },
      { key: 'goal_users', label: 'Goal Users', unit: 'number' },
      { key: 'signups_last_week', label: 'Signups Last Week', unit: 'number' },
      { key: 'signups_mtd', label: 'Signups MoM', unit: 'number' },
      { key: 'lifetime_signups', label: 'Lifetime Total Signups', unit: 'number' },
    ],
  },
  {
    key: 'architect',
    label: 'Architect',
    description: 'LTR, subscriptions, MRR/ARR, top-ups, and tasks',
    metrics: [
      // Core metrics
      { key: 'ltr', label: 'LTR', unit: 'number' },
      { key: 'total_paid_subs', label: 'Total Paid Subscriptions', unit: 'number' },
      { key: 'goal_paid_subs', label: 'Goal Paid Subscriptions', unit: 'number' },
      { key: 'cancelled_subs', label: 'Cancelled Subscriptions', unit: 'number' },
      // Users
      { key: 'total_users', label: 'Total Number of Users', unit: 'number' },
      { key: 'studio_users', label: 'Studio Users', unit: 'number' },
      { key: 'apps_built', label: 'Apps Built on Architect', unit: 'number' },
      // Revenue
      { key: 'lifetime_revenue', label: 'Lifetime Revenue ($)', unit: 'currency' },
      { key: 'mrr', label: 'MRR This Week ($)', unit: 'currency' },
      { key: 'mrr_month', label: 'MRR This Month ($)', unit: 'currency' },
      { key: 'goal_mrr', label: 'Goal MRR ($)', unit: 'currency' },
      { key: 'arr', label: 'ARR ($)', unit: 'currency' },
      { key: 'goal_arr', label: 'Goal ARR ($)', unit: 'currency' },
      { key: 'studio_plan_to_app', label: 'Studio Plan Purchased → App Built', unit: 'number' },
      // Subscriptions breakdown
      { key: 'total_active_subs', label: 'Total Active Subscriptions', unit: 'number' },
      { key: 'active_40_monthly', label: 'Active $40/mon Users', unit: 'number' },
      { key: 'active_20_monthly', label: 'Active $20/mon Users', unit: 'number' },
      { key: 'active_420_yearly', label: 'Active $420/yr Users', unit: 'number' },
      { key: 'active_200_yearly', label: 'Active $200/yr Users', unit: 'number' },
      // Top-ups
      { key: 'topup_25_count', label: 'Top-Up $25 Count', unit: 'number' },
      { key: 'topup_50_count', label: 'Top-Up $50 Count', unit: 'number' },
      { key: 'topup_100_count', label: 'Top-Up $100 Count', unit: 'number' },
    ],
  },
  {
    key: 'lyzr-gpt',
    label: 'Lyzr GPT',
    description: 'Total MQLs, ad spend — WoW & MoM goals vs actuals',
    metrics: [
      { key: 'total_mqls', label: "Total MQL's", unit: 'number' },
      { key: 'goal_mqls', label: "Goal MQL's", unit: 'number' },
      { key: 'total_ad_spent', label: 'Total Ad Spent: Last Week', unit: 'currency' },
    ],
  },
  {
    key: 'partners-emerging',
    label: 'Emerging Partners',
    description: 'MQLs, partners onboarded, ad spend, and tasks',
    metrics: [
      { key: 'total_mqls', label: "Total MQL's", unit: 'number' },
      { key: 'partners_onboarded', label: 'Total Partners Onboarded', unit: 'number' },
      { key: 'goal_partners_onboarded', label: 'Goal Partners Onboarded', unit: 'number' },
      { key: 'total_ad_spent', label: 'Total Ad Spent', unit: 'currency' },
    ],
  },
  {
    key: 'partners-aws',
    label: 'AWS & Hyperscalers',
    description: "Total MQL's — WoW goals vs actuals bar graph",
    metrics: [
      { key: 'total_mqls', label: "Total MQL's", unit: 'number' },
      { key: 'goal_mqls', label: "Goal MQL's", unit: 'number' },
    ],
  },
  {
    key: 'partners-gsi',
    label: 'GSI & SI Partners',
    description: 'Conversations, pipeline, funnel leads, and ad spend',
    metrics: [
      { key: 'conversations_started', label: 'Conversations Started', unit: 'number' },
      { key: 'goal_conversations', label: 'Goal Conversations', unit: 'number' },
      { key: 'lifetime_conversations', label: 'Total Conversations Started (Lifetime)', unit: 'number' },
      { key: 'potential_pipeline', label: 'Potential Pipeline', unit: 'currency' },
      { key: 'top_funnel_leads', label: 'Top Funnel Leads', unit: 'number' },
      { key: 'middle_funnel_leads', label: 'Middle Funnel Leads', unit: 'number' },
      { key: 'bottom_funnel_leads', label: 'Bottom Funnel Leads', unit: 'number' },
      { key: 'ad_spend', label: 'Ad Spend', unit: 'currency' },
    ],
  },
  {
    key: 'pages',
    label: 'Website',
    description: 'Pages by CMS/type, published, updated, and tasks',
    metrics: [
      { key: 'pages_by_cms', label: 'Number of Pages by CMS/Type', unit: 'number' },
      { key: 'pages_published', label: 'Pages Published', unit: 'number' },
      { key: 'pages_updated', label: 'Pages Updated', unit: 'number' },
    ],
  },
  {
    key: 'git-agent',
    label: 'OSS',
    description: 'Open source metrics — stars, spend, and tasks',
    metrics: [
      { key: 'total_stars', label: 'Total Stars', unit: 'number' },
      { key: 'goal_stars', label: 'Goal Stars', unit: 'number' },
      { key: 'total_spend', label: 'Total Spend', unit: 'currency' },
    ],
  },
  {
    key: 'social-influencers',
    label: 'Social & Influencers',
    description: 'LinkedIn, YouTube, Twitter/X growth and MQLs from social',
    metrics: [
      // LinkedIn
      { key: 'linkedin_followers', label: 'LinkedIn Followers (Total)', unit: 'number' },
      { key: 'quarterly_goal_followers', label: 'LinkedIn Quarterly Goal', unit: 'number' },
      // YouTube
      { key: 'youtube_subscribers', label: 'YouTube Subscribers', unit: 'number' },
      { key: 'youtube_views', label: 'YouTube Views (This Week)', unit: 'number' },
      { key: 'youtube_goal_subs', label: 'YouTube Goal Subscribers', unit: 'number' },
      // Twitter/X
      { key: 'twitter_followers', label: 'Twitter/X Followers', unit: 'number' },
      { key: 'twitter_impressions', label: 'Twitter/X Impressions', unit: 'number' },
      // MQLs from social
      { key: 'mqls_from_social', label: 'MQLs from Social (HubSpot)', unit: 'number' },
    ],
  },
  {
    key: 'reddit',
    label: 'Reddit',
    description: 'Reddit posts, views, comments, upvotes — WoW goals vs actuals',
    metrics: [
      { key: 'total_posts', label: 'Total Posts', unit: 'number' },
      { key: 'goal_posts', label: 'Goal Posts', unit: 'number' },
      { key: 'total_views', label: 'Total Views', unit: 'number' },
      { key: 'goal_views', label: 'Goal Views', unit: 'number' },
      { key: 'total_comments', label: 'Total Comments', unit: 'number' },
      { key: 'goal_comments', label: 'Goal Comments', unit: 'number' },
      { key: 'total_upvotes', label: 'Total Upvotes', unit: 'number' },
      { key: 'goal_upvotes', label: 'Goal Upvotes', unit: 'number' },
    ],
  },
  {
    key: 'webinars',
    label: 'Webinars',
    description: 'Hosted webinars — registrations, attendees, leads, and tasks',
    metrics: [
      { key: 'webinars_hosted', label: 'Webinars Hosted', unit: 'number' },
      { key: 'total_registrations', label: 'Total Registrations', unit: 'number' },
      { key: 'total_attendees', label: 'Total Attendees', unit: 'number' },
      { key: 'attendance_rate', label: 'Attendance Rate (%)', unit: 'percent' },
      { key: 'leads_from_webinars', label: 'Leads from Webinars', unit: 'number' },
      { key: 'meetings_booked', label: 'Meetings Booked', unit: 'number' },
    ],
  },
  {
    key: 'agentpreneur',
    label: 'AgentPreneur',
    description: 'Tasks and updates',
    metrics: [],
  },
  {
    key: 'podcasts',
    label: 'Podcasts & Reach Out',
    description: 'Tasks and updates',
    metrics: [],
  },
  {
    key: 'content-engine',
    label: 'Content Engine',
    description: 'Tasks and updates',
    metrics: [],
  },
  {
    key: 'video-pipeline',
    label: 'Video Pipeline',
    description: 'All video production — ads, brand films, LinkedIn, YouTube',
    metrics: [],
  },
  {
    key: 'collaterals',
    label: 'Collaterals',
    description: 'Tasks and updates',
    metrics: [],
  },
  {
    key: 'ui-ux',
    label: 'UI/UX Design',
    description: 'Tasks and updates',
    metrics: [],
  },
  {
    key: 'experiments-videos',
    label: 'Experiments & Videos',
    description: 'Tasks and updates',
    metrics: [],
  },
  {
    key: 'pr-news',
    label: 'PR (News Channels)',
    description: 'Press coverage, news channel features, media outreach — tasks and updates',
    metrics: [],
  },
  {
    key: 'docs-tutorials',
    label: 'Documentations & Tutorials',
    description: 'Product docs, tutorials, how-to guides — tasks and updates',
    metrics: [],
  },
  {
    key: 'spotlight-cvc',
    label: 'Spotlight CVC',
    description: 'Customer / VC spotlight features, case highlights — tasks and updates',
    metrics: [],
  },
  {
    key: 'analyst-relations',
    label: 'Analyst Relations',
    description: 'Analyst engagement, briefings, and insights tracking',
    metrics: [],
  },
  {
    key: 'reachout-activity',
    label: 'Reachout Activity',
    description: 'Outbound touches, channel breakdown, Instantly email stats and campaign conversion — per BDR',
    metrics: [],
  },
  {
    key: 'g2',
    label: 'G2',
    description: 'G2 reviews, ratings, buyer intent signals, and growth tracking',
    metrics: [],
  },
]

export const SECTION_MAP = Object.fromEntries(SECTIONS.map(s => [s.key, s]))
