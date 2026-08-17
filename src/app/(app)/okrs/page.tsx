'use client'

import { useEffect, useState } from 'react'
import { SectionShell } from '@/components/SectionShell'
import { DomainRatingSlider } from '@/components/shared/DomainRatingSlider'
import { useWeek } from '@/lib/week-context'
import { RefreshCw, ChevronDown, ChevronUp, Target, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

type OKRRow = {
  person: string
  objective: string
  keyResults: string[]
  pipelineTarget: string
}

// Colour palette — cycles per card
const ACCENT_COLORS = [
  { bg: 'rgba(107,76,76,.08)',   text: '#6B4C4C',  bar: '#6B4C4C',  border: 'rgba(107,76,76,.20)'  },
  { bg: 'rgba(37,99,235,.07)',   text: '#2563EB',  bar: '#2563EB',  border: 'rgba(37,99,235,.20)'  },
  { bg: 'rgba(22,163,74,.07)',   text: '#16A34A',  bar: '#16A34A',  border: 'rgba(22,163,74,.20)'  },
  { bg: 'rgba(124,58,237,.07)',  text: '#7C3AED',  bar: '#7C3AED',  border: 'rgba(124,58,237,.20)' },
  { bg: 'rgba(217,119,6,.07)',   text: '#D97706',  bar: '#D97706',  border: 'rgba(217,119,6,.20)'  },
  { bg: 'rgba(220,38,38,.07)',   text: '#DC2626',  bar: '#DC2626',  border: 'rgba(220,38,38,.20)'  },
  { bg: 'rgba(8,145,178,.07)',   text: '#0891B2',  bar: '#0891B2',  border: 'rgba(8,145,178,.20)'  },
  { bg: 'rgba(201,106,90,.07)',  text: '#C96A5A',  bar: '#C96A5A',  border: 'rgba(201,106,90,.20)' },
]

// Pipeline totals for the header bar
function parsePipeline(raw: string): number {
  if (!raw) return 0
  const s = raw.replace(/[$,\s]/g, '').toUpperCase()
  if (s.endsWith('M')) return parseFloat(s) * 1_000_000
  if (s.endsWith('K')) return parseFloat(s) * 1_000
  return parseFloat(s) || 0
}

function formatPipeline(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

// Initials avatar
function Avatar({ name, color }: { name: string; color: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  return (
    <div
      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-[700] text-white"
      style={{ background: color }}
    >
      {initials}
    </div>
  )
}

function OKRCard({ okr, index }: { okr: OKRRow; index: number }) {
  const [expanded, setExpanded] = useState(true)
  const accent  = ACCENT_COLORS[index % ACCENT_COLORS.length]
  const pipeline = parsePipeline(okr.pipelineTarget)

  return (
    <div
      className="rounded-[20px] border bg-white shadow-[0_4px_20px_rgba(40,20,10,.06)] overflow-hidden transition-all duration-200 hover:shadow-[0_8px_32px_rgba(40,20,10,.10)]"
      style={{ borderColor: accent.border }}
    >
      {/* Header */}
      <div
        className="flex items-start gap-3 px-5 py-4 cursor-pointer"
        style={{ background: accent.bg }}
        onClick={() => setExpanded(e => !e)}
      >
        <Avatar name={okr.person} color={accent.text} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-[700] text-[#2A1F1A]">{okr.person}</span>
            {okr.pipelineTarget && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-[600] flex-shrink-0"
                style={{ background: accent.text + '18', color: accent.text }}
              >
                <TrendingUp className="h-3 w-3" />
                {okr.pipelineTarget}
              </span>
            )}
          </div>
          <p className="text-[13px] font-[500] text-[#2A1F1A] mt-0.5 leading-snug line-clamp-2">
            {okr.objective}
          </p>
        </div>
        <button className="flex-shrink-0 text-[#7A6A60] hover:text-[#2A1F1A] mt-0.5">
          {expanded
            ? <ChevronUp className="h-4 w-4" />
            : <ChevronDown className="h-4 w-4" />
          }
        </button>
      </div>

      {/* Key Results */}
      {expanded && okr.keyResults.length > 0 && (
        <div className="px-5 py-4 space-y-2.5">
          {okr.keyResults.map((kr, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <div
                className="mt-[5px] h-1.5 w-1.5 flex-shrink-0 rounded-full"
                style={{ background: accent.bar }}
              />
              <p className="text-[12px] text-[#3A2F2A] leading-snug">{kr}</p>
            </div>
          ))}
          {/* Pipeline progress bar — visual only, goal context */}
          {pipeline > 0 && (
            <div className="mt-3 pt-3 border-t border-[#F2EDE8]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-[#7A6A60] uppercase tracking-wide flex items-center gap-1">
                  <Target className="h-3 w-3" />Pipeline Target
                </span>
                <span className="text-[11px] font-[700]" style={{ color: accent.text }}>
                  {formatPipeline(pipeline)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[#F2EDE8] overflow-hidden">
                <div
                  className="h-full rounded-full opacity-40"
                  style={{ width: '100%', background: accent.bar }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Page() {
  const { weekStart } = useWeek()
  const [okrs, setOkrs]         = useState<OKRRow[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  const fetchOkrs = async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('/api/okrs')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setOkrs(json.okrs || [])
      setUpdatedAt(json.updatedAt || null)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => { void fetchOkrs() }, [])

  // Aggregate pipeline total
  const totalPipeline = okrs.reduce((sum, o) => sum + parsePipeline(o.pipelineTarget), 0)
  const uniquePipelines = [...new Set(okrs.map(o => o.pipelineTarget).filter(Boolean))]

  return (
    <SectionShell title="OKR's" description="Objectives & Key Results — Q3 2026">
      <div className="space-y-6">
        <DomainRatingSlider sectionKey="okrs" weekStart={weekStart} sectionLabel="OKR's" />

        {/* Summary banner */}
        {!loading && okrs.length > 0 && (
          <div className="rounded-[20px] border border-[#D4CBC0] bg-[#F9F5F1] px-5 py-4 flex flex-wrap items-center gap-4">
            <div>
              <p className="text-[10px] text-[#7A6A60] uppercase tracking-wide mb-0.5">Team Members</p>
              <p className="text-[1.5rem] font-[700] text-[#2A1F1A]">{okrs.length}</p>
            </div>
            <div className="w-px h-8 bg-[#D4CBC0]" />
            <div>
              <p className="text-[10px] text-[#7A6A60] uppercase tracking-wide mb-0.5">Total Key Results</p>
              <p className="text-[1.5rem] font-[700] text-[#2A1F1A]">
                {okrs.reduce((s, o) => s + o.keyResults.length, 0)}
              </p>
            </div>
            <div className="w-px h-8 bg-[#D4CBC0]" />
            <div>
              <p className="text-[10px] text-[#7A6A60] uppercase tracking-wide mb-0.5">Combined Pipeline Target</p>
              <p className="text-[1.5rem] font-[700] text-[#6B4C4C]">{formatPipeline(totalPipeline)}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => void fetchOkrs()}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-full border border-[#D4CBC0] px-3 py-1.5 text-[12px] text-[#7A6A60] hover:bg-white transition-colors"
              >
                <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
                Refresh
              </button>
              {updatedAt && (
                <span className="text-[10px] text-[#D4CBC0]">
                  {new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20 gap-2 text-[#7A6A60]">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-[13px]">Loading OKRs from Google Sheets…</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-[20px] border border-[rgba(220,38,38,.25)] bg-[rgba(220,38,38,.05)] p-6 text-center">
            <p className="text-[13px] text-[#DC2626] mb-2">Failed to load OKRs: {error}</p>
            <button onClick={() => void fetchOkrs()} className="text-[12px] text-[#6B4C4C] hover:underline">
              Retry
            </button>
          </div>
        )}

        {/* OKR Cards grid */}
        {!loading && !error && okrs.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {okrs.map((okr, i) => (
              <OKRCard key={okr.person} okr={okr} index={i} />
            ))}
          </div>
        )}

        {!loading && !error && okrs.length === 0 && (
          <p className="text-center text-[13px] text-[#7A6A60] py-12">No OKRs found in the sheet.</p>
        )}
      </div>
    </SectionShell>
  )
}
