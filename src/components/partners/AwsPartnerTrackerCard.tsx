'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, ExternalLink, CircleCheck, CircleDot } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TrackerTask, BucketBreakdown } from '@/app/api/aws-partner-tracker/route'

type TrackerResponse = {
  weekAnchor: string
  windowStart: string
  windowEnd: string
  headline: { completedLastWeek: number; inProgressNow: number; totalTasks: number }
  buckets: BucketBreakdown[]
  completed: TrackerTask[]
  inProgress: TrackerTask[]
  updatedAt: string
  error?: string
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-[16px] border border-[#D4CBC0] bg-white px-4 py-3 flex-1 min-w-[120px]">
      <p className="text-[10px] text-[#7A6A60] uppercase tracking-wide mb-1">{label}</p>
      <p className="text-[1.75rem] font-[700]" style={{ color: accent }}>{value}</p>
    </div>
  )
}

function BucketRow({ b }: { b: BucketBreakdown }) {
  const pct = b.total > 0 ? Math.round(((b.completed + b.inProgress) / b.total) * 100) : 0
  return (
    <div className="flex items-center gap-3 py-2 border-b border-[#F2EDE8] last:border-0">
      <span className="text-[12.5px] text-[#2A1F1A] font-[500] flex-1 min-w-0 truncate">{b.bucket}</span>
      <span className="text-[11px] text-[#16A34A] font-[600] w-16 text-right">{b.completed} done</span>
      <span className="text-[11px] text-[#D97706] font-[600] w-20 text-right">{b.inProgress} active</span>
      <span className="text-[11px] text-[#7A6A60] w-14 text-right">{b.total} total</span>
      <div className="h-1.5 w-16 rounded-full bg-[#F2EDE8] overflow-hidden flex-shrink-0">
        <div className="h-full rounded-full bg-[#6B4C4C]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function TaskRow({ t, variant }: { t: TrackerTask; variant: 'completed' | 'inProgress' }) {
  return (
    <div className="flex items-start gap-2.5 px-4 py-3 border-b border-[#F2EDE8] last:border-0">
      {variant === 'completed'
        ? <CircleCheck className="h-4 w-4 mt-0.5 flex-shrink-0 text-[#16A34A]" />
        : <CircleDot className="h-4 w-4 mt-0.5 flex-shrink-0 text-[#D97706]" />
      }
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-[600]"
            style={{ background: 'rgba(107,76,76,.08)', color: '#6B4C4C' }}
          >
            {t.bucket}
          </span>
          {t.priority && (
            <span className="text-[10px] text-[#7A6A60] font-[600]">{t.priority}</span>
          )}
          {t.assignee && (
            <span className="text-[10px] text-[#7A6A60]">· {t.assignee}</span>
          )}
          {variant === 'completed' && t.dateDelivered && (
            <span className="text-[10px] text-[#D4CBC0]">· {t.dateDelivered}</span>
          )}
        </div>
        <p className="text-[12.5px] text-[#2A1F1A] leading-snug">{t.task}</p>
        {t.notes && <p className="text-[11px] text-[#7A6A60] italic mt-0.5">{t.notes}</p>}
      </div>
      {t.outputUrl && (
        <a
          href={t.outputUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 mt-0.5 text-[#6B4C4C] hover:text-[#2A1F1A]"
          title="View output"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  )
}

export function AwsPartnerTrackerCard() {
  const [data, setData] = useState<TrackerResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTracker = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/aws-partner-tracker')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => { void fetchTracker() }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="eyebrow">Cloud Partner Marketing — Task Tracker</p>
        {data && !error && (
          <p className="caption">
            Week of {formatDateLabel(data.windowStart)} – {formatDateLabel(data.windowEnd)}
          </p>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 gap-2 text-[#7A6A60] rounded-[20px] border border-[#D4CBC0] bg-white">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-[13px]">Loading task tracker from Google Sheets…</span>
        </div>
      )}

      {error && (
        <div className="rounded-[20px] border border-[rgba(220,38,38,.25)] bg-[rgba(220,38,38,.05)] p-6 text-center">
          <p className="text-[13px] text-[#DC2626] mb-2">Failed to load task tracker: {error}</p>
          <button onClick={() => void fetchTracker()} className="text-[12px] text-[#6B4C4C] hover:underline">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-4">
          {/* Headline numbers */}
          <div className="flex flex-wrap gap-3">
            <StatCard label="Completed Last Week" value={data.headline.completedLastWeek} accent="#16A34A" />
            <StatCard label="In Progress Now" value={data.headline.inProgressNow} accent="#D97706" />
            <StatCard label="Total Tasks Tracked" value={data.headline.totalTasks} accent="#6B4C4C" />
            <button
              onClick={() => void fetchTracker()}
              className="flex items-center gap-1.5 rounded-full border border-[#D4CBC0] px-3 py-1.5 text-[12px] text-[#7A6A60] hover:bg-white transition-colors ml-auto self-center"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </button>
          </div>

          {/* Bucket breakdown */}
          <div className="rounded-[20px] border border-[#D4CBC0] bg-white px-4 py-3 shadow-[0_4px_20px_rgba(40,20,10,.06)]">
            <p className="text-[12px] font-[600] text-[#2A1F1A] mb-2">Breakdown by Bucket</p>
            {data.buckets.map(b => <BucketRow key={b.bucket} b={b} />)}
          </div>

          {/* Two-column: completed / in progress */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-[20px] border border-[#D4CBC0] bg-white overflow-hidden shadow-[0_4px_20px_rgba(40,20,10,.06)]">
              <div className="px-4 py-2.5 bg-[rgba(22,163,74,.06)] border-b border-[#D4CBC0]">
                <p className="text-[11px] font-[700] uppercase tracking-wide text-[#16A34A]">
                  Completed Last Week ({data.completed.length})
                </p>
              </div>
              {data.completed.length === 0
                ? <p className="text-center text-[12.5px] text-[#7A6A60] py-8">Nothing marked Done in this window.</p>
                : data.completed.map((t, i) => <TaskRow key={i} t={t} variant="completed" />)
              }
            </div>
            <div className="rounded-[20px] border border-[#D4CBC0] bg-white overflow-hidden shadow-[0_4px_20px_rgba(40,20,10,.06)]">
              <div className="px-4 py-2.5 bg-[rgba(217,119,6,.06)] border-b border-[#D4CBC0]">
                <p className="text-[11px] font-[700] uppercase tracking-wide text-[#D97706]">
                  In Progress — Coming Week ({data.inProgress.length})
                </p>
              </div>
              {data.inProgress.length === 0
                ? <p className="text-center text-[12.5px] text-[#7A6A60] py-8">Nothing marked In-progress.</p>
                : data.inProgress.map((t, i) => <TaskRow key={i} t={t} variant="inProgress" />)
              }
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
