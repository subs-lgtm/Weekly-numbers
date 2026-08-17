'use client'

import { useEffect, useState } from 'react'
import { Loader2, RefreshCw, Mail, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

type CategoryData = {
  category: string
  sent: number
  newLeadsContacted: number
  uniqueOpened: number
  uniqueReplies: number
  uniqueClicks: number
  opportunities: number
  openRate: string
  replyRate: string
  campaigns: string[]
}

type Total = {
  sent: number
  newLeadsContacted: number
  uniqueOpened: number
  uniqueReplies: number
  uniqueClicks: number
  opportunities: number
}

type Props = {
  weekStart: string
  weekEnd: string
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'LyzrGPT':        { bg: 'rgba(124,58,237,.08)', text: '#7C3AED', dot: '#7C3AED' },
  'Architect':      { bg: 'rgba(37,99,235,.08)',  text: '#2563EB', dot: '#2563EB' },
  'Prebuilt Agents':{ bg: 'rgba(22,163,74,.08)',  text: '#16A34A', dot: '#16A34A' },
  'Partners':       { bg: 'rgba(217,119,6,.08)',  text: '#D97706', dot: '#D97706' },
  'Hyperscalers':   { bg: 'rgba(8,145,178,.08)',  text: '#0891B2', dot: '#0891B2' },
  'GSI/SI':         { bg: 'rgba(220,38,38,.08)',  text: '#DC2626', dot: '#DC2626' },
  'Other':          { bg: 'rgba(107,76,76,.08)',  text: '#6B4C4C', dot: '#6B4C4C' },
}

function StatCell({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="text-center">
      <p className="text-[14px] font-[600] text-[#2A1F1A] tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-[#7A6A60]">{sub}</p>}
      <p className="text-[10px] text-[#7A6A60] mt-0.5">{label}</p>
    </div>
  )
}

function CategoryRow({ cat }: { cat: CategoryData }) {
  const [expanded, setExpanded] = useState(false)
  const colors = CATEGORY_COLORS[cat.category] || CATEGORY_COLORS['Other']

  return (
    <div className="border-b border-[#D4CBC0]/50 last:border-0">
      <div className="flex items-center gap-4 px-5 py-4 hover:bg-[#F9F5F1]/60 transition-colors">
        {/* Category badge */}
        <div className="flex items-center gap-2 w-[160px] shrink-0">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: colors.dot }} />
          <span className="text-[13px] font-[600] text-[#2A1F1A]">{cat.category}</span>
          <span className="text-[10px] text-[#7A6A60]">({cat.campaigns.length})</span>
        </div>

        {/* Stats */}
        <div className="flex-1 grid grid-cols-6 gap-4">
          <StatCell label="Sent" value={cat.sent.toLocaleString()} />
          <StatCell label="Contacted" value={cat.newLeadsContacted.toLocaleString()} />
          <StatCell label="Opened" value={cat.uniqueOpened.toLocaleString()} sub={`${cat.openRate}%`} />
          <StatCell label="Replied" value={cat.uniqueReplies.toLocaleString()} sub={`${cat.replyRate}%`} />
          <StatCell label="Clicks" value={cat.uniqueClicks.toLocaleString()} />
          <StatCell label="Opps" value={cat.opportunities > 0 ? cat.opportunities : '—'} />
        </div>

        {/* Expand campaigns */}
        {cat.campaigns.length > 0 && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex h-6 w-6 items-center justify-center rounded-full text-[#7A6A60] hover:bg-[#F2EDE8] transition-colors shrink-0"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {/* Campaign list */}
      {expanded && cat.campaigns.length > 0 && (
        <div className="px-5 pb-3 pl-[3.5rem] space-y-1">
          {cat.campaigns.map(name => (
            <p key={name} className="text-[11px] text-[#7A6A60] truncate">• {name}</p>
          ))}
        </div>
      )}
    </div>
  )
}

export function InstantlyCampaigns({ weekStart, weekEnd }: Props) {
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [total, setTotal] = useState<Total | null>(null)
  const [totalCampaigns, setTotalCampaigns] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/instantly/campaigns?start=${weekStart}&end=${weekEnd}`)
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setCategories(data.categories || [])
      setTotal(data.total || null)
      setTotalCampaigns(data.totalCampaigns || 0)
      setLastFetched(new Date())
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [weekStart, weekEnd])

  const openRate = total && total.sent > 0 ? ((total.uniqueOpened / total.sent) * 100).toFixed(1) : '0'
  const replyRate = total && total.sent > 0 ? ((total.uniqueReplies / total.sent) * 100).toFixed(1) : '0'

  return (
    <div className="rounded-[20px] border border-[#D4CBC0] bg-white shadow-[0_4px_20px_rgba(40,20,10,.07)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#D4CBC0] bg-[#F9F5F1]">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center justify-center rounded-full p-1.5 bg-[rgba(107,76,76,.08)] text-[#6B4C4C]">
            <Mail className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="eyebrow">Instantly — Outreach by Category</p>
            {totalCampaigns > 0 && <p className="text-[11px] text-[#7A6A60]">{totalCampaigns} active campaigns</p>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Totals summary */}
          {total && !loading && (
            <div className="flex items-center gap-4 text-[11px] text-[#7A6A60]">
              <span><span className="font-[600] text-[#2A1F1A]">{total.sent.toLocaleString()}</span> sent</span>
              <span><span className="font-[600] text-[#2A1F1A]">{openRate}%</span> open</span>
              <span><span className="font-[600] text-[#2A1F1A]">{replyRate}%</span> reply</span>
              {total.opportunities > 0 && <span><span className="font-[600] text-[#16A34A]">{total.opportunities}</span> opps</span>}
            </div>
          )}
          {lastFetched && <span className="text-[10px] text-[#7A6A60]">{lastFetched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
          <button onClick={fetchData} disabled={loading} className="flex h-6 w-6 items-center justify-center rounded-full text-[#7A6A60] hover:bg-[#F2EDE8] transition-colors disabled:opacity-40">
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Column headers */}
      {!loading && !error && categories.length > 0 && (
        <div className="flex items-center gap-4 px-5 py-2 bg-[#F9F5F1]/50 border-b border-[#D4CBC0]/50">
          <div className="w-[160px] shrink-0">
            <span className="eyebrow">Category</span>
          </div>
          <div className="flex-1 grid grid-cols-6 gap-4 text-center">
            {['Sent', 'Contacted', 'Opened', 'Replied', 'Clicks', 'Opps'].map(h => (
              <span key={h} className="eyebrow">{h}</span>
            ))}
          </div>
          <div className="w-6 shrink-0" />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-[#7A6A60]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-[13px]">Loading from Instantly…</span>
        </div>
      ) : error ? (
        <div className="px-5 py-8 text-center">
          <p className="text-[13px] text-[#DC2626]">Failed: {error}</p>
          <button onClick={fetchData} className="mt-2 text-[12px] text-[#6B4C4C] hover:underline">Retry</button>
        </div>
      ) : categories.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-[13px] text-[#7A6A60]">No campaign data for this period</p>
        </div>
      ) : (
        categories.map(cat => <CategoryRow key={cat.category} cat={cat} />)
      )}

      <div className="px-5 py-2.5 bg-[#F9F5F1] border-t border-[#D4CBC0]">
        <p className="caption">Live from Instantly · Campaigns grouped by category · Click ↓ to see individual campaigns</p>
      </div>
    </div>
  )
}
