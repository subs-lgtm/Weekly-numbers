'use client'

import { useState, useMemo, useEffect } from 'react'
import { SectionShell } from '@/components/SectionShell'
import { SECTION_MAP } from '@/lib/metrics-config'
import { TaskTextBoxes } from '@/components/shared/TaskTextBoxes'
import { useWeek } from '@/lib/week-context'
import { addDays } from 'date-fns'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'

/* ─── Types ─── */
type LiveVideo = {
  id: string
  title: string
  category: string
  status: string
  platform: string
  publishDate: string
  script: string
  editor: string
  videoLink: string
}
const LIVE_STATUSES = ['Live', 'In Progress', 'Done', 'Scheduled', 'Yet to Start', 'Yet to Upload', 'Discarded', 'Delayed']
type Filters = { category: string; status: string; search: string }
const defaultFilters: Filters = { category: 'all', status: 'all', search: '' }

/* ─── Status badge colors ─── */
const STATUS_COLORS: Record<string, string> = {
  Done: '#16A34A',
  'In Progress': '#2563EB',
  Live: '#7C3AED',
  Scheduled: '#D97706',
  'Yet to Start': '#9CA3AF',
  'Yet to Upload': '#0891B2',
  Discarded: '#DC2626',
  Delayed: '#F59E0B',
}

/* ─── Card wrapper ─── */
const card = 'rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]'

/** Parse date strings like "15/05/2026" or "11/05/2026" or "2025-05-01" into Date */
function parseSheetDate(d: string): Date | null {
  if (!d) return null
  // Try DD/MM/YYYY first
  const ddmm = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (ddmm) return new Date(parseInt(ddmm[3]), parseInt(ddmm[2]) - 1, parseInt(ddmm[1]))
  // Try YYYY-MM-DD
  const iso = d.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]))
  // Try Date.parse as fallback
  const ts = Date.parse(d)
  return isNaN(ts) ? null : new Date(ts)
}

/** Check if a date string falls within the selected week (Mon-Sun) */
function isInWeek(dateStr: string, weekStart: string): boolean {
  const d = parseSheetDate(dateStr)
  if (!d) return true // If we can't parse, show it (don't hide)
  const start = new Date(weekStart + 'T00:00:00')
  const end = addDays(start, 7)
  return d >= start && d < end
}

export default function Page() {
  const { weekStart } = useWeek()
  const section = SECTION_MAP['content-engine']

  const [filters, setFilters] = useState<Filters>(defaultFilters)
  const [tableSearch, setTableSearch] = useState('')

  // Live video pipeline from Google Sheets
  const [liveVideos, setLiveVideos] = useState<LiveVideo[]>([])
  const [pipelineLoading, setPipelineLoading] = useState(true)

  // Live Instagram analytics from Google Sheets
  type IGChannel = {
    channel: string; followers: number; totalPosts: number; totalViews: number;
    totalLikes: number; totalComments: number; totalShares: number; totalSaves: number;
    totalFollows: number; avgSkipRate: string;
    posts: { date: string; views: number; likes: number; comments: number; reshares: number; shares: number; saves: number; profileVisits: number; follows: number; skipRate: string }[]
  }
  const [igChannels, setIgChannels] = useState<IGChannel[]>([])
  const [igLoading, setIgLoading] = useState(true)
  const [selectedIgChannel, setSelectedIgChannel] = useState<string>('Unfiltered Founder')

  useEffect(() => {
    fetch('/api/video-pipeline?tab=pipeline')
      .then(r => r.json())
      .then(data => { setLiveVideos(data.videos || []); setPipelineLoading(false) })
      .catch(() => setPipelineLoading(false))

    fetch('/api/video-pipeline?tab=instagram')
      .then(r => r.json())
      .then(data => { setIgChannels(data.channels || []); setIgLoading(false) })
      .catch(() => setIgLoading(false))
  }, [])

  const currentIg = igChannels.find(c => c.channel === selectedIgChannel)

  // Filter IG posts by selected week
  const filteredIgPosts = useMemo(() => {
    if (!currentIg) return []
    return currentIg.posts.filter(p => isInWeek(p.date, weekStart))
  }, [currentIg, weekStart])

  // Recalculate IG metrics for the selected week only
  const weekIgMetrics = useMemo(() => {
    if (filteredIgPosts.length === 0) return null
    return {
      totalViews: filteredIgPosts.reduce((s, p) => s + p.views, 0),
      totalLikes: filteredIgPosts.reduce((s, p) => s + p.likes, 0),
      totalShares: filteredIgPosts.reduce((s, p) => s + p.shares + p.reshares, 0),
      avgSkipRate: (filteredIgPosts.reduce((s, p) => s + (parseFloat(p.skipRate) || 0), 0) / filteredIgPosts.length).toFixed(1),
    }
  }, [filteredIgPosts])

  // Tracking data (goals vs actuals per week)
  type TrackingWeek = { week: string; goal: number; tuf: number; olc: number; itl: number; pn: number; total: number }
  const [trackingWeeks, setTrackingWeeks] = useState<TrackingWeek[]>([])

  useEffect(() => {
    fetch('/api/video-pipeline?tab=tracking')
      .then(r => r.json())
      .then(data => setTrackingWeeks(data.weeks || []))
      .catch(() => {})
  }, [])

  // Derive unique categories from live data
  const liveCategories = useMemo(() => [...new Set(liveVideos.map(v => v.category).filter(Boolean))], [liveVideos])

  /* ─── Filtered videos (live data, filtered by selected week) ─── */
  const filtered = useMemo(() => {
    return liveVideos.filter((v) => {
      // Week filter — only show videos published in the selected week
      if (!isInWeek(v.publishDate, weekStart)) return false
      if (filters.category !== 'all' && v.category !== filters.category) return false
      if (filters.status !== 'all' && v.status !== filters.status) return false
      const q = (filters.search + ' ' + tableSearch).trim().toLowerCase()
      if (q && !v.title.toLowerCase().includes(q)) return false
      return true
    })
  }, [filters, tableSearch, liveVideos, weekStart])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    LIVE_STATUSES.forEach((s) => (c[s] = 0))
    filtered.forEach((v) => (c[v.status] = (c[v.status] ?? 0) + 1))
    return c
  }, [filtered])

  /* ─── Best performers (from live data — videos with "Live" status in selected week) ─── */
  const topVideos = useMemo(
    () => liveVideos.filter(v => v.status === 'Live' && isInWeek(v.publishDate, weekStart)).slice(0, 5),
    [liveVideos, weekStart],
  )

  const channelTotals = useMemo(() => {
    const map: Record<string, number> = {}
    // Use live data — count videos per platform in the selected week
    liveVideos.forEach((v) => {
      if (v.status === 'Live' && isInWeek(v.publishDate, weekStart)) {
        const ch = v.platform || 'Other'
        map[ch] = (map[ch] ?? 0) + 1
      }
    })
    return Object.entries(map).filter(([, v]) => v > 0).map(([channel, score]) => ({ channel, score }))
  }, [liveVideos, weekStart])
  const topChannel = channelTotals.length > 0 ? channelTotals.reduce((a, b) => (a.score > b.score ? a : b)) : { channel: '—', score: 0 }

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }))

  return (
    <SectionShell title={section.label} description={section.description}>
      <div className="space-y-8">
        {/* Tasks */}
        <TaskTextBoxes sectionKey="content-engine" weekStart={weekStart} lastWeekKey="tasks_last_week" thisWeekKey="tasks_this_week" />

        {/* ─── Filter Bar ─── */}
        <div className={`grid grid-cols-1 gap-3 md:grid-cols-4 ${card}`}>
          <select value={filters.category} onChange={(e) => set('category', e.target.value)} className="rounded-lg border border-[#D4CBC0] bg-[#F9F5F1] px-3 py-2 text-sm text-[#2A1F1A] outline-none">
            <option value="all">All categories</option>
            {liveCategories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => set('status', e.target.value)} className="rounded-lg border border-[#D4CBC0] bg-[#F9F5F1] px-3 py-2 text-sm text-[#2A1F1A] outline-none">
            <option value="all">All statuses</option>
            {LIVE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select defaultValue="30d" className="rounded-lg border border-[#D4CBC0] bg-[#F9F5F1] px-3 py-2 text-sm text-[#2A1F1A] outline-none">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <input
            placeholder="Search videos…"
            value={filters.search}
            onChange={(e) => set('search', e.target.value)}
            className="rounded-lg border border-[#D4CBC0] bg-[#F9F5F1] px-3 py-2 text-sm text-[#2A1F1A] placeholder:text-[#7A6A60] outline-none"
          />
        </div>

        {/* ─── Pipeline Overview ─── */}
        <section className="space-y-4">
          <p className="eyebrow mb-4">PIPELINE OVERVIEW</p>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-9">
            <div className={card}>
              <div className="text-xs font-medium text-[#7A6A60]">Total in Pipeline</div>
              <div className="mt-2 text-2xl font-semibold text-[#6B4C4C]">{pipelineLoading ? '…' : filtered.length}</div>
            </div>
            {LIVE_STATUSES.map((s) => (
              <div key={s} className={card}>
                <div className="flex items-center gap-2 text-xs font-medium text-[#7A6A60]">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] || '#999' }} />
                  {s}
                </div>
                <div className="mt-2 text-2xl font-semibold text-[#2A1F1A]">{counts[s] || 0}</div>
              </div>
            ))}
          </div>

          {/* Video table */}
          <div className={`${card} !p-0 overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-[#D4CBC0] p-4">
              <h3 className="text-sm font-semibold text-[#2A1F1A]">Videos</h3>
              <input
                placeholder="Search this table…"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                className="max-w-xs rounded-lg border border-[#D4CBC0] bg-[#F9F5F1] px-3 py-1.5 text-sm text-[#2A1F1A] placeholder:text-[#7A6A60] outline-none"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#D4CBC0] bg-[#F9F5F1]">
                    <th className="px-4 py-3 text-left font-medium text-[#7A6A60]">Title</th>
                    <th className="px-4 py-3 text-left font-medium text-[#7A6A60]">Category</th>
                    <th className="px-4 py-3 text-left font-medium text-[#7A6A60]">Platform</th>
                    <th className="px-4 py-3 text-left font-medium text-[#7A6A60]">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-[#7A6A60]">Publish Date</th>
                    <th className="px-4 py-3 text-left font-medium text-[#7A6A60]">Editor</th>
                    <th className="px-4 py-3 text-left font-medium text-[#7A6A60]">Script</th>
                  </tr>
                </thead>
                <tbody>
                  {pipelineLoading ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-[#7A6A60]">Loading from Google Sheets…</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-[#7A6A60]">No videos match these filters.</td></tr>
                  ) : (
                    filtered.map((v) => (
                      <tr key={v.id} className="border-b border-[#D4CBC0] last:border-0 hover:bg-[#F9F5F1]/60">
                        <td className="px-4 py-3 font-medium text-[#2A1F1A]">
                          {v.videoLink ? <a href={v.videoLink} target="_blank" rel="noopener noreferrer" className="hover:underline">{v.title}</a> : v.title}
                        </td>
                        <td className="px-4 py-3 text-[#7A6A60]">{v.category}</td>
                        <td className="px-4 py-3 text-[#7A6A60]">{v.platform}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: (STATUS_COLORS[v.status] || '#999') + '18', color: STATUS_COLORS[v.status] || '#999' }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[v.status] || '#999' }} />
                            {v.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#7A6A60]">{v.publishDate}</td>
                        <td className="px-4 py-3 text-[#7A6A60]">{v.editor || '—'}</td>
                        <td className="px-4 py-3 text-[#7A6A60]">{v.script || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ─── Instagram Analytics (Live from Google Sheets) ─── */}
        <section className="space-y-4">
          <p className="eyebrow mb-4">INSTAGRAM ANALYTICS</p>

          {/* Channel selector */}
          <div className="flex flex-wrap gap-1 rounded-[20px] border border-[#D4CBC0] bg-white p-1 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
            {igChannels.map((c) => (
              <button key={c.channel} onClick={() => setSelectedIgChannel(c.channel)} className={`rounded-2xl px-3 py-1.5 text-xs font-medium transition-colors ${selectedIgChannel === c.channel ? 'bg-[#6B4C4C] text-white' : 'text-[#7A6A60] hover:bg-[#F9F5F1]'}`}>{c.channel}</button>
            ))}
          </div>

          {igLoading ? (
            <p className="text-sm text-[#7A6A60]">Loading Instagram data…</p>
          ) : currentIg ? (
            <>
              {/* Metric cards — week-filtered */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                <MetricCard label="Followers" value={currentIg.followers.toLocaleString()} />
                <MetricCard label="Views (this week)" value={weekIgMetrics ? weekIgMetrics.totalViews.toLocaleString() : '0'} />
                <MetricCard label="Likes (this week)" value={weekIgMetrics ? weekIgMetrics.totalLikes.toLocaleString() : '0'} />
                <MetricCard label="Shares (this week)" value={weekIgMetrics ? weekIgMetrics.totalShares.toLocaleString() : '0'} />
                <MetricCard label="Avg Skip Rate" value={weekIgMetrics ? `${weekIgMetrics.avgSkipRate}%` : '—'} />
              </div>

              {/* Views over time chart — week-filtered */}
              {filteredIgPosts.length > 0 && (
                <div className={card}>
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[#2A1F1A]">Views per Post — {currentIg.channel}</h3>
                    <span className="text-xs text-[#7A6A60]">Instagram · {filteredIgPosts.length} posts this week</span>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={filteredIgPosts.map(p => ({ name: p.date, views: p.views, likes: p.likes }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#D4CBC0" strokeOpacity={0.5} />
                        <XAxis dataKey="name" stroke="#7A6A60" fontSize={11} />
                        <YAxis stroke="#7A6A60" fontSize={12} />
                        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #D4CBC0', background: '#fff' }} />
                        <Bar dataKey="views" fill="#6B4C4C" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Posts table — week-filtered */}
              {filteredIgPosts.length > 0 ? (
                <div className={`${card} !p-0 overflow-hidden`}>
                  <div className="border-b border-[#D4CBC0] p-4">
                    <h3 className="text-sm font-semibold text-[#2A1F1A]">Post Details — {currentIg.channel}</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[#D4CBC0] bg-[#F9F5F1]">
                          <th className="px-4 py-3 text-left font-medium text-[#7A6A60]">Date</th>
                          <th className="px-4 py-3 text-left font-medium text-[#7A6A60]">Views</th>
                          <th className="px-4 py-3 text-left font-medium text-[#7A6A60]">Likes</th>
                          <th className="px-4 py-3 text-left font-medium text-[#7A6A60]">Comments</th>
                          <th className="px-4 py-3 text-left font-medium text-[#7A6A60]">Shares</th>
                          <th className="px-4 py-3 text-left font-medium text-[#7A6A60]">Saves</th>
                          <th className="px-4 py-3 text-left font-medium text-[#7A6A60]">Follows</th>
                          <th className="px-4 py-3 text-left font-medium text-[#7A6A60]">Skip Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredIgPosts.map((p, i) => (
                          <tr key={i} className="border-b border-[#D4CBC0] last:border-0 hover:bg-[#F9F5F1]/60">
                            <td className="px-4 py-3 font-medium text-[#2A1F1A]">{p.date}</td>
                            <td className="px-4 py-3 text-[#2A1F1A] font-semibold">{p.views.toLocaleString()}</td>
                            <td className="px-4 py-3 text-[#7A6A60]">{p.likes}</td>
                            <td className="px-4 py-3 text-[#7A6A60]">{p.comments}</td>
                            <td className="px-4 py-3 text-[#7A6A60]">{p.shares + p.reshares}</td>
                            <td className="px-4 py-3 text-[#7A6A60]">{p.saves}</td>
                            <td className="px-4 py-3 text-[#7A6A60]">{p.follows}</td>
                            <td className="px-4 py-3 text-[#7A6A60]">{p.skipRate}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#7A6A60]">No posts for this channel in the selected week.</p>
              )}
            </>
          ) : (
            <p className="text-sm text-[#7A6A60]">No data for this channel yet.</p>
          )}
        </section>

        {/* ─── Weekly Tracking (Goals vs Actuals) ─── */}
        {trackingWeeks.length > 0 && (
          <section className="space-y-4">
            <p className="eyebrow mb-4">WEEKLY TRACKING — GOALS VS ACTUALS</p>

            <div className={card}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#2A1F1A]">Cumulative Views Goal vs Actuals</h3>
                <span className="text-xs text-[#7A6A60]">All channels combined</span>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trackingWeeks} margin={{ top: 20, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D4CBC0" strokeOpacity={0.5} />
                    <XAxis dataKey="week" stroke="#7A6A60" fontSize={11} />
                    <YAxis stroke="#7A6A60" fontSize={12} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #D4CBC0', background: '#fff' }} />
                    <Line type="monotone" dataKey="goal" stroke="#D4CBC0" strokeWidth={2} strokeDasharray="6 3" name="Goal" dot={{ r: 3, fill: '#D4CBC0' }} />
                    <Line type="monotone" dataKey="total" stroke="#6B4C4C" strokeWidth={2.5} name="Actual" dot={{ r: 4, fill: '#6B4C4C' }}>
                      <LabelList dataKey="total" position="top" style={{ fontSize: 10, fill: '#6B4C4C', fontWeight: 600 }} formatter={(v: number) => v > 0 ? v.toLocaleString() : ''} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Per-channel breakdown table */}
            <div className={`${card} !p-0 overflow-hidden`}>
              <div className="border-b border-[#D4CBC0] p-4">
                <h3 className="text-sm font-semibold text-[#2A1F1A]">Per-Channel Weekly Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#D4CBC0] bg-[#F9F5F1]">
                      <th className="px-4 py-3 text-left font-medium text-[#7A6A60]">Week</th>
                      <th className="px-4 py-3 text-left font-medium text-[#7A6A60]">Goal</th>
                      <th className="px-4 py-3 text-left font-medium text-[#7A6A60]">Unfiltered Founder</th>
                      <th className="px-4 py-3 text-left font-medium text-[#7A6A60]">One Less Click</th>
                      <th className="px-4 py-3 text-left font-medium text-[#7A6A60]">In the Loop</th>
                      <th className="px-4 py-3 text-left font-medium text-[#7A6A60]">Patch Notes</th>
                      <th className="px-4 py-3 text-left font-medium text-[#6B4C4C] font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trackingWeeks.map((w, i) => (
                      <tr key={i} className="border-b border-[#D4CBC0] last:border-0 hover:bg-[#F9F5F1]/60">
                        <td className="px-4 py-3 font-medium text-[#2A1F1A]">{w.week}</td>
                        <td className="px-4 py-3 text-[#7A6A60]">{w.goal.toLocaleString()}</td>
                        <td className="px-4 py-3 text-[#7A6A60]">{w.tuf || '—'}</td>
                        <td className="px-4 py-3 text-[#7A6A60]">{w.olc || '—'}</td>
                        <td className="px-4 py-3 text-[#7A6A60]">{w.itl || '—'}</td>
                        <td className="px-4 py-3 text-[#7A6A60]">{w.pn || '—'}</td>
                        <td className="px-4 py-3 font-semibold text-[#6B4C4C]">{w.total || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* ─── Best Performers ─── */}
        <section className="space-y-4">
          <p className="eyebrow mb-4">BEST PERFORMERS</p>

          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
            {topVideos.map((v, i) => (
              <div key={v.id} className={`flex items-center gap-3 ${card}`}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[rgba(107,76,76,.08)] text-sm font-semibold text-[#6B4C4C]">#{i + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[#2A1F1A]">{v.title}</div>
                  <div className="mt-0.5 truncate text-xs text-[#7A6A60]">{v.platform} · {v.category}</div>
                </div>
                <span className="shrink-0 rounded-md bg-[#F9F5F1] px-2 py-0.5 text-[10px] font-semibold uppercase text-[#7A6A60]">{v.status}</span>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div className={card}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#2A1F1A]">Best Performing Channel — This Month</h3>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(107,76,76,.08)] px-2.5 py-0.5 text-xs font-medium text-[#6B4C4C]">🏆 {topChannel.channel}</span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={channelTotals}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D4CBC0" strokeOpacity={0.5} />
                  <XAxis dataKey="channel" stroke="#7A6A60" fontSize={11} />
                  <YAxis stroke="#7A6A60" fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #D4CBC0', background: '#fff' }} />
                  <Bar dataKey="score" radius={[6, 6, 0, 0]}>
                    {channelTotals.map((c) => (
                      <Cell key={c.channel} fill={c.channel === topChannel.channel ? '#6B4C4C' : '#D4CBC0'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>
      </div>
    </SectionShell>
  )
}

/* ─── Metric Card ─── */
function MetricCard({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div className={card}>
      <div className="text-xs font-medium text-[#7A6A60]">{label}</div>
      <div className="mt-1.5 text-xl font-semibold text-[#2A1F1A]">{value}</div>
      {delta && <div className="mt-1 text-xs font-medium text-emerald-600">{delta} vs last period</div>}
    </div>
  )
}
