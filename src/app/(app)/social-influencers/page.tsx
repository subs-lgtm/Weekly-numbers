'use client'

import { useState, useEffect } from 'react'
import { SectionShell } from '@/components/SectionShell'
import { TrendingUp, TrendingDown, Users, Youtube, Twitter, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWeek } from '@/lib/week-context'
import { TaskTextBoxes } from '@/components/shared/TaskTextBoxes'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
  BarChart, Bar,
} from 'recharts'

const CARD = 'rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]'
const TICK = { fontSize: 11, fill: '#7A6A60' }
const GRID_S = { strokeDasharray: '3 3', stroke: '#D4CBC0', strokeOpacity: 0.5, vertical: false as const }
const fmtY = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))

function Tip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-[14px] border border-[#D4CBC0] bg-white/95 px-4 py-3 shadow-[0_8px_32px_rgba(40,20,10,.10)]">
      <p className="eyebrow mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-[13px] text-[#2A1F1A]">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.stroke }} />
          <span className="text-[#7A6A60]">{p.name}:</span>
          <span className="font-[600]">{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ── LinkedIn Followers from Google Sheet (auto-synced) ── */

interface LinkedInRow {
  month: string
  goal: number | null
  actual: number | null
}

function LinkedInFollowersChart({ data }: { data: LinkedInRow[] }) {
  const chartData = data
    .filter(d => d.actual !== null || d.goal !== null)
    .map(d => ({
      month: d.month,
      'Actual Followers': d.actual,
      'Goal': d.goal,
    }))

  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">LinkedIn Followers — Goals vs Actuals (Auto-synced from Sheet)</p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid {...GRID_S} />
          <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={fmtY} />
          <Tooltip content={<Tip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#7A6A60', paddingTop: 8 }} />
          <Line type="monotone" dataKey="Goal" stroke="#C96A5A" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4, fill: '#C96A5A', strokeWidth: 2, stroke: '#fff' }} />
          <Line type="monotone" dataKey="Actual Followers" stroke="#6B4C4C" strokeWidth={2.5} dot={{ r: 5, fill: '#6B4C4C', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function LinkedInGrowthBar({ data }: { data: LinkedInRow[] }) {
  const chartData = data
    .filter((d, i) => d.actual !== null && i > 0)
    .map((d, i, arr) => {
      const prev = i === 0 ? data.find(x => x.actual !== null)?.actual || 0 : arr[i - 1].actual || 0
      const growth = (d.actual || 0) - (prev || 0)
      return { month: d.month, 'Monthly Growth': growth > 0 ? growth : 0 }
    })

  if (chartData.length === 0) return null

  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">Monthly Follower Growth</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid {...GRID_S} />
          <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={fmtY} />
          <Tooltip content={<Tip />} />
          <Bar dataKey="Monthly Growth" fill="#6B4C4C" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function LinkedInSheetSection() {
  const [data, setData] = useState<LinkedInRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/linkedin-followers')
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error)
        else setData(res.data || [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className={CARD}><p className="text-[13px] text-[#7A6A60]">Loading LinkedIn data from sheet...</p></div>
  if (error) return <div className="rounded-[20px] border border-red-200 bg-red-50 p-5 text-red-700 text-[14px]">Error: {error}</div>
  if (data.length === 0) return null

  const latest = [...data].reverse().find(d => d.actual !== null)
  const latestGoal = latest ? data.find(d => d.month === latest.month)?.goal : null
  const prevMonth = data.length >= 2 ? data[data.length - 2] : null
  const growth = latest?.actual && prevMonth?.actual ? latest.actual - prevMonth.actual : 0

  return (
    <div className="space-y-4">
      {/* Score cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {latest?.actual && (
          <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
            <div className="inline-flex items-center justify-center rounded-full p-2 mb-3 bg-[rgba(107,76,76,.08)] text-[#6B4C4C]"><Users className="h-4 w-4" /></div>
            <p className="eyebrow mb-1">Current Followers</p>
            <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">{latest.actual.toLocaleString()}</p>
            <p className="caption mt-1">{latest.month}</p>
          </div>
        )}
        {latestGoal && (
          <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
            <div className="inline-flex items-center justify-center rounded-full p-2 mb-3 bg-[rgba(201,106,90,.08)] text-[#C96A5A]"><Target className="h-4 w-4" /></div>
            <p className="eyebrow mb-1">Current Goal</p>
            <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">{latestGoal.toLocaleString()}</p>
            <p className="caption mt-1">{latest?.actual && latestGoal ? `${Math.round((latest.actual / latestGoal) * 100)}% achieved` : ''}</p>
          </div>
        )}
        {growth !== 0 && (
          <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
            <div className={cn("inline-flex items-center justify-center rounded-full p-2 mb-3", growth > 0 ? "bg-[rgba(22,163,74,.08)] text-[#16A34A]" : "bg-[rgba(220,38,38,.08)] text-[#DC2626]")}>
              {growth > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            </div>
            <p className="eyebrow mb-1">Last Month Growth</p>
            <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">{growth > 0 ? '+' : ''}{growth.toLocaleString()}</p>
            <p className="caption mt-1">vs {prevMonth?.month}</p>
          </div>
        )}
      </div>

      <LinkedInFollowersChart data={data} />
      <LinkedInGrowthBar data={data} />
    </div>
  )
}

/* ── YouTube Subscribers from Google Sheet (auto-synced) ── */

interface YouTubeRow {
  month: string
  goal: number | null
  actual: number | null
}

function YouTubeFollowersChart({ data }: { data: YouTubeRow[] }) {
  const chartData = data
    .filter(d => d.actual !== null || d.goal !== null)
    .map(d => ({
      month: d.month,
      'Actual Subscribers': d.actual,
      'Goal': d.goal,
    }))

  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">YouTube Subscribers — Goals vs Actuals (Auto-synced from Sheet)</p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid {...GRID_S} />
          <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={fmtY} />
          <Tooltip content={<Tip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#7A6A60', paddingTop: 8 }} />
          <Line type="monotone" dataKey="Goal" stroke="#F87171" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4, fill: '#F87171', strokeWidth: 2, stroke: '#fff' }} />
          <Line type="monotone" dataKey="Actual Subscribers" stroke="#DC2626" strokeWidth={2.5} dot={{ r: 5, fill: '#DC2626', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function YouTubeGrowthBar({ data }: { data: YouTubeRow[] }) {
  const chartData = data
    .filter((d, i) => d.actual !== null && i > 0)
    .map((d, i, arr) => {
      const prev = i === 0 ? data.find(x => x.actual !== null)?.actual || 0 : arr[i - 1].actual || 0
      const growth = (d.actual || 0) - (prev || 0)
      return { month: d.month, 'Monthly Growth': growth > 0 ? growth : 0 }
    })

  if (chartData.length === 0) return null

  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">Monthly Subscriber Growth</p>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid {...GRID_S} />
          <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={fmtY} />
          <Tooltip content={<Tip />} />
          <Bar dataKey="Monthly Growth" fill="#DC2626" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function YouTubeSheetSection() {
  const [data, setData] = useState<YouTubeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/youtube-followers')
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error)
        else setData(res.data || [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className={CARD}><p className="text-[13px] text-[#7A6A60]">Loading YouTube data from sheet...</p></div>
  if (error) return <div className="rounded-[20px] border border-red-200 bg-red-50 p-5 text-red-700 text-[14px]">Error: {error}</div>
  if (data.length === 0) return null

  const latest = [...data].reverse().find(d => d.actual !== null)
  const latestGoal = latest ? data.find(d => d.month === latest.month)?.goal : null
  const prevMonth = data.length >= 2 ? data[data.length - 2] : null
  const growth = latest?.actual && prevMonth?.actual ? latest.actual - prevMonth.actual : 0

  return (
    <div className="space-y-4">
      {/* Score cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {latest?.actual && (
          <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
            <div className="inline-flex items-center justify-center rounded-full p-2 mb-3 bg-[rgba(220,38,38,.08)] text-[#DC2626]"><Youtube className="h-4 w-4" /></div>
            <p className="eyebrow mb-1">Current Subscribers</p>
            <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">{latest.actual.toLocaleString()}</p>
            <p className="caption mt-1">{latest.month}</p>
          </div>
        )}
        {latestGoal && (
          <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
            <div className="inline-flex items-center justify-center rounded-full p-2 mb-3 bg-[rgba(248,113,113,.08)] text-[#F87171]"><Target className="h-4 w-4" /></div>
            <p className="eyebrow mb-1">Current Goal</p>
            <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">{latestGoal.toLocaleString()}</p>
            <p className="caption mt-1">{latest?.actual && latestGoal ? `${Math.round((latest.actual / latestGoal) * 100)}% achieved` : ''}</p>
          </div>
        )}
        {growth !== 0 && (
          <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
            <div className={cn("inline-flex items-center justify-center rounded-full p-2 mb-3", growth > 0 ? "bg-[rgba(22,163,74,.08)] text-[#16A34A]" : "bg-[rgba(220,38,38,.08)] text-[#DC2626]")}>
              {growth > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            </div>
            <p className="eyebrow mb-1">Last Month Growth</p>
            <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">{growth > 0 ? '+' : ''}{growth.toLocaleString()}</p>
            <p className="caption mt-1">vs {prevMonth?.month}</p>
          </div>
        )}
      </div>

      <YouTubeFollowersChart data={data} />
      <YouTubeGrowthBar data={data} />
    </div>
  )
}

/* ── YouTube Views from Google Sheet (auto-synced) ── */

interface YouTubeViewsRow {
  week: string
  watchTimeGoal: number | null
  watchTime: number | null
  views: number | null
  impressions: number | null
}

function YouTubeWatchTimeChart({ data }: { data: YouTubeViewsRow[] }) {
  const chartData = data
    .filter(d => d.watchTime !== null || d.watchTimeGoal !== null)
    .map(d => ({
      week: d.week,
      'Watch Time (hrs)': d.watchTime,
      'Goal': d.watchTimeGoal,
    }))

  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">YouTube Watch Time — Goals vs Actuals (Auto-synced)</p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid {...GRID_S} />
          <XAxis dataKey="week" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={fmtY} />
          <Tooltip content={<Tip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#7A6A60', paddingTop: 8 }} />
          <Line type="monotone" dataKey="Goal" stroke="#F87171" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3, fill: '#F87171', strokeWidth: 2, stroke: '#fff' }} />
          <Line type="monotone" dataKey="Watch Time (hrs)" stroke="#7C3AED" strokeWidth={2.5} dot={{ r: 4, fill: '#7C3AED', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function YouTubeViewsChart({ data }: { data: YouTubeViewsRow[] }) {
  const chartData = data
    .filter(d => d.views !== null)
    .map(d => ({
      week: d.week,
      'Views': d.views,
      'Impressions': d.impressions,
    }))

  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">YouTube Views & Impressions</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid {...GRID_S} />
          <XAxis dataKey="week" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} tickFormatter={fmtY} />
          <Tooltip content={<Tip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#7A6A60', paddingTop: 8 }} />
          <Bar dataKey="Views" fill="#7C3AED" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Impressions" fill="#C4B5FD" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function YouTubeViewsSheetSection() {
  const [data, setData] = useState<YouTubeViewsRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/youtube-views')
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error)
        else setData(res.data || [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className={CARD}><p className="text-[13px] text-[#7A6A60]">Loading YouTube Views data from sheet...</p></div>
  if (error) return <div className="rounded-[20px] border border-red-200 bg-red-50 p-5 text-red-700 text-[14px]">Error: {error}</div>
  if (data.length === 0) return null

  const latest = [...data].reverse().find(d => d.watchTime !== null)
  const totalViews = data.reduce((sum, d) => sum + (d.views || 0), 0)
  const totalWatchTime = data.reduce((sum, d) => sum + (d.watchTime || 0), 0)
  const totalImpressions = data.reduce((sum, d) => sum + (d.impressions || 0), 0)

  return (
    <div className="space-y-4">
      {/* Score cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {latest?.watchTime && (
          <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
            <div className="inline-flex items-center justify-center rounded-full p-2 mb-3 bg-[rgba(124,58,237,.08)] text-[#7C3AED]"><Youtube className="h-4 w-4" /></div>
            <p className="eyebrow mb-1">Latest Watch Time</p>
            <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">{latest.watchTime.toLocaleString()}h</p>
            <p className="caption mt-1">Week of {latest.week}</p>
          </div>
        )}
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
          <div className="inline-flex items-center justify-center rounded-full p-2 mb-3 bg-[rgba(124,58,237,.08)] text-[#7C3AED]"><TrendingUp className="h-4 w-4" /></div>
          <p className="eyebrow mb-1">Total Watch Time</p>
          <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">{totalWatchTime.toLocaleString()}h</p>
          <p className="caption mt-1">All time</p>
        </div>
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
          <div className="inline-flex items-center justify-center rounded-full p-2 mb-3 bg-[rgba(124,58,237,.08)] text-[#7C3AED]"><Target className="h-4 w-4" /></div>
          <p className="eyebrow mb-1">Total Views</p>
          <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">{totalViews.toLocaleString()}</p>
          <p className="caption mt-1">All time</p>
        </div>
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
          <div className="inline-flex items-center justify-center rounded-full p-2 mb-3 bg-[rgba(196,181,253,.15)] text-[#C4B5FD]"><Users className="h-4 w-4" /></div>
          <p className="eyebrow mb-1">Total Impressions</p>
          <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">{totalImpressions.toLocaleString()}</p>
          <p className="caption mt-1">All time</p>
        </div>
      </div>

      <YouTubeWatchTimeChart data={data} />
      <YouTubeViewsChart data={data} />
    </div>
  )
}

/* ── Influencers from Google Sheet (auto-synced) ── */

interface InfluencerRow {
  month: string
  twitterGoal: number | null
  twitterActual: number | null
  youtubeGoal: number | null
  youtubeActual: number | null
  linkedinGoal: number | null
  linkedinActual: number | null
  newsletterGoal: number | null
  newsletterActual: number | null
}

function InfluencersChart({ data }: { data: InfluencerRow[] }) {
  const chartData = data.map(d => ({
    month: d.month,
    'LinkedIn': d.linkedinActual,
    'Twitter': d.twitterActual,
    'YouTube': d.youtubeActual,
    'Newsletter': d.newsletterActual,
  }))

  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">Influencer Posts — Actuals by Platform (Auto-synced)</p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid {...GRID_S} />
          <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} />
          <Tooltip content={<Tip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#7A6A60', paddingTop: 8 }} />
          <Bar dataKey="LinkedIn" fill="#6B4C4C" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Twitter" fill="#2563EB" radius={[4, 4, 0, 0]} />
          <Bar dataKey="YouTube" fill="#DC2626" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Newsletter" fill="#16A34A" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function InfluencersGoalsChart({ data }: { data: InfluencerRow[] }) {
  const chartData = data.map(d => ({
    month: d.month,
    'LI Goal': d.linkedinGoal,
    'LI Actual': d.linkedinActual,
    'TW Goal': d.twitterGoal,
    'TW Actual': d.twitterActual,
    'YT Goal': d.youtubeGoal,
    'YT Actual': d.youtubeActual,
  }))

  return (
    <div className={CARD}>
      <p className="eyebrow mb-4">Influencer Goals vs Actuals</p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid {...GRID_S} />
          <XAxis dataKey="month" tick={TICK} axisLine={false} tickLine={false} />
          <YAxis tick={TICK} axisLine={false} tickLine={false} />
          <Tooltip content={<Tip />} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#7A6A60', paddingTop: 8 }} />
          <Line type="monotone" dataKey="LI Goal" stroke="#6B4C4C" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
          <Line type="monotone" dataKey="LI Actual" stroke="#6B4C4C" strokeWidth={2.5} dot={{ r: 4, fill: '#6B4C4C', strokeWidth: 2, stroke: '#fff' }} />
          <Line type="monotone" dataKey="TW Goal" stroke="#2563EB" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
          <Line type="monotone" dataKey="TW Actual" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 4, fill: '#2563EB', strokeWidth: 2, stroke: '#fff' }} />
          <Line type="monotone" dataKey="YT Goal" stroke="#DC2626" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
          <Line type="monotone" dataKey="YT Actual" stroke="#DC2626" strokeWidth={2.5} dot={{ r: 4, fill: '#DC2626', strokeWidth: 2, stroke: '#fff' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function InfluencersSheetSection() {
  const [data, setData] = useState<InfluencerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/influencers')
      .then(r => r.json())
      .then(res => {
        if (res.error) setError(res.error)
        else setData(res.data || [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className={CARD}><p className="text-[13px] text-[#7A6A60]">Loading Influencers data from sheet...</p></div>
  if (error) return <div className="rounded-[20px] border border-red-200 bg-red-50 p-5 text-red-700 text-[14px]">Error: {error}</div>
  if (data.length === 0) return null

  // Totals
  const totalLI = data.reduce((s, d) => s + (d.linkedinActual || 0), 0)
  const totalTW = data.reduce((s, d) => s + (d.twitterActual || 0), 0)
  const totalYT = data.reduce((s, d) => s + (d.youtubeActual || 0), 0)
  const totalNL = data.reduce((s, d) => s + (d.newsletterActual || 0), 0)
  const totalAll = totalLI + totalTW + totalYT + totalNL

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
          <p className="eyebrow mb-1">Total Posts</p>
          <p className="font-['Playfair_Display'] font-[500] text-[1.75rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">{totalAll}</p>
          <p className="caption mt-1">All platforms</p>
        </div>
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
          <div className="inline-flex items-center justify-center rounded-full p-1.5 mb-2 bg-[rgba(107,76,76,.08)] text-[#6B4C4C]"><Users className="h-3.5 w-3.5" /></div>
          <p className="eyebrow mb-1">LinkedIn</p>
          <p className="font-['Playfair_Display'] font-[500] text-[1.5rem] text-[#2A1F1A]">{totalLI}</p>
        </div>
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
          <div className="inline-flex items-center justify-center rounded-full p-1.5 mb-2 bg-[rgba(37,99,235,.08)] text-[#2563EB]"><Twitter className="h-3.5 w-3.5" /></div>
          <p className="eyebrow mb-1">Twitter/X</p>
          <p className="font-['Playfair_Display'] font-[500] text-[1.5rem] text-[#2A1F1A]">{totalTW}</p>
        </div>
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
          <div className="inline-flex items-center justify-center rounded-full p-1.5 mb-2 bg-[rgba(220,38,38,.08)] text-[#DC2626]"><Youtube className="h-3.5 w-3.5" /></div>
          <p className="eyebrow mb-1">YouTube</p>
          <p className="font-['Playfair_Display'] font-[500] text-[1.5rem] text-[#2A1F1A]">{totalYT}</p>
        </div>
        <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
          <div className="inline-flex items-center justify-center rounded-full p-1.5 mb-2 bg-[rgba(22,163,74,.08)] text-[#16A34A]"><Target className="h-3.5 w-3.5" /></div>
          <p className="eyebrow mb-1">Newsletter</p>
          <p className="font-['Playfair_Display'] font-[500] text-[1.5rem] text-[#2A1F1A]">{totalNL}</p>
        </div>
      </div>

      <InfluencersChart data={data} />
      <InfluencersGoalsChart data={data} />
    </div>
  )
}

/* ── Page ── */

export default function Page() {
  const { weekStart } = useWeek()

  return (
    <SectionShell title="Social & Influencers" description="Auto-synced from Google Sheets — updates reflect immediately">
      <div className="space-y-8">
        {/* LinkedIn Followers — auto-synced from Google Sheet */}
        <div>
          <h2 className="text-[18px] font-[600] text-[#2A1F1A] mb-4">LinkedIn Followers</h2>
          <LinkedInSheetSection />
        </div>

        {/* YouTube Subscribers — auto-synced from Google Sheet */}
        <div>
          <h2 className="text-[18px] font-[600] text-[#2A1F1A] mb-4">YouTube Subscribers</h2>
          <YouTubeSheetSection />
        </div>

        {/* Tasks */}
        <TaskTextBoxes sectionKey="social-influencers" weekStart={weekStart} />
      </div>
    </SectionShell>
  )
}
