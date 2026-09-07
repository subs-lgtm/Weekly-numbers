'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getDb } from '@/lib/firebase'
import { collection, doc, onSnapshot, setDoc, serverTimestamp, type Unsubscribe } from 'firebase/firestore'
import { useAuth } from '@/lib/auth-context'
import { SECTIONS } from '@/lib/metrics-config'

// Legacy-only type — no longer used to color anything, kept solely so old
// Firestore fields typecheck for the one-time read-time migration below.
export type ActivityStatus = 'red' | 'amber' | 'green'

// One of a card's "top 3 activities this week" — plain free text, no status.
// (Red/yellow/green was removed entirely per explicit request on 2026-09-07;
// see CLAUDE.md.)
export type ActivityRow = { text: string }

export type ActivityEntry = {
  // Legacy "Other" rows (pre-2026-09-07): single cycling status + one summary
  // line. Kept only so old data migrates cleanly into `rows` on read — see
  // getRowsFromEntry(). Never written by current code.
  status?: ActivityStatus
  summary?: string
  // Legacy category rows (pre-2026-09-07): three lines fixed one-per-color.
  // Kept only for the same migration reason as above.
  redLine?: string
  amberLine?: string
  greenLine?: string
  // Current shape (2026-09-07+): top 3 free-text activities this week, in
  // display order. Always exactly 3 once saved.
  rows?: ActivityRow[]
  owner: string
  updatedBy: string
  updatedAt: any
}

const EMPTY_ROW: ActivityRow = { text: '' }

// Always returns exactly 3 rows for a card, migrating older Firestore shapes
// on the fly (display-only — nothing is rewritten until the user edits a
// row) so nothing written before this format existed appears to vanish.
// Status is dropped entirely during migration — old red/yellow/green text
// still shows up, just without a color.
function getRowsFromEntry(entry: ActivityEntry | undefined): ActivityRow[] {
  if (entry?.rows && entry.rows.length > 0) {
    const r = entry.rows.slice(0, 3).map(row => ({ text: row?.text || '' }))
    while (r.length < 3) r.push({ ...EMPTY_ROW })
    return r
  }
  // Legacy category shape: one fixed-color line each -> becomes the initial 3 rows (text only).
  if (entry && (entry.redLine || entry.amberLine || entry.greenLine)) {
    return [
      { text: entry.redLine || '' },
      { text: entry.amberLine || '' },
      { text: entry.greenLine || '' },
    ]
  }
  // Legacy "Other" shape: single cycling status + one summary line.
  if (entry?.summary) {
    return [{ text: entry.summary }, { ...EMPTY_ROW }, { ...EMPTY_ROW }]
  }
  return [{ ...EMPTY_ROW }, { ...EMPTY_ROW }, { ...EMPTY_ROW }]
}

// Only show functions that make sense as a one-line weekly activity row.
// mqls/leads are aggregate rollups covered elsewhere on this page, not a "function".
// agentpreneur: activity stopped ~a month ago — excluded here (not deleted from
// metrics-config) so it's a one-line change to bring back if it resumes.
// reachout-activity: removed from Summary for now — excluded here (not deleted from
// metrics-config) so it's a one-line change to bring back later.
// git-agent: was appearing as a second, empty "GSI/SI"-looking row in Other Functions (its
// label happened to say 'GSI/SI', unrelated to the real GSI & SI Partners category card above
// it) — excluded here (not deleted from metrics-config, its own /git-agent page is untouched)
// so it's a one-line change to bring back if this rollup is wanted again later.
export const ACTIVITY_SECTIONS = SECTIONS.filter(s => !['mqls', 'leads', 'agent-studio-leads', 'agentpreneur', 'reachout-activity', 'git-agent'].includes(s.key))

// Each category collapses multiple existing sections into a SINGLE trackable
// row — one status dot, one summary, one owner, one Firestore doc — covering
// everything listed in sectionKeys. The underlying sections keep their own
// dedicated pages/keys elsewhere in the app; this only changes how their
// weekly status gets tracked and rolled up on the Summary page.
const CATEGORY_GROUPS: { key: string; label: string; sectionKeys: string[] }[] = [
  { key: 'cat-ads', label: 'Ads', sectionKeys: ['ads'] },
  { key: 'cat-gsi-founder-amp', label: 'GSI/SI & Founder Amplification', sectionKeys: ['gsi-si-founder-amplification'] },
  { key: 'cat-seo-content', label: 'SEO / Content', sectionKeys: ['seo', 'content', 'playbooks'] },
  // No dedicated dashboard page for ABM — this is a tracking-only row (empty sectionKeys is
  // fine: buildActivityItems()'s sublabel is skipped when there's nothing to join).
  { key: 'cat-abm', label: 'ABM', sectionKeys: [] },
  { key: 'cat-products', label: 'Products', sectionKeys: ['studio-signups', 'architect', 'lyzr-gpt'] },
  { key: 'cat-social', label: 'Social & Influencers', sectionKeys: ['social-influencers', 'reddit'] },
  { key: 'cat-website', label: 'Website', sectionKeys: ['pages', 'ui-ux', 'pr-news'] },
  // Partners theme — split into one card per owner instead of one merged card, but kept
  // adjacent here (and flagged via PARTNERS_THEME_KEYS below) so they render as a themed
  // sub-group under a shared "Partners" sub-header rather than 3 unrelated-looking cards.
  { key: 'cat-partners-hyperscalers', label: 'Hyperscalers & Hardware', sectionKeys: ['partners-aws'] },
  { key: 'cat-partners-emerging', label: 'Emerging Partners', sectionKeys: ['partners-emerging'] },
  { key: 'cat-partners-gsi', label: 'GSI & SI', sectionKeys: ['partners-gsi'] },
]

// The first key here gets a "Partners" sub-header rendered above it in the category list.
const PARTNERS_THEME_FIRST_KEY = 'cat-partners-hyperscalers'

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
  'Vaibhavi', 'Kunj', 'Leonard', 'Vaibhav', 'Nirupam', 'Apoorva', 'Faraaz', 'Rida', 'Alma', 'Arnav', 'Anuskha',
  'Rishabh', 'Deepyanti', 'Deepankar',
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
  'cat-partners-hyperscalers': 'Anuskha',
  'cat-partners-emerging': 'Apoorva',
  'cat-partners-gsi': 'Kailash',
  // Category-card defaults (2026-09-07 fix) — CategoryCard looks up DEFAULT_OWNERS by the
  // CATEGORY key (e.g. 'cat-ads'), not by its underlying section key(s) above. Before this,
  // 'ads'/'seo'/'content' etc. had defaults set, but the "Ads"/"SEO / Content" CATEGORY CARDS
  // never picked them up — they always showed unassigned regardless. Only the three
  // cat-partners-* entries above were already keyed correctly (no merged-section conflict).
  // Only added here where the underlying sections agree on one owner (or there's just one
  // section) — see CLAUDE.md for the categories deliberately left out due to a conflict
  // (cat-social, cat-website) or no existing signal at all (cat-gsi-founder-amp, cat-abm,
  // cat-products) — don't guess an owner for those without asking first.
  'cat-ads': 'Mothilal',
  'cat-seo-content': 'Shreya',
  'cat-social': 'Prince', // confirmed by user 2026-09-07 (over Kailash, the Reddit owner)
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

// One of a card's 3 free-text activity rows — plain text, no status.
function ActivityRowLine({
  row, onChangeText,
}: {
  row: ActivityRow
  onChangeText: (text: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(row.text)

  const commit = () => {
    setEditing(false)
    if (draft.trim() !== row.text) onChangeText(draft.trim())
  }

  return (
    <div className="flex items-center gap-2">
      {editing ? (
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(row.text); setEditing(false) } }}
          autoFocus
          placeholder="This week's activity…"
          className="flex-1 text-[12.5px] text-[#2A1F1A] bg-white border border-[#6B4C4C] rounded-[6px] px-2 py-0.5 outline-none ring-1 ring-[rgba(107,76,76,.15)]"
        />
      ) : (
        <p
          className="flex-1 text-[12.5px] text-[#6B4C4C] leading-[1.4] cursor-pointer truncate"
          onDoubleClick={() => { setDraft(row.text); setEditing(true) }}
          title="Double-click to edit"
        >
          {row.text || <span className="text-[#D4CBC0] italic">Double-click to add this week's activity…</span>}
        </p>
      )}
    </div>
  )
}

// Category rows: one card per stakeholder group, with 3 free-text "top
// activities this week" rows.
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
  const rows = getRowsFromEntry(entry)

  const saveRow = (idx: number, text: string) => {
    const newRows = rows.map((r, i) => i === idx ? { text } : r)
    onSave({ rows: newRows })
  }

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
        {rows.map((row, i) => (
          <ActivityRowLine
            key={i}
            row={row}
            onChangeText={(text) => saveRow(i, text)}
          />
        ))}
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
        <CategoryHeader label="Top 3 activities this week — per category" />
        {categoryItems.map(item => (
          <div key={item.key}>
            {item.key === PARTNERS_THEME_FIRST_KEY && (
              <div className="px-4 py-1 bg-white border-b border-[#EEE7DC] text-[9.5px] uppercase tracking-[.08em] font-[600] text-[#A99A8E]">
                Partners
              </div>
            )}
            <CategoryCard
              label={item.label}
              sublabel={item.sublabel}
              entry={data[item.key]}
              defaultOwner={DEFAULT_OWNERS[item.key] || ''}
              onSave={(updates) => { void saveEntry(item.key, updates, user?.email || 'unknown') }}
            />
          </div>
        ))}
      </div>

      <div>
        <CategoryHeader label="Other Functions — top 3 activities this week" />
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
