'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getDb } from '@/lib/firebase'
import { collection, doc, onSnapshot, setDoc, serverTimestamp, type Unsubscribe } from 'firebase/firestore'
import { useAuth } from '@/lib/auth-context'
import { SECTIONS } from '@/lib/metrics-config'

export type ActivityStatus = 'red' | 'amber' | 'green'

export type ActivityEntry = {
  // "Other" rows: single cycling status + one summary line.
  status?: ActivityStatus
  summary?: string
  // Category rows: three fixed lines, one per color — a stakeholder can give
  // a red update, a yellow update, and a green update, independently.
  redLine?: string
  amberLine?: string
  greenLine?: string
  owner: string
  updatedBy: string
  updatedAt: any
}

export const STATUS_LINE_FIELD: Record<ActivityStatus, 'redLine' | 'amberLine' | 'greenLine'> = {
  red: 'redLine', amber: 'amberLine', green: 'greenLine',
}

// Only show functions that make sense as a one-line weekly activity row.
// mqls/leads are aggregate rollups covered elsewhere on this page, not a "function".
export const ACTIVITY_SECTIONS = SECTIONS.filter(s => !['mqls', 'leads', 'agent-studio-leads'].includes(s.key))

// Each category collapses multiple existing sections into a SINGLE trackable
// row — one status dot, one summary, one owner, one Firestore doc — covering
// everything listed in sectionKeys. The underlying sections keep their own
// dedicated pages/keys elsewhere in the app; this only changes how their
// weekly status gets tracked and rolled up on the Summary page.
const CATEGORY_GROUPS: { key: string; label: string; sectionKeys: string[] }[] = [
  { key: 'cat-ads', label: 'Ads', sectionKeys: ['ads'] },
  { key: 'cat-gsi-founder-amp', label: 'GSI/SI & Founder Amplification', sectionKeys: ['gsi-si-founder-amplification'] },
  { key: 'cat-seo-content', label: 'SEO / Content', sectionKeys: ['seo', 'content', 'playbooks'] },
  { key: 'cat-products', label: 'Products', sectionKeys: ['studio-signups', 'architect', 'lyzr-gpt'] },
  { key: 'cat-social', label: 'Social & Influencers', sectionKeys: ['social-influencers', 'reddit'] },
  { key: 'cat-website', label: 'Website', sectionKeys: ['pages', 'ui-ux', 'pr-news'] },
  { key: 'cat-partners', label: 'Partners', sectionKeys: ['partners-emerging', 'partners-aws', 'partners-gsi'] },
]

export type ActivityItem = { key: string; label: string; sublabel?: string }

const sectionLabel = (key: string) => SECTIONS.find(s => s.key === key)?.label || key

// Unified list consumed by both this table and the Summary page's RAG board —
// category rows first, then every remaining individual section not covered
// by a category (unchanged, one row each, as before).
export function buildActivityItems(): ActivityItem[] {
  const categorizedKeys = new Set(CATEGORY_GROUPS.flatMap(c => c.sectionKeys))
  const categoryItems: ActivityItem[] = CATEGORY_GROUPS.map(c => ({
    key: c.key,
    label: c.label,
    sublabel: c.sectionKeys.map(sectionLabel).join(' · '),
  }))
  const otherItems: ActivityItem[] = ACTIVITY_SECTIONS
    .filter(s => !categorizedKeys.has(s.key))
    .map(s => ({ key: s.key, label: s.label }))
  return [...categoryItems, ...otherItems]
}

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

const COLOR_LINE_ORDER: ActivityStatus[] = ['red', 'amber', 'green']

function ColorLine({
  status, value, onCommit,
}: {
  status: ActivityStatus
  value: string
  onCommit: (v: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const cfg = STATUS_CONFIG[status]

  const commit = () => {
    setEditing(false)
    if (draft.trim() !== value) onCommit(draft.trim())
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`block h-[9px] w-[9px] rounded-full flex-shrink-0 ${cfg.dot}`} title={cfg.label} />
      {editing ? (
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
          autoFocus
          placeholder={`${cfg.label} update…`}
          className="flex-1 text-[12.5px] text-[#2A1F1A] bg-white border border-[#6B4C4C] rounded-[6px] px-2 py-0.5 outline-none ring-1 ring-[rgba(107,76,76,.15)]"
        />
      ) : (
        <p
          className="flex-1 text-[12.5px] text-[#6B4C4C] leading-[1.4] cursor-pointer truncate"
          onDoubleClick={() => { setDraft(value); setEditing(true) }}
          title="Double-click to edit"
        >
          {value || <span className="text-[#D4CBC0] italic">Double-click to add a {cfg.label.toLowerCase()} update…</span>}
        </p>
      )}
    </div>
  )
}

// Category rows: one card per stakeholder group, with three independent
// lines (red/yellow/green) instead of a single cycling status — a
// stakeholder can report a blocker, a caution, and a win in the same week.
function CategoryCard({
  label, sublabel, entry, defaultOwner, onSave,
}: {
  label: string
  sublabel?: string
  entry: ActivityEntry | undefined
  defaultOwner: string
  onSave: (updates: Partial<ActivityEntry>) => void
}) {
  const updatedAtStr = entry?.updatedAt?.toDate?.()?.toISOString() || null
  const ownerValue = entry?.owner ?? defaultOwner ?? ''

  return (
    <div className="px-4 py-3 border-b border-[#EEE7DC] last:border-0 hover:brightness-[0.98] transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="text-[13px] font-[600] text-[#2A1F1A] truncate">{label}</div>
          {sublabel && <div className="text-[10px] text-[#7A6A60] truncate" title={sublabel}>{sublabel}</div>}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <OwnerSelect value={ownerValue} onChange={(v) => onSave({ owner: v })} />
          <div className="text-[11.5px] text-[#7A6A60] w-16 text-right">{timeAgo(updatedAtStr)}</div>
        </div>
      </div>
      <div className="space-y-1.5 pl-0.5">
        {COLOR_LINE_ORDER.map(status => {
          const field = STATUS_LINE_FIELD[status]
          // Fall back to the old single status+summary shape so nothing
          // written before this format existed appears to vanish — it shows
          // in the matching color slot until edited, at which point it's
          // saved into the new per-line field.
          const legacyValue = entry?.status === status ? entry?.summary : undefined
          const value = entry?.[field] || legacyValue || ''
          return (
            <ColorLine
              key={status}
              status={status}
              value={value}
              onCommit={(v) => onSave({ [field]: v })}
            />
          )
        })}
      </div>
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

  const items = buildActivityItems()
  const categoryKeys = new Set(CATEGORY_GROUPS.map(c => c.key))
  const categoryItems = items.filter(i => categoryKeys.has(i.key))
  const otherItems = items.filter(i => !categoryKeys.has(i.key))

  return (
    <div className="rounded-[16px] border border-[#D4CBC0] bg-white overflow-hidden shadow-[0_4px_20px_rgba(40,20,10,.04)]">
      <div>
        <CategoryHeader label="Categories — one red, one yellow, one green line each" />
        {categoryItems.map(item => (
          <CategoryCard
            key={item.key}
            label={item.label}
            sublabel={item.sublabel}
            entry={data[item.key]}
            defaultOwner={DEFAULT_OWNERS[item.key] || ''}
            onSave={(updates) => { void saveEntry(item.key, updates, user?.email || 'unknown') }}
          />
        ))}
      </div>

      <div>
        <CategoryHeader label="Other Functions — one red, one yellow, one green line each" />
        {otherItems.map(item => (
          <CategoryCard
            key={item.key}
            label={item.label}
            sublabel={item.sublabel}
            entry={data[item.key]}
            defaultOwner={DEFAULT_OWNERS[item.key] || ''}
            onSave={(updates) => { void saveEntry(item.key, updates, user?.email || 'unknown') }}
          />
        ))}
      </div>
    </div>
  )
}
