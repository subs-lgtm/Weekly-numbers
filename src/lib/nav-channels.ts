/**
 * Single source of truth for sidebar nav items, kept separate from AppSidebar.tsx (which attaches
 * icons) so non-UI consumers — like the Channel Scorecard — can derive the channel list from the
 * exact same data without importing a "use client" component tree.
 */

export type NavItemData = { title: string; url: string }

export const summaryNav: NavItemData[] = [
  { title: "Summary", url: "/" },
  { title: "Channel Scorecard", url: "/channel-scorecard" },
  { title: "Executive Dashboard", url: "/executive" },
  { title: "MQLs", url: "/mqls" },
  { title: "MQL Monthly Trends", url: "/mqls/monthly-trends" },
  { title: "Leads", url: "/leads" },
  { title: "Agent Studio Leads", url: "/agent-studio-leads" },
]

export const navGroups: { label: string; items: NavItemData[] }[] = [
  {
    label: "SEO",
    items: [
      { title: "SEO", url: "/seo" },
      { title: "Content / Blogs", url: "/content" },
    ],
  },
  {
    label: "Performance Channel",
    items: [
      { title: "Ads", url: "/ads" },
      { title: "3-Month Ads Performance", url: "/ads/performance-report" },
      { title: "GSI/SI & Founder Amplification", url: "/gsi-si-founder-amplification" },
    ],
  },
  {
    label: "Website",
    items: [
      { title: "Website", url: "/pages" },
      { title: "UI/UX Design", url: "/ui-ux" },
      { title: "PR (News Channels)", url: "/pr-news" },
    ],
  },
  {
    label: "DevRel",
    items: [
      { title: "DevRel", url: "/architect" },
      { title: "Docs & Tutorials", url: "/docs-tutorials" },
    ],
  },
  {
    label: "Social & Influencers",
    items: [
      { title: "Social & Influencers", url: "/social-influencers" },
      { title: "Reddit", url: "/reddit" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { title: "Email Marketing", url: "/email" },
      { title: "Events", url: "/events" },
      { title: "Webinars", url: "/webinars" },
      { title: "Podcasts & Reach Out", url: "/podcasts" },
      { title: "Content Engine", url: "/content-engine" },
      { title: "Video Pipeline", url: "/video-pipeline" },
      { title: "Collaterals", url: "/collaterals" },
      { title: "Experiments & Videos", url: "/experiments-videos" },
      { title: "Spotlight CVC", url: "/spotlight-cvc" },
      { title: "Analyst Relations", url: "/analyst-relations" },
      { title: "G2", url: "/g2" },
    ],
  },
  {
    label: "Partners",
    items: [
      { title: "Emerging Partners", url: "/partners-emerging" },
      { title: "AWS & Hyperscalers", url: "/partners-aws" },
      { title: "GSI & SI", url: "/partners-gsi" },
    ],
  },
  {
    label: "Sales",
    items: [
      { title: "Meetings Tracker", url: "/meetings-tracker" },
      { title: "Sales Performance", url: "/sales-performance" },
      { title: "Reachout Activity", url: "/reachout-activity" },
    ],
  },
]

/**
 * Channel Scorecard's channel list — derived live from the sidebar's own nav groups, per explicit
 * user instruction ("Do not hardcode a separate list"). Originally scoped to just Performance
 * Channel / SEO / Website; widened on 2026-09-20 per explicit follow-up ("you have added only
 * some channels not the all... add all these channels") to every nav group below Overview —
 * i.e. everything in `navGroups` (SEO, Performance Channel, Website, DevRel, Social &
 * Influencers, Marketing, Partners, Sales). "3-Month Ads Performance" stays excluded — it's a
 * reporting sub-page of Ads, not a distinct channel (confirmed with user on 2026-09-20, before
 * the widening — that specific exclusion was never in question).
 */
const SCORECARD_EXCLUDED_URLS = new Set(["/ads/performance-report"])

export type ScorecardChannel = { id: string; title: string; group: string }

/** channel id = the nav url with leading slash stripped, e.g. "/seo" -> "seo" */
export function urlToChannelId(url: string): string {
  return url.replace(/^\//, "").replace(/\//g, "-")
}

export function getScorecardChannels(): ScorecardChannel[] {
  const channels: ScorecardChannel[] = []
  for (const group of navGroups) {
    for (const item of group.items) {
      if (SCORECARD_EXCLUDED_URLS.has(item.url)) continue
      channels.push({ id: urlToChannelId(item.url), title: item.title, group: group.label })
    }
  }
  return channels
}
