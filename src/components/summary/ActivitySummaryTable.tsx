'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getDb } from '@/lib/firebase'
import { collection, doc, onSnapshot, setDoc, serverTimestamp, type Unsubscribe } from 'firebase/firestore'
import { useAuth } from '@/lib/auth-context'
import { SECTIONS } from '@/lib/metrics-config'

export type ActivityStatus = 'red' | 'amber' | 'green'

export type ActivityEntry = {
  status: ActivityStatus
  summary: string
  owner: string
  updatedBy: string
  updatedAt: any
}

// Only show functions that make sense as a one-line weekly activity row.
// mqls/leads are aggregate rollups covered elsewhere on this page, not a "function".
export const ACTIVITY_SECTIONS = SECTIONS.filter(s => !['mqls', 'leads', 'agent-studio-leads'].includes(s.key))

// Groups existing sections under shared category headers for display.
// Section keys/labels/ownership are unchanged elsewhere in the app — this only
// affects how rows are grouped and headed in this table.
const CATEGORIES: { label: string; sectionKeys: string[] }[] = [
  { label: 'Content', sectionKeys: ['seo', 'pages', 'content'] },
  { label: 'Social', sectionKeys: ['social-influencers', 'reddit'] },
  { label: 'DevRel', sectionKeys: ['architect', 'docs-tutorials'] },
]

// Team roster — from the reference mockup. Editable per row via dropdown.
const OWNER_OPTIONS = [
  'Mothilal', 'Shreya', 'Shifa', 'Kailash',
  'Prince', 'Pranamya', 'Ani', 'Ankita',
  'Vaibhavi', 'Kunj', 'Leonard', 'Vaibhav', 'Nirupam', 'Apoorva', 'Faraaz', 'Rida', 'Alma', 'Arnav',
]

// Default owner per function — matches the reference mockup where a function was shown there.
// Sections not present in the mockup are left unassigned until manually set.
const DEFAULT_OWNERS: Record<string, string> = {
  ads: 'Mothilal',
  seo: 'Shreya',
  email: 'Shifa',
  content: 'Shreya',
  'content-engine': 'Shreya',
  'spotlight-cvc': 'Shreya',
  pages: 'Prince',            // Website
  'ui-ux': 'Prince',
  'social-influencers': 'Prince',
  'git-agent': 'Kailash',     // OSS
  reddit: 'Kailash',
  webinars: 'Shifa',
  podcasts: 'Ani',
  'pr-news': 'Pranamya',
  'analyst-relations': 'Pranamya',
}

const STATUS_CONFIG: Record<ActivityStatus, { dot: string; label: string; rowBg: string }> = {
  red:   { dot: 'bg-[#DC2626]', label: 'Red',    rowBg: 'bg-[rgba(220,38,38,.045)]' },
  amber: { dot: 'bg-[#D97706]', label: 'Yellow', rowBg: 'bg-[rgba(217,119,6,.045)]' },
  green: { dot: 'bg-[#16A34A]', label: 'Green',  rowBg: 'bg-[rgba(22,163,74,.045)]' },
}

const STATUS_CYCLE: ActivityStatus[] = ['green', 'amber', 'red']

// Column widths shared by header + rows so nothing overlaps/merges.
const ROW_GRID = 'grid-cols-[150px_66px_1fr_150px_96px]'

function timeAgo(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// Ticks every 30s so "2m ago" style labels advance live without needing a new Firestore write.
function useNow() {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000)
    return () => clearInterval(id)
  }, [])
}

export function useActivitySummary(weekStart: string) {
  const [data, setData] = useState<Record<string, ActivityEntry>>({})
  const [loading, setLoading] = useState(true)
  const unsubRef = useRef<Unsubscribe | null>(null)

  useEffect(() => {
    setLoading(true)
    const db = getDb()
    const col = collection(db, 'activity_summary', weekStart, 'items')
    unsubRef.current = onSnapshot(col, (snap) => {
      const result: Record<string, ActivityEntry> = {}
      snap.forEach((d) => { result[d.id] = d.data() as ActivityEntry })
      setData(result)
      setLoading(false)
    }, () => setLoading(false))
    return () => { unsubRef.current?.() }
  }, [weekStart])

  const saveEntry = useCallback(async (sectionKey: string, updates: Partial<ActivityEntry>, userEmail: string) => {
    const db = getDb()
    const ref = doc(db, 'activity_summary', weekStart, 'items', sectionKey)
    await setDoc(ref, { ...updates, updatedBy: userEmail, updatedAt: serverTimestamp() }, { merge: true })
  }, [weekStart])

  return { data, loading, saveEntry }
}

function OwnerSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <select
        autoFocus
        value={value}
        onChange={e => { onChange(e.target.value); setEditing(false) }}
        onBlur={() => setEditing(false)}
        className="w-full text-[12px] text-[#2A1F1A] bg-white border border-[#6B4C4C] rounded-[6px] px-1.5 py-0.5 outline-none ring-1 ring-[rgba(107,76,76,.15)]"
      >
        <option value="">— Unassigned —</option>
        {OWNER_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Click to reassign owner"
      className="text-[12px] text-[#2A1F1A] font-[500] truncate text-left hover:underline hover:decoration-dotted"
    >
      {value || <span className="text-[#D4CBC0] italic font-[400]">Assign…</span>}
    </button>
  )
}

function ActivityRow({
  label, entry, defaultOwner, onSave,
}: {
  label: string
  entry: ActivityEntry | undefined
  defaultOwner: string
  onSave: (updates: Partial<ActivityEntry>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(entry?.summary || '')
  const status = entry?.status || null
  const updatedAtStr = entry?.updatedAt?.toDate?.()?.toISOString() || null
  const ownerValue = entry?.owner ?? defaultOwner ?? ''

  const cycleStatus = () => {
    const current = status || 'green'
    const idx = STATUS_CYCLE.indexOf(current)
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
    onSave({ status: next })
  }

  const commitSummary = () => {
    setEditing(false)
    if (draft.trim() !== (entry?.summary || '')) {
      onSave({ summary: draft.trim() })
    }
  }

  return (
    <div className={`grid ${ROW_GRID} items-center gap-3.5 px-4 py-3 border-b border-[#EEE7DC] last:border-0 transition-colors ${status ? STATUS_CONFIG[status].rowBg : ''} hover:brightness-[0.98]`}>
      <div className="text-[13px] font-[600] text-[#2A1F1A] truncate">{label}</div>
      <button
        onClick={cycleStatus}
        title={`Status: ${status ? STATUS_CONFIG[status].label : 'Not set'} — click to change`}
        className="justify-self-center flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110"
      >
        <span
          className={`block h-[11px] w-[11px] rounded-full ${status ? STATUS_CONFIG[status].dot : 'bg-[#E5DDD1] border border-[#D4CBC0]'}`}
        />
      </button>
      {editing ? (
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitSummary}
          onKeyDown={e => { if (e.key === 'Enter') commitSummary(); if (e.key === 'Escape') { setDraft(entry?.summary || ''); setEditing(false) } }}
          autoFocus
          placeholder="What happened this week?"
          className="text-[12.5px] text-[#2A1F1A] bg-white border border-[#6B4C4C] rounded-[6px] px-2 py-1 outline-none ring-1 ring-[rgba(107,76,76,.15)]"
        />
      ) : (
        <p
          className="text-[12.5px] text-[#6B4C4C] leading-[1.4] cursor-pointer truncate"
          onDoubleClick={() => { setDraft(entry?.summary || ''); setEditing(true) }}
          title="Double-click to edit"
        >
          {entry?.summary || <span className="text-[#D4CBC0] italic">Double-click to add update…</span>}
        </p>
      )}
      <OwnerSelect value={ownerValue} onChange={(v) => onSave({ owner: v })} />
      <div className="text-[11.5px] text-[#7A6A60] text-right">{timeAgo(updatedAtStr)}</div>
    </div>
  )
}

function CategoryHeader({ label }: { label: string }) {
  return (
    <div className="px-4 py-1.5 bg-[#F2EDE8] border-b border-[#D4CBC0] text-[10px] uppercase tracking-[.09em] font-[700] text-[#6B4C4C]">
      {label}
    </div>
  )
}

export function ActivitySummaryTable({ weekStart }: { weekStart: string }) {
  const { data, loading, saveEntry } = useActivitySummary(weekStart)
  const { user } = useAuth()
  useNow() // re-renders every 30s so "Updated" column stays live

  if (loading) {
    return (
      <div className="rounded-[16px] border border-[#D4CBC0] bg-white p-8 flex items-center justify-center gap-2">
        <div className="w-4 h-4 border-2 border-[#6B4C4C] border-t-transparent rounded-full animate-spin" />
        <span className="text-[13px] text-[#7A6A60]">Loading activity summary…</span>
      </div>
    )
  }

  const bySectionKey = new Map(ACTIVITY_SECTIONS.map(s => [s.key, s]))
  const categorizedKeys = new Set(CATEGORIES.flatMap(c => c.sectionKeys))
  const otherSections = ACTIVITY_SECTIONS.filter(s => !categorizedKeys.has(s.key))

  const renderRow = (key: string) => {
    const s = bySectionKey.get(key)
    if (!s) return null
    return (
      <ActivityRow
        key={s.key}
        label={s.label}
        entry={data[s.key]}
        defaultOwner={DEFAULT_OWNERS[s.key] || ''}
        onSave={(updates) => { void saveEntry(s.key, updates, user?.email || 'unknown') }}
      />
    )
  }

  return (
    <div className="rounded-[16px] border border-[#D4CBC0] bg-white overflow-hidden shadow-[0_4px_20px_rgba(40,20,10,.04)]">
      <div className={`grid ${ROW_GRID} gap-3.5 px-4 py-2.5 text-[10.5px] uppercase tracking-[.07em] text-[#7A6A60] font-[600] bg-[#FBF8F4] border-b border-[#D4CBC0]`}>
        <div className="overflow-hidden truncate">Function</div>
        <div className="text-center overflow-hidden truncate">Status</div>
        <div className="overflow-hidden truncate">Summary</div>
        <div className="overflow-hidden truncate">Owner</div>
        <div className="text-right overflow-hidden truncate">Updated</div>
      </div>

      {CATEGORIES.map(cat => (
        <div key={cat.label}>
          <CategoryHeader label={cat.label} />
          {cat.sectionKeys.map(renderRow)}
        </div>
      ))}

      <div>
        <CategoryHeader label="Other" />
        {otherSections.map(s => renderRow(s.key))}
      </div>
    </div>
  )
}
