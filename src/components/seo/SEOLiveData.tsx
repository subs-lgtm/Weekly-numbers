'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Minus, RefreshCw, Search, MousePointerClick, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

type Keyword = {
  keyword: string
  position: number
  prevPosition: number
  volume: number
  trafficPct: number
  url: string
}

type GSCKeyword = {
  keyword: string
  clicks: number
  impressions: number
  ctr: string
  position: string
  prevClicks: number
  clicksDelta: number
}

type Summary = {
  clicks: number
  prevClicks: number
  impressions: number
  prevImpressions: number
  ctr?: string
  avgPosition?: string
  organicSessions: number
  prevOrganicSessions: number
  organicUsers: number
}

type Props = {
  weekStart: string
  weekEnd: string
}

function pctDelta(cur: number, prev: number) {
  if (prev === 0) return cur > 0 ? 100 : 0
  return Math.round(((cur - prev) / prev) * 100)
}

function DeltaBadge({ cur, prev, invert = false }: { cur: number; prev: number; invert?: boolean }) {
  const pct = pctDelta(cur, prev)
  const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat'
  const displayDir = invert ? (dir === 'up' ? 'down' : dir === 'down' ? 'up' : 'flat') : dir
  if (prev === 0 && cur === 0) return null
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold', displayDir === 'up' && 'delta-up', displayDir === 'down' && 'delta-down', displayDir === 'flat' && 'delta-flat')}>
      {displayDir === 'up' && <TrendingUp className="h-2.5 w-2.5" />}
      {displayDir === 'down' && <TrendingDown className="h-2.5 w-2.5" />}
      {displayDir === 'flat' && <Minus className="h-2.5 w-2.5" />}
      {pct > 0 ? '+' : ''}{pct}%
    </span>
  )
}

function PositionChange({ cur, prev }: { cur: number; prev: number }) {
  if (!prev || prev === 0) return <span className="text-[11px] text-[#7A6A60]">#{cur}</span>
  const diff = prev - cur // positive = improved (lower position number = better)
  return (
    <div className="flex items-center gap-1">
      <span className="text-[12px] font-[600] text-[#2A1F1A]">#{cur}</span>
      {diff !== 0 && (
        <span className={cn('text-[10px] font-[600]', diff > 0 ? 'text-[#16A34A]' : 'text-[#DC2626]')}>
          {diff > 0 ? `↑${diff}` : `↓${Math.abs(diff)}`}
        </span>
      )}
    </div>
  )
}

export function SEOLiveData({ weekStart, weekEnd }: Props) {
  const [data, setData] = useState<{ keywords: Keyword[]; gscKeywords: GSCKeyword[]; summary: Summary } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'semrush' | 'gsc'>('gsc')
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const [showCount, setShowCount] = useState(10)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/seo/data?start=${weekStart}&end=${weekEnd}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
      setLastFetched(new Date())
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [weekStart, weekEnd])

  const CARD = 'rounded-[20px] border border-[#D4CBC0] bg-white shadow-[0_4px_20px_rgba(40,20,10,.07)] overflow-hidden'

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      {data?.summary && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: 'GSC Clicks', cur: data.summary.clicks, prev: data.summary.prevClicks, icon: <MousePointerClick className="h-4 w-4" />, ac: '#6B4C4C', ab: 'rgba(107,76,76,.08)', fmt: (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}k` : n.toLocaleString() },
            { label: 'GSC Impressions', cur: data.summary.impressions, prev: data.summary.prevImpressions, icon: <Eye className="h-4 w-4" />, ac: '#2563EB', ab: 'rgba(37,99,235,.08)', fmt: (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}k` : n.toLocaleString() },
            { label: 'CTR', cur: parseFloat(data.summary.ctr || '0'), prev: 0, icon: <Search className="h-4 w-4" />, ac: '#D97706', ab: 'rgba(217,119,6,.08)', fmt: (n: number) => `${n}%`, noWoW: true },
            { label: 'Avg Position', cur: parseFloat(data.summary.avgPosition || '0'), prev: 0, icon: <Search className="h-4 w-4" />, ac: '#7C3AED', ab: 'rgba(124,58,237,.08)', fmt: (n: number) => `#${n.toFixed(1)}`, noWoW: true },
            { label: 'Organic Sessions (GA4)', cur: data.summary.organicSessions, prev: data.summary.prevOrganicSessions, icon: <Search className="h-4 w-4" />, ac: '#16A34A', ab: 'rgba(22,163,74,.08)', fmt: (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}k` : n.toLocaleString() },
          ].map(card => (
            <div key={card.label} className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
              <div className="inline-flex items-center justify-center rounded-full p-2 mb-3" style={{ background: card.ab, color: card.ac }}>{card.icon}</div>
              <p className="eyebrow mb-2">{card.label}</p>
              <p className="font-['Playfair_Display'] font-[500] text-[1.5rem] leading-[1.15] tracking-[-0.02em] text-[#2A1F1A]">
                {card.cur > 0 ? card.fmt(card.cur) : '—'}
              </p>
              {!card.noWoW && card.prev > 0 && <DeltaBadge cur={card.cur} prev={card.prev} />}
              {!card.noWoW && card.prev > 0 && <p className="caption mt-1">Prev: {card.fmt(card.prev)}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Keywords table */}
      <div className={CARD}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D4CBC0] bg-[#F9F5F1]">
          <div className="flex items-center gap-3">
            <p className="eyebrow">Keyword Rankings</p>
            {/* Tab toggle */}
            <div className="flex rounded-full border border-[#D4CBC0] overflow-hidden text-[11px] font-[600]">
              <button onClick={() => setTab('gsc')} className={cn('px-3 py-0.5 transition-colors', tab === 'gsc' ? 'bg-[#6B4C4C] text-[#F9F5F1]' : 'text-[#7A6A60] hover:bg-[#F2EDE8]')}>GSC</button>
              <button onClick={() => setTab('semrush')} className={cn('px-3 py-0.5 transition-colors', tab === 'semrush' ? 'bg-[#6B4C4C] text-[#F9F5F1]' : 'text-[#7A6A60] hover:bg-[#F2EDE8]')}>SEMrush</button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Show count selector */}
            <select
              value={showCount}
              onChange={e => setShowCount(Number(e.target.value))}
              className="rounded-full border border-[#D4CBC0] bg-white px-2 py-0.5 text-[11px] text-[#7A6A60] outline-none"
            >
              <option value={10}>Top 10</option>
              <option value={25}>Top 25</option>
              <option value={50}>Top 50</option>
              <option value={100}>Top 100</option>
            </select>
            {/* CSV Export */}
            <button
              onClick={() => {
                if (!data) return
                const keywords = tab === 'gsc' ? data.gscKeywords : data.keywords
                if (!keywords?.length) return
                const headers = tab === 'gsc'
                  ? ['#','Keyword','Clicks','Prev Clicks','WoW Delta','Impressions','CTR','Position']
                  : ['#','Keyword','Position','Prev Position','Volume','Traffic %','URL']
                const rows = keywords.map((k, i) => tab === 'gsc'
                  ? [i+1, k.keyword, (k as any).clicks, (k as any).prevClicks, (k as any).clicksDelta, (k as any).impressions, (k as any).ctr+'%', '#'+(k as any).position]
                  : [i+1, k.keyword, (k as any).position, (k as any).prevPosition, (k as any).volume, (k as any).trafficPct+'%', (k as any).url]
                )
                const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(','))].join('\n')
                const blob = new Blob([csv], { type: 'text/csv' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = `seo-keywords-${tab}-${new Date().toISOString().split('T')[0]}.csv`
                a.click(); URL.revokeObjectURL(url)
              }}
              className="rounded-full border border-[#D4CBC0] bg-white px-2.5 py-0.5 text-[11px] font-[600] text-[#6B4C4C] hover:bg-[#F2EDE8] transition-colors"
            >
              Export CSV
            </button>
            {lastFetched && <span className="text-[10px] text-[#7A6A60]">Updated {lastFetched.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
            <button onClick={fetchData} disabled={loading} className="flex h-6 w-6 items-center justify-center rounded-full text-[#7A6A60] hover:bg-[#F2EDE8] transition-colors disabled:opacity-40">
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-[#7A6A60]">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-[13px]">Fetching from {tab === 'gsc' ? 'Google Search Console' : 'SEMrush'}…</span>
          </div>
        ) : error ? (
          <div className="px-5 py-8 text-center">
            <p className="text-[13px] text-[#DC2626]">Failed: {error}</p>
            <button onClick={fetchData} className="mt-2 text-[12px] text-[#6B4C4C] hover:underline">Retry</button>
          </div>
        ) : tab === 'gsc' ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#D4CBC0]">
                  {['#', 'Keyword', 'Clicks', 'WoW', 'Impressions', 'CTR', 'Avg Position'].map(h => (
                    <th key={h} className="py-2.5 px-4 text-left"><span className="eyebrow">{h}</span></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.gscKeywords || []).slice(0, showCount).map((k, i) => (
                  <tr key={`gsc-${i}-${k.keyword}`} className="border-b border-[#D4CBC0]/50 last:border-0 hover:bg-[#F9F5F1]/60 transition-colors">
                    <td className="py-2.5 px-4 text-[12px] text-[#7A6A60] tabular-nums">{i + 1}</td>
                    <td className="py-2.5 px-4 max-w-[280px]">
                      <p className="text-[13px] font-[500] text-[#2A1F1A] truncate" title={k.keyword}>{k.keyword}</p>
                    </td>
                    <td className="py-2.5 px-4 text-[13px] tabular-nums font-[600] text-[#2A1F1A]">{k.clicks.toLocaleString()}</td>
                    <td className="py-2.5 px-4">
                      {k.prevClicks > 0 || k.clicks > 0 ? (
                        <span className={cn('text-[11px] font-[600]', k.clicksDelta > 0 ? 'text-[#16A34A]' : k.clicksDelta < 0 ? 'text-[#DC2626]' : 'text-[#7A6A60]')}>
                          {k.clicksDelta > 0 ? '+' : ''}{k.clicksDelta}
                        </span>
                      ) : <span className="text-[#D4CBC0]">—</span>}
                    </td>
                    <td className="py-2.5 px-4 text-[13px] tabular-nums text-[#7A6A60]">{k.impressions.toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-[12px] font-[600] text-[#2A1F1A]">{k.ctr}%</td>
                    <td className="py-2.5 px-4 text-[12px] text-[#2A1F1A]">#{k.position}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#D4CBC0]">
                  {['#', 'Keyword', 'Position', 'WoW', 'Volume', 'Traffic %', 'URL'].map(h => (
                    <th key={h} className="py-2.5 px-4 text-left"><span className="eyebrow">{h}</span></th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.keywords || []).slice(0, showCount).map((k, i) => (
                  <tr key={`sem-${i}-${k.keyword}`} className="border-b border-[#D4CBC0]/50 last:border-0 hover:bg-[#F9F5F1]/60 transition-colors">
                    <td className="py-2.5 px-4 text-[12px] text-[#7A6A60] tabular-nums">{i + 1}</td>
                    <td className="py-2.5 px-4 max-w-[240px]">
                      <p className="text-[13px] font-[500] text-[#2A1F1A] truncate" title={k.keyword}>{k.keyword}</p>
                    </td>
                    <td className="py-2.5 px-4">
                      <PositionChange cur={k.position} prev={k.prevPosition} />
                    </td>
                    <td className="py-2.5 px-4">
                      {k.prevPosition > 0 && k.position > 0 ? (
                        <span className={cn('text-[11px] font-[600]', k.prevPosition > k.position ? 'text-[#16A34A]' : k.prevPosition < k.position ? 'text-[#DC2626]' : 'text-[#7A6A60]')}>
                          {k.prevPosition > k.position ? `↑${k.prevPosition - k.position}` : k.prevPosition < k.position ? `↓${k.position - k.prevPosition}` : '—'}
                        </span>
                      ) : <span className="text-[#D4CBC0]">—</span>}
                    </td>
                    <td className="py-2.5 px-4 text-[13px] tabular-nums text-[#7A6A60]">{k.volume.toLocaleString()}</td>
                    <td className="py-2.5 px-4 text-[12px] text-[#7A6A60]">{k.trafficPct.toFixed(1)}%</td>
                    <td className="py-2.5 px-4 max-w-[160px]">
                      <p className="text-[11px] text-[#7A6A60] truncate" title={k.url}>{k.url.replace('https://www.lyzr.ai', '')}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-2.5 bg-[#F9F5F1] border-t border-[#D4CBC0]">
          <p className="caption">
            {tab === 'gsc' ? `Showing top ${showCount} keywords from Google Search Console · GSC data has ~3 day lag · WoW = clicks vs previous 7 days` : `Showing top ${showCount} keywords from SEMrush · Position ↑ = improved ranking · WoW vs previous position`}
          </p>
        </div>
      </div>
    </div>
  )
}
