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
    // "Docs & Tutorials" removed from the sidebar (and, since the Channel Scorecard derives its
    // channel list from this same array, from the scorecard too) per explicit request
    // 2026-09-21 — the page itself (/docs-tutorials) is untouched, just unlinked here, same
    // convention as the other "removed from nav, page kept" entries documented in CLAUDE.md.
    items: [
      { title: "DevRel", url: "/architect" },
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
 * the widening — that specific exclusion was never in question). "Collaterals" excluded
 * 2026-09-21 per explicit request — scorecard-only (unlike "Docs & Tutorials" the same day,
 * this one stays in the sidebar/Marketing group; only the screenshot shown was the scorecard
 * row, so only the scorecard listing was touched).
 */
const SCORECARD_EXCLUDED_URLS = new Set(["/ads/performance-report", "/collaterals"])

export type ScorecardChannel = { id: string; title: string; group: string }

/**
 * Tracking-only channels with no dedicated sidebar page — same pattern as Activity Summary's
 * "ABM"/"Hiring" category cards (CATEGORY_GROUPS in ActivitySummaryTable.tsx). Added 2026-09-21
 * per explicit request: "Marketing Automation (HubSpot)" and "Automation". These have fixed ids
 * (not derived from a URL) — since they're never removed from navGroups, this is the only place
 * their id is defined; keep it stable so existing Firestore score history doesn't orphan.
 */
const EXTRA_SCORECARD_CHANNELS: ScorecardChannel[] = [
  { id: "marketing-automation-hubspot", title: "Marketing Automation (HubSpot)", group: "Automation" },
  { id: "automation", title: "Automation", group: "Automation" },
]

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
  channels.push(...EXTRA_SCORECARD_CHANNELS)
  return channels
}
