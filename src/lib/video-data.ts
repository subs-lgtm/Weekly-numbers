// DATA SOURCE — replace with Google Sheets / Notion integration later

export type VideoStatus =
  | "Done"
  | "In Progress"
  | "Live"
  | "Scheduled"
  | "Discarded"
  | "Delayed";

export const CATEGORIES = [
  "Ads",
  "Content Engine",
  "Product Video",
  "Event Video",
  "AI Brand Film",
  "Thunderclap Video",
] as const;

export const CONTENT_ENGINE_CHANNELS = [
  "Unfiltered Founder",
  "One Less Click",
  "Patch Notes",
  "In Loop",
] as const;

export const YOUTUBE_CHANNELS = [
  ...CONTENT_ENGINE_CHANNELS,
  "Lyzr Main Channel",
] as const;

export const STATUSES: VideoStatus[] = [
  "Done",
  "In Progress",
  "Live",
  "Scheduled",
  "Discarded",
  "Delayed",
];

export type Video = {
  id: string;
  title: string;
  category: (typeof CATEGORIES)[number];
  channel: string;
  status: VideoStatus;
  publishDate: string;
  notes: string;
  views?: number;
  engagement?: number;
  platform?: "YouTube" | "Instagram";
};

export const VIDEOS: Video[] = [
  { id: "1", title: "Why Founders Fail at Distribution", category: "Content Engine", channel: "Unfiltered Founder", status: "Live", publishDate: "2025-05-01", notes: "Performing well", views: 48200, engagement: 8.4, platform: "YouTube" },
  { id: "2", title: "One-Click Onboarding Demo", category: "Product Video", channel: "One Less Click", status: "Done", publishDate: "2025-05-05", notes: "Awaiting schedule", views: 12300, engagement: 6.1, platform: "YouTube" },
  { id: "3", title: "Patch v4.2 Walkthrough", category: "Content Engine", channel: "Patch Notes", status: "Scheduled", publishDate: "2025-05-12", notes: "QA pass done", views: 0, engagement: 0, platform: "YouTube" },
  { id: "4", title: "In Loop: Weekly AI Recap", category: "Content Engine", channel: "In Loop", status: "In Progress", publishDate: "2025-05-14", notes: "Editing", views: 0, engagement: 0, platform: "YouTube" },
  { id: "5", title: "Lyzr Brand Film 2025", category: "AI Brand Film", channel: "Lyzr Main Channel", status: "Live", publishDate: "2025-04-22", notes: "Hero asset", views: 91500, engagement: 9.2, platform: "YouTube" },
  { id: "6", title: "Spring Ads Campaign Cut A", category: "Ads", channel: "Lyzr Main Channel", status: "Delayed", publishDate: "2025-05-18", notes: "Awaiting brand approval", platform: "YouTube" },
  { id: "7", title: "DevCon Highlights Reel", category: "Event Video", channel: "Lyzr Main Channel", status: "Done", publishDate: "2025-05-08", notes: "Ready", views: 5400, engagement: 5.5, platform: "YouTube" },
  { id: "8", title: "Thunderclap: Launch Day", category: "Thunderclap Video", channel: "Unfiltered Founder", status: "Live", publishDate: "2025-04-30", notes: "Coordinated drop", views: 73200, engagement: 11.3, platform: "Instagram" },
  { id: "9", title: "OLC Reel: Friction Kills", category: "Content Engine", channel: "One Less Click", status: "Live", publishDate: "2025-05-03", notes: "Viral on IG", views: 142000, engagement: 14.8, platform: "Instagram" },
  { id: "10", title: "Patch Notes Mini #14", category: "Content Engine", channel: "Patch Notes", status: "Discarded", publishDate: "2025-04-25", notes: "Outdated", platform: "YouTube" },
  { id: "11", title: "In Loop Reel: Top 5 AI tools", category: "Content Engine", channel: "In Loop", status: "Live", publishDate: "2025-05-06", notes: "", views: 88500, engagement: 12.1, platform: "Instagram" },
  { id: "12", title: "Founder POV: Hiring at Series A", category: "Content Engine", channel: "Unfiltered Founder", status: "In Progress", publishDate: "2025-05-20", notes: "Script v3", platform: "YouTube" },
  { id: "13", title: "Product Tour 2.0", category: "Product Video", channel: "Lyzr Main Channel", status: "Scheduled", publishDate: "2025-05-15", notes: "Locked", platform: "YouTube" },
  { id: "14", title: "OLC: Less Clicks More Wins", category: "Content Engine", channel: "One Less Click", status: "Done", publishDate: "2025-05-09", notes: "", views: 23400, engagement: 7.8, platform: "YouTube" },
  { id: "15", title: "Patch Notes Live Stream", category: "Content Engine", channel: "Patch Notes", status: "Live", publishDate: "2025-05-02", notes: "", views: 31200, engagement: 9.0, platform: "YouTube" },
];

const months = ["Jan", "Feb", "Mar", "Apr", "May"];
const seed = (a: number, b: number) => months.map((m, i) => ({ name: m, value: Math.round(a + (b - a) * (i / 4) + Math.sin(i + a) * a * 0.1) }));

export const YT_ANALYTICS: Record<string, {
  views: { name: string; value: number }[];
  impressions: number;
  watchTime: number;
  engagement: number;
  subscribers: number;
  subDelta: number;
}> = {
  "Unfiltered Founder": { views: seed(8000, 24000), impressions: 412000, watchTime: 18420, engagement: 8.4, subscribers: 12400, subDelta: 320 },
  "One Less Click": { views: seed(5000, 16000), impressions: 280000, watchTime: 9800, engagement: 6.9, subscribers: 7200, subDelta: 145 },
  "Patch Notes": { views: seed(3000, 11000), impressions: 198000, watchTime: 7200, engagement: 7.5, subscribers: 4800, subDelta: 92 },
  "In Loop": { views: seed(4000, 13500), impressions: 230000, watchTime: 8600, engagement: 8.1, subscribers: 6100, subDelta: 188 },
  "Lyzr Main Channel": { views: seed(15000, 48000), impressions: 920000, watchTime: 41200, engagement: 9.2, subscribers: 28500, subDelta: 612 },
};

export const IG_ANALYTICS: Record<string, {
  views: { name: string; value: number }[];
  impressions: number;
  reach: number;
  engagement: number;
  followers: number;
  followerDelta: number;
}> = {
  "Unfiltered Founder": { views: seed(20000, 80000), impressions: 520000, reach: 410000, engagement: 11.3, followers: 18400, followerDelta: 540 },
  "One Less Click": { views: seed(30000, 142000), impressions: 880000, reach: 690000, engagement: 14.8, followers: 24500, followerDelta: 980 },
  "Patch Notes": { views: seed(10000, 42000), impressions: 312000, reach: 240000, engagement: 9.4, followers: 8900, followerDelta: 220 },
  "In Loop": { views: seed(25000, 90000), impressions: 610000, reach: 480000, engagement: 12.1, followers: 16200, followerDelta: 470 },
};
