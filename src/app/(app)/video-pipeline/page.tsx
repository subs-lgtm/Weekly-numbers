'use client'

import { useState, useMemo, useEffect } from 'react'
import { SectionShell } from '@/components/SectionShell'
import { TaskTextBoxes } from '@/components/shared/TaskTextBoxes'
import { DomainRatingSlider } from '@/components/shared/DomainRatingSlider'
import { useWeek } from '@/lib/week-context'
import { addDays } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from 'recharts'

type Video = {
  id: string
  title: string
  category: string
  status: string
  platform: string
  publishDate: string
  script: string
  editor: string
  note: string
}

const STATUSES = ['Live', 'Scheduled', 'In Progress', 'Done', 'Yet to Start', 'Discarded', 'Delayed']
const STATUS_COLORS: Record<string, string> = {
  Live: '#7C3AED',
  Scheduled: '#D97706',
  'In Progress': '#2563EB',
  Done: '#16A34A',
  'Yet to Start': '#9CA3AF',
  Discarded: '#DC2626',
  Delayed: '#F59E0B',
}
const CARD = 'rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]'
const BAR_COLORS = ['#6B4C4C', '#C96A5A', '#D97706', '#16A34A', '#2563EB', '#7C3AED', '#0891B2', '#DC2626']

function parseSheetDate(d: string): Date | null {
  if (!d) return null
  const ddmm = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (ddmm) return new Date(parseInt(ddmm[3]), parseInt(ddmm[2]) - 1, parseInt(ddmm[1]))
  const iso = d.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]))
  const ts = Date.parse(d)
  return isNaN(ts) ? null : new Date(ts)
}

function isInRange(dateStr: string, start: string, end: string): boolean {
  const d = parseSheetDate(dateStr)
  if (!d) return true
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  return d >= s && d < e
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[10px] border border-[#D4CBC0] bg-white px-3 py-2 shadow-lg text-[12px]">
      <p className="font-[600] text-[#2A1F1A]">{payload[0].payload.name}</p>
      <p className="text-[#7A6A60]">{payload[0].value} videos</p>
    </div>
  )
}

export default function Page() {
  const { weekStart, queryStart, queryEnd } = useWeek()
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch('/api/video-pipeline?tab=video-all')
      .then(r => r.json())
      .then(data => { setVideos(data.videos || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const categories = useMemo(() => [...new Set(videos.map(v => v.category).filter(Boolean))].sort(), [videos])
  const platforms = useMemo(() => [...new Set(videos.map(v => v.platform).filter(Boolean))].sort(), [videos])

  // Filter by date range + filters
  const filtered = useMemo(() => {
    return videos.filter(v => {
      if (!isInRange(v.publishDate, queryStart, queryEnd)) return false
      if (filterCategory !== 'all' && v.category !== filterCategory) return false
      if (filterStatus !== 'all' && v.status !== filterStatus) return false
      if (filterPlatform !== 'all' && v.platform !== filterPlatform) return false
      if (search && !v.title.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [videos, queryStart, queryEnd, filterCategory, filterStatus, filterPlatform, search])

  // Status counts
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {}
    STATUSES.forEach(s => (c[s] = 0))
    filtered.forEach(v => (c[v.status] = (c[v.status] ?? 0) + 1))
    return c
  }, [filtered])

  // By category chart
  const byCategoryData = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(v => { map[v.category || 'Other'] = (map[v.category || 'Other'] || 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))
  }, [filtered])

  // By platform chart
  const byPlatformData = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(v => { map[v.platform || 'Other'] = (map[v.platform || 'Other'] || 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))
  }, [filtered])

  // By editor chart
  const byEditorData = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(v => { if (v.editor) map[v.editor] = (map[v.editor] || 0) + 1 })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }))
  }, [filtered])

  return (
    <SectionShell title="Video Pipeline" description="All video production — ads, brand films, LinkedIn, YouTube, assets">
      <div className="space-y-6">
        {/* Rating */}
        <DomainRatingSlider sectionKey="video-pipeline" weekStart={weekStart} sectionLabel="Video Pipeline" />

        {/* Tasks */}
        <TaskTextBoxes sectionKey="video-pipeline" weekStart={weekStart} lastWeekKey="tasks_last_week" thisWeekKey="tasks_this_week" />

        {/* Filter bar */}
        <div className={`grid grid-cols-1 gap-3 md:grid-cols-5 ${CARD}`}>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="rounded-lg border border-[#D4CBC0] bg-[#F9F5F1] px-3 py-2 text-sm text-[#2A1F1A] outline-none">
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="rounded-lg border border-[#D4CBC0] bg-[#F9F5F1] px-3 py-2 text-sm text-[#2A1F1A] outline-none">
            <option value="all">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} className="rounded-lg border border-[#D4CBC0] bg-[#F9F5F1] px-3 py-2 text-sm text-[#2A1F1A] outline-none">
            <option value="all">All Platforms</option>
            {platforms.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input
            placeholder="Search videos…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-lg border border-[#D4CBC0] bg-[#F9F5F1] px-3 py-2 text-sm text-[#2A1F1A] placeholder:text-[#7A6A60] outline-none md:col-span-2"
          />
        </div>

        {/* Status scorecards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
          <div className={CARD}>
            <div className="text-xs font-medium text-[#7A6A60]">Total</div>
            <div className="mt-2 text-2xl font-semibold text-[#6B4C4C]">{loading ? '…' : filtered.length}</div>
          </div>
          {STATUSES.map(s => (
            <div key={s} className={CARD}>
              <div className="flex items-center gap-2 text-xs font-medium text-[#7A6A60]">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
                {s}
              </div>
              <div className="mt-2 text-2xl font-semibold text-[#2A1F1A]">{statusCounts[s] || 0}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        {!loading && filtered.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* By Category */}
            <div className={CARD}>
              <p className="text-[13px] font-[600] text-[#2A1F1A] mb-3">By Category</p>
              <ResponsiveContainer width="100%" height={Math.max(160, byCategoryData.length * 32 + 30)}>
                <BarChart data={byCategoryData} layout="vertical" margin={{ left: 8, right: 40, top: 5, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11, fill: '#7A6A60' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                    {byCategoryData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                    <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: '#2A1F1A', fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* By Platform */}
            <div className={CARD}>
              <p className="text-[13px] font-[600] text-[#2A1F1A] mb-3">By Platform</p>
              <ResponsiveContainer width="100%" height={Math.max(160, byPlatformData.length * 32 + 30)}>
                <BarChart data={byPlatformData} layout="vertical" margin={{ left: 8, right: 40, top: 5, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: '#7A6A60' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20} fill="#2563EB">
                    <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: '#2A1F1A', fontWeight: 600 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* By Editor */}
            {byEditorData.length > 0 && (
              <div className={CARD}>
                <p className="text-[13px] font-[600] text-[#2A1F1A] mb-3">By Editor</p>
                <ResponsiveContainer width="100%" height={Math.max(160, byEditorData.length * 32 + 30)}>
                  <BarChart data={byEditorData} layout="vertical" margin={{ left: 8, right: 40, top: 5, bottom: 5 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 11, fill: '#7A6A60' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20} fill="#16A34A">
                      <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: '#2A1F1A', fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Video table */}
        <div className={`${CARD} !p-0 overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-[#D4CBC0] p-4">
            <h3 className="text-sm font-semibold text-[#2A1F1A]">All Videos</h3>
            <span className="text-xs text-[#7A6A60]">{filtered.length} videos</span>
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
                  <th className="px-4 py-3 text-left font-medium text-[#7A6A60]">Note</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-[#7A6A60]">Loading from Google Sheets…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-[#7A6A60]">No videos match these filters for the selected date range.</td></tr>
                ) : (
                  filtered.map(v => (
                    <tr key={v.id} className="border-b border-[#D4CBC0] last:border-0 hover:bg-[#F9F5F1]/60">
                      <td className="px-4 py-3 font-medium text-[#2A1F1A]">{v.title}</td>
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
                      <td className="px-4 py-3 text-[#7A6A60] max-w-[200px] truncate">{v.note || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </SectionShell>
  )
}
