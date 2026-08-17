'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Loader2, Sparkles, RefreshCw, Mail, Calendar, Video, Search, Megaphone, FileText, Globe, Users, AlertTriangle, TrendingUp } from 'lucide-react'

type Props = {
  weekStart: string
}

// Channel config with distinct colors and icons
const CHANNELS = [
  { key: 'email', label: 'Email Marketing', icon: Mail, color: '#7C3AED', bg: 'rgba(124,58,237,.06)', border: 'rgba(124,58,237,.2)' },
  { key: 'events', label: 'Events', icon: Calendar, color: '#0891B2', bg: 'rgba(8,145,178,.06)', border: 'rgba(8,145,178,.2)' },
  { key: 'webinars', label: 'Webinars', icon: Video, color: '#DC2626', bg: 'rgba(220,38,38,.06)', border: 'rgba(220,38,38,.2)' },
  { key: 'seo', label: 'SEO', icon: Search, color: '#16A34A', bg: 'rgba(22,163,74,.06)', border: 'rgba(22,163,74,.2)' },
  { key: 'ads', label: 'Ads', icon: Megaphone, color: '#EA580C', bg: 'rgba(234,88,12,.06)', border: 'rgba(234,88,12,.2)' },
  { key: 'content', label: 'Content', icon: FileText, color: '#2563EB', bg: 'rgba(37,99,235,.06)', border: 'rgba(37,99,235,.2)' },
  { key: 'website', label: 'Website', icon: Globe, color: '#6B4C4C', bg: 'rgba(107,76,76,.06)', border: 'rgba(107,76,76,.2)' },
  { key: 'social', label: 'Social', icon: Users, color: '#D97706', bg: 'rgba(217,119,6,.06)', border: 'rgba(217,119,6,.2)' },
]

function parseChannelSections(markdown: string): { channels: Record<string, string>; overall: string; considerations: string } {
  const channels: Record<string, string> = {}
  let overall = ''
  let considerations = ''

  // Split by any level of header (###, ##, or #)
  const sections = markdown.split(/^#{1,3}\s+/gm)

  for (const section of sections) {
    if (!section.trim()) continue
    const firstLine = section.split('\n')[0].toLowerCase().trim()
    const body = section.split('\n').slice(1).join('\n').trim()

    if (firstLine.includes('email')) channels['email'] = body
    else if (firstLine.includes('event') && !firstLine.includes('webinar')) channels['events'] = body
    else if (firstLine.includes('webinar')) channels['webinars'] = body
    else if (firstLine.includes('seo')) channels['seo'] = body
    else if (firstLine.includes('ads') || firstLine.includes('performance marketing')) channels['ads'] = body
    else if (firstLine.includes('content') || firstLine.includes('blog')) channels['content'] = body
    else if (firstLine.includes('website')) channels['website'] = body
    else if (firstLine.includes('social')) channels['social'] = body
    else if (firstLine.includes('overall') || firstLine.includes('summary')) overall = body
    else if (firstLine.includes('consideration') || firstLine.includes('attention') || firstLine.includes('key')) considerations = body
  }

  return { channels, overall, considerations }
}

function formatBody(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^• (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>(\n)?)+/g, (m) => `<ul class="pl-4 my-1 list-disc">${m}</ul>`)
    .replace(/↑/g, '<span style="color:#16A34A;font-weight:600">↑</span>')
    .replace(/↓/g, '<span style="color:#DC2626;font-weight:600">↓</span>')
    .replace(/\n/g, '<br/>')
}

function ChannelCard({ channelKey, body }: { channelKey: string; body: string }) {
  const cfg = CHANNELS.find(c => c.key === channelKey)
  if (!cfg) return null
  const Icon = cfg.icon

  return (
    <div
      className="rounded-[16px] border p-4 shadow-[0_2px_12px_rgba(40,20,10,.04)] hover:shadow-[0_4px_20px_rgba(40,20,10,.08)] transition-shadow"
      style={{ borderColor: cfg.border, background: cfg.bg }}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: cfg.border }}>
          <Icon className="h-3.5 w-3.5" style={{ color: cfg.color }} />
        </div>
        <span className="text-[13px] font-[700] uppercase tracking-[0.08em]" style={{ color: cfg.color }}>
          {cfg.label}
        </span>
      </div>
      <div
        className="text-[12.5px] leading-[1.65] text-[#2A1F1A] [&_strong]:font-[600] [&_li]:my-0.5 [&_ul]:my-1"
        dangerouslySetInnerHTML={{ __html: formatBody(body) }}
      />
    </div>
  )
}

export function AISummary({ weekStart }: Props) {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load cached summary — if exists, show immediately for all users
  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/generate-summary?week=${weekStart}`)
      .then(r => r.json())
      .then(d => {
        if (d.summary) setSummary(d.summary)
        else setSummary(null)
      })
      .catch(() => setSummary(null))
      .finally(() => setLoading(false))
  }, [weekStart])

  // Auto-generate if no cached summary exists (first visitor triggers it)
  useEffect(() => {
    if (!loading && summary === null && !generating) {
      // Auto-trigger generation
      generate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, summary])

  const generate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/generate-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart }),
      })
      const data = await res.json()
      if (data.summary) {
        setSummary(data.summary)
      } else {
        setError(data.error || 'Failed to generate')
      }
    } catch (e: any) {
      setError(e.message)
    }
    setGenerating(false)
  }, [weekStart])

  const parsed = useMemo(() => {
    if (!summary) return null
    return parseChannelSections(summary)
  }, [summary])

  if (loading) {
    return (
      <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-6 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
        <div className="flex items-center gap-2 text-[#7A6A60]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-[13px]">Loading summary…</span>
        </div>
      </div>
    )
  }

  if (generating && !summary) {
    return (
      <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-8 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(107,76,76,.08)]">
            <Sparkles className="h-5 w-5 text-[#6B4C4C] animate-pulse" />
          </div>
          <p className="text-[14px] font-[600] text-[#2A1F1A]">Generating AI Summary…</p>
          <p className="text-[12px] text-[#7A6A60]">Analyzing all metrics across channels. This takes ~15 seconds.</p>
          <Loader2 className="h-4 w-4 animate-spin text-[#6B4C4C] mt-1" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#6B4C4C]" />
          <p className="text-[15px] font-[600] text-[#2A1F1A]">AI Weekly Summary</p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 bg-[#6B4C4C] text-[#F9F5F1] rounded-[9999px] px-4 py-1.5 text-[12px] font-[500] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          {generating ? 'Generating…' : 'Regenerate'}
        </button>
      </div>

      {error && (
        <div className="rounded-[12px] bg-[rgba(220,38,38,.06)] border border-[rgba(220,38,38,.2)] p-3">
          <p className="text-[12px] text-[#DC2626]">{error}</p>
        </div>
      )}

      {parsed && (
        <>
          {/* Channel cards grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
            {CHANNELS.map(ch => {
              const body = parsed.channels[ch.key]
              if (!body) return null
              return <ChannelCard key={ch.key} channelKey={ch.key} body={body} />
            })}
          </div>

          {/* Overall Summary */}
          {parsed.overall && (
            <div className="rounded-[16px] border border-[rgba(107,76,76,.2)] bg-[rgba(107,76,76,.04)] p-5 shadow-[0_2px_12px_rgba(40,20,10,.04)]">
              <div className="flex items-center gap-2 mb-2.5">
                <TrendingUp className="h-4 w-4 text-[#6B4C4C]" />
                <span className="text-[13px] font-[700] uppercase tracking-[0.08em] text-[#6B4C4C]">Overall Summary</span>
              </div>
              <div
                className="text-[13px] leading-[1.7] text-[#2A1F1A] [&_strong]:font-[600] [&_li]:my-0.5 [&_ul]:my-1 [&_ul]:pl-4 [&_ul]:list-disc"
                dangerouslySetInnerHTML={{ __html: formatBody(parsed.overall) }}
              />
            </div>
          )}

          {/* Key Considerations */}
          {parsed.considerations && (
            <div className="rounded-[16px] border border-[rgba(217,119,6,.2)] bg-[rgba(217,119,6,.04)] p-5 shadow-[0_2px_12px_rgba(40,20,10,.04)]">
              <div className="flex items-center gap-2 mb-2.5">
                <AlertTriangle className="h-4 w-4 text-[#D97706]" />
                <span className="text-[13px] font-[700] uppercase tracking-[0.08em] text-[#D97706]">Key Considerations</span>
              </div>
              <div
                className="text-[13px] leading-[1.7] text-[#2A1F1A] [&_strong]:font-[600] [&_li]:my-0.5 [&_ul]:my-1 [&_ul]:pl-4 [&_ul]:list-disc"
                dangerouslySetInnerHTML={{ __html: formatBody(parsed.considerations) }}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
