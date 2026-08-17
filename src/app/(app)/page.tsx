"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { format, startOfWeek, endOfWeek, subWeeks, addWeeks } from "date-fns";
import { SectionShell } from "@/components/SectionShell";
import { WeekSelector } from "@/components/WeekSelector";
import { weekKey } from "@/hooks/useWeeklyMetrics";
import { useAuth } from "@/lib/auth-context";
import { useWeek } from "@/lib/week-context";
import { getDb } from "@/lib/firebase";
import {
  collection, doc, onSnapshot, setDoc, serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { Loader2, TrendingUp, TrendingDown, Minus, Pencil, Check, X } from "lucide-react";
import { HighPriorityLeads } from "@/components/summary/HighPriorityLeads";
import { ActivitySummaryTable, ACTIVITY_SECTIONS, useActivitySummary } from "@/components/summary/ActivitySummaryTable";

type RagItem = {
  id: string;
  status: "red" | "yellow" | "green";
  title: string;
  note: string;
  createdBy: string;
  updatedAt?: any;
};

const RAG_CONFIG = {
  red: { label: "Red", emoji: "🔴", bg: "bg-[rgba(220,38,38,.06)]", border: "border-[rgba(220,38,38,.25)]", text: "text-[#DC2626]", dot: "bg-[#DC2626]" },
  yellow: { label: "Yellow", emoji: "🟡", bg: "bg-[rgba(217,119,6,.06)]", border: "border-[rgba(217,119,6,.25)]", text: "text-[#D97706]", dot: "bg-[#D97706]" },
  green: { label: "Green", emoji: "🟢", bg: "bg-[rgba(22,163,74,.06)]", border: "border-[rgba(22,163,74,.25)]", text: "text-[#16A34A]", dot: "bg-[#16A34A]" },
};

// Derives the top RAG board directly from Activity Summary entries — any row with
// both a status and a summary written in shows up here automatically, in the
// matching color. No separate manual entry; Activity Summary is the single source.
function useDerivedRagFlags(weekStart: string) {
  const { data, loading } = useActivitySummary(weekStart);

  const flags: RagItem[] = ACTIVITY_SECTIONS
    .filter(s => {
      const entry = data[s.key];
      return entry?.status && entry?.summary?.trim();
    })
    .map(s => {
      const entry = data[s.key];
      const status = entry.status === "amber" ? "yellow" : entry.status;
      return {
        id: s.key,
        status: status as "red" | "yellow" | "green",
        title: s.label,
        note: entry.summary,
        createdBy: entry.updatedBy,
        updatedAt: entry.updatedAt,
      };
    });

  return { flags, loading };
}

function timeAgo(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ""
  const diffMs = Date.now() - d.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// Read-only — sourced entirely from Activity Summary entries below. To change
// what shows here, set a status + write a summary on the matching row in
// Activity Summary; there's no separate editing surface for these cards.
function RagCard({ status, flags }: {
  status: "red" | "yellow" | "green";
  flags: RagItem[];
}) {
  const cfg = RAG_CONFIG[status];
  const items = flags.filter(f => f.status === status);

  return (
    <div className={`rounded-[20px] border ${cfg.border} ${cfg.bg} p-5 shadow-[0_4px_20px_rgba(40,20,10,.04)]`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
        <span className={`text-[13px] font-[600] ${cfg.text} uppercase tracking-[0.1em]`}>{cfg.label}</span>
        <span className="text-[11px] text-[#7A6A60]">({items.length})</span>
      </div>

      {items.length === 0 && (
        <p className="text-[12px] text-[#7A6A60] italic">No {cfg.label.toLowerCase()} items yet — mark a row {cfg.label.toLowerCase()} in Activity Summary below and add a one-line update.</p>
      )}

      <div className="space-y-2">
        {items.map(item => (
          <RagItemRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function RagItemRow({ item }: { item: RagItem }) {
  return (
    <div className="rounded-[12px] bg-white/80 border border-[#D4CBC0]/40 p-3">
      <span className="text-[13px] font-[600] text-[#2A1F1A]">{item.title}</span>
      <p className="mt-0.5 text-[12px] text-[#7A6A60]">{item.note}</p>
      {item.createdBy && (
        <p className="mt-1 text-[10px] text-[#D4CBC0]">
          {item.createdBy.split("@")[0]}
          {item.updatedAt?.toDate && ` · ${timeAgo(item.updatedAt.toDate().toISOString())}`}
        </p>
      )}
    </div>
  );
}

// Key metrics pulled from across all sections
const SUMMARY_METRICS: { section: string; key: string; label: string; prefix?: string; isManual?: boolean; isGSI?: boolean }[] = [
  { section: 'mqls', key: 'total_leads', label: 'Total Leads' },
  { section: 'mqls', key: 'mqls_total', label: "Total MQL's" },
  { section: 'mqls', key: 'qualified_mqls', label: "Qualified MQL's" },
  { section: 'mqls', key: 'sql_count', label: 'SQLs' },
  { section: 'mqls', key: 'demo_booked', label: 'Demo Booked' },
  { section: 'mqls', key: 'demo_completed', label: 'Demo Completed' },
  { section: 'mqls', key: 'opportunity_count', label: 'Opportunity' },
  { section: 'mqls', key: 'customer_count', label: 'Customer' },
  { section: 'mqls', key: 'demo_no_show', label: 'Demo No Show' },
  { section: 'mqls', key: 'meeting_booked', label: 'Meetings Booked' },
  { section: 'ads', key: 'total_mqls', label: "MQL's from Ads" },
  { section: 'ads', key: 'total_spend', label: 'Ad Spend (Overall)', prefix: '$', isManual: true },
  { section: 'seo', key: 'organic_traffic', label: 'Organic Traffic' },
  { section: 'gsi', key: 'gsi_total', label: 'GSI & SI Leads', isGSI: true },
]

function useSummaryData(weekStart: string, queryStart?: string, queryEnd?: string) {
  const [data, setData] = useState<Record<string, string>>({})
  const [prevData, setPrevData] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  // Track keys that have been manually saved to Firestore — API must not overwrite these
  const manualKeys = useRef<Set<string>>(new Set())
  // Track keys that have been manually saved for the previous week
  const prevManualKeys = useRef<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    setData({})
    setPrevData({})
    manualKeys.current.clear()
    prevManualKeys.current.clear()

    // Use explicit query dates if provided, otherwise fall back to week-based
    const start = queryStart || weekStart
    const end = queryEnd || format(addWeeks(new Date(weekStart + 'T00:00:00'), 1), 'yyyy-MM-dd')
    const prevWeek = format(subWeeks(new Date(weekStart + 'T00:00:00'), 1), 'yyyy-MM-dd')
    const prevWeekEnd = start

    // Fetch live HubSpot data for MQLs + Meetings Booked + Total Leads
    Promise.all([
      fetch(`/api/hubspot/mqls?start=${start}&end=${end}&nocache=1`).then(r => r.json()).catch(() => null),
      fetch(`/api/hubspot/mqls?start=${prevWeek}&end=${prevWeekEnd}&nocache=1`).then(r => r.json()).catch(() => null),
      fetch(`/api/hubspot/mqls?start=${start}&end=${end}&mode=all&nocache=1`).then(r => r.json()).catch(() => null),
      fetch(`/api/hubspot/mqls?start=${prevWeek}&end=${prevWeekEnd}&mode=all&nocache=1`).then(r => r.json()).catch(() => null),
      fetch(`/api/summary-metrics?start=${start}&end=${end}`).then(r => r.json()).catch(() => null),
      fetch(`/api/summary-metrics?start=${prevWeek}&end=${prevWeekEnd}`).then(r => r.json()).catch(() => null),
      fetch(`/api/hubspot/gsi-leads?start=${start}&end=${end}`).then(r => r.json()).catch(() => null),
      fetch(`/api/hubspot/gsi-leads?start=${prevWeek}&end=${prevWeekEnd}`).then(r => r.json()).catch(() => null),
    ]).then(([curr, prev, allCurr, allPrev, metrics, prevMetrics, gsi, prevGsi]) => {
      if (curr && !curr.error) {
        setData(d => ({
          ...d,
          'mqls:mqls_total': String(curr.total || 0),
          'mqls:qualified_mqls': String(curr.qualified_mqls || 0),
          'mqls:sql_count': String(curr.funnel?.sql || 0),
          'mqls:demo_booked': String(curr.funnel?.demo_booked || 0),
          'mqls:demo_completed': String(curr.funnel?.demo_completed || 0),
          'mqls:opportunity_count': String(curr.funnel?.opportunity || 0),
          'mqls:customer_count': String(curr.funnel?.customer || 0),
          'mqls:demo_no_show': String(curr.funnel?.demo_no_show || 0),
          'mqls:meeting_booked': String(curr.funnel?.meeting_booked || 0),
          'ads:total_mqls': String(curr.paid_mqls || 0),
        }))
      }
      if (prev && !prev.error) {
        setPrevData(d => ({
          ...d,
          'mqls:mqls_total': String(prev.total || 0),
          'mqls:qualified_mqls': String(prev.qualified_mqls || 0),
          'mqls:sql_count': String(prev.funnel?.sql || 0),
          'mqls:demo_booked': String(prev.funnel?.demo_booked || 0),
          'mqls:demo_completed': String(prev.funnel?.demo_completed || 0),
          'mqls:opportunity_count': String(prev.funnel?.opportunity || 0),
          'mqls:customer_count': String(prev.funnel?.customer || 0),
          'mqls:demo_no_show': String(prev.funnel?.demo_no_show || 0),
          'mqls:meeting_booked': String(prev.funnel?.meeting_booked || 0),
          'ads:total_mqls': String(prev.paid_mqls || 0),
        }))
      }
      if (allCurr && !allCurr.error) {
        // Exclude Book a Demo (Book a Demo + Email Form + Pre-Built Agents) from total leads — those are MQLs
        const bookDemoCount = (allCurr.by_form_type?.['Book a Demo'] || 0) + (allCurr.by_form_type?.['Email Form'] || 0) + (allCurr.by_form_type?.['Pre-Built Agents'] || 0)
        setData(d => ({ ...d, 'mqls:total_leads': String((allCurr.total || 0) - bookDemoCount) }))
      }
      if (allPrev && !allPrev.error) {
        const prevBookDemoCount = (allPrev.by_form_type?.['Book a Demo'] || 0) + (allPrev.by_form_type?.['Email Form'] || 0) + (allPrev.by_form_type?.['Pre-Built Agents'] || 0)
        setPrevData(d => ({ ...d, 'mqls:total_leads': String((allPrev.total || 0) - prevBookDemoCount) }))
      }
      if (metrics && !metrics.error) {
        setData(d => ({
          ...d,
          // Only write API value if not manually overridden in Firestore
          ...(!manualKeys.current.has('ads:total_spend') ? { 'ads:total_spend': String(metrics.adSpend || 0) } : {}),
          'seo:organic_traffic': String(metrics.organicTraffic || 0),
        }))
      }
      if (prevMetrics && !prevMetrics.error) {
        setPrevData(d => ({
          ...d,
          ...(!prevManualKeys.current.has('ads:total_spend') ? { 'ads:total_spend': String(prevMetrics.adSpend || 0) } : {}),
          'seo:organic_traffic': String(prevMetrics.organicTraffic || 0),
        }))
      }
      if (gsi && !gsi.error) {
        setData(d => ({
          ...d,
          'gsi:gsi_total': String(gsi.total || 0),
          'gsi:gsi_high':  String(gsi.priority?.high || 0),
          'gsi:gsi_demo':  String(gsi.demoBooked || 0),
        }))
      }
      if (prevGsi && !prevGsi.error) {
        setPrevData(d => ({ ...d, 'gsi:gsi_total': String(prevGsi.total || 0) }))
      }
      setLoading(false)
    })

    // Also fetch from Firestore for other sections + manual overrides
    const db = getDb()
    let loaded = 0

    const unsubs: Unsubscribe[] = []
    const sections = [...new Set(SUMMARY_METRICS.map(m => m.section))]

    for (const sec of sections) {
      // Current week
      const col = collection(db, 'weekly_metrics', weekStart, 'sections', sec, 'entries')
      unsubs.push(onSnapshot(col, snap => {
        const result: Record<string, string> = {}
        snap.forEach(d => {
          const docData = d.data()
          const compositeKey = `${sec}:${d.id}`
          result[compositeKey] = docData.value ?? ''
          // If saved manually (not by the API/hubspot sync), mark as manual override
          // so the API fetch won't overwrite it
          if (docData.updatedBy && docData.updatedBy !== 'hubspot' && docData.updatedBy !== 'system') {
            manualKeys.current.add(compositeKey)
          } else if (docData.updatedBy === 'hubspot' || docData.updatedBy === 'system') {
            manualKeys.current.delete(compositeKey)
          }
        })
        setData(prev => ({ ...prev, ...result }))
        loaded++
      }))

      // Previous period (manual/Firestore-entered metrics only make sense per-week, so this
      // still reads the single prior week even in MTD/QTD mode — live HubSpot numbers above
      // already use the correct wider previous-period range)
      const prevCol = collection(db, 'weekly_metrics', prevWeek, 'sections', sec, 'entries')
      unsubs.push(onSnapshot(prevCol, snap => {
        const result: Record<string, string> = {}
        snap.forEach(d => {
          const docData = d.data()
          const compositeKey = `${sec}:${d.id}`
          result[compositeKey] = docData.value ?? ''
          if (docData.updatedBy && docData.updatedBy !== 'hubspot' && docData.updatedBy !== 'system') {
            prevManualKeys.current.add(compositeKey)
          } else if (docData.updatedBy === 'hubspot' || docData.updatedBy === 'system') {
            prevManualKeys.current.delete(compositeKey)
          }
        })
        setPrevData(prev => ({ ...prev, ...result }))
      }))
    }

    return () => unsubs.forEach(u => u())
  }, [weekStart, queryStart, queryEnd])

  return { data, prevData, loading }
}

// ── ManualEditCard — click pencil to inline-edit, saves to Firestore ──────────
function ManualEditCard({
  label, prefix, weekStart, sectionKey, entryKey, currentVal, prevVal,
}: {
  label: string; prefix?: string; firestoreKey: string;
  weekStart: string; sectionKey: string; entryKey: string;
  currentVal: string; prevVal: string;
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState('')
  const [saving, setSaving]   = useState(false)
  const { user } = useAuth()

  const n = parseFloat(currentVal)
  const p = parseFloat(prevVal)
  const hasVal  = currentVal && currentVal !== ''
  const hasDelta = !isNaN(n) && !isNaN(p) && p > 0
  const pct = hasDelta ? Math.round(((n - p) / p) * 100) : 0

  const formatVal = (v: string) => {
    const num = parseFloat(v)
    if (isNaN(num)) return v
    return num.toLocaleString()
  }

  const handleEdit = () => {
    // Pre-fill with raw number (strip $ and k)
    setDraft(currentVal || '')
    setEditing(true)
  }

  const handleSave = async () => {
    const raw = draft.replace(/[$,\s]/g, '')
    if (!raw || isNaN(parseFloat(raw))) { setEditing(false); return }
    setSaving(true)
    try {
      const db = getDb()
      const ref = doc(db, 'weekly_metrics', weekStart, 'sections', sectionKey, 'entries', entryKey)
      await setDoc(ref, {
        value: raw,
        notes: 'Manually entered',
        updatedBy: user?.email || 'unknown',
        updatedAt: serverTimestamp(),
      }, { merge: true })
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  return (
    <div className="relative group rounded-[16px] bg-white border border-[#D4CBC0] p-4 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
      <div className="flex items-start justify-between mb-1.5">
        <p className="eyebrow">{label}</p>
        {!editing && (
          <button
            onClick={handleEdit}
            title="Manually update"
            className="opacity-0 group-hover:opacity-100 transition-opacity text-[#7A6A60] hover:text-[#6B4C4C] ml-1 flex-shrink-0"
          >
            <Pencil className="h-3 w-3" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-1.5">
          <span className="text-[1rem] text-[#7A6A60]">{prefix || ''}</span>
          <input
            type="number"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleSave(); if (e.key === 'Escape') setEditing(false) }}
            autoFocus
            placeholder="e.g. 7400"
            className="w-full rounded-[8px] border border-[#6B4C4C] bg-white px-2 py-1 text-[1rem] font-[500] text-[#2A1F1A] outline-none ring-1 ring-[rgba(107,76,76,.15)] tabular-nums"
          />
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-[#6B4C4C] text-white hover:opacity-80 disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full border border-[#D4CBC0] text-[#7A6A60] hover:bg-[#F2EDE8]"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <p
          className="text-[1.5rem] font-[500] text-[#2A1F1A] tabular-nums leading-tight cursor-pointer"
          onClick={handleEdit}
          title="Click to edit"
        >
          {hasVal ? `${prefix || ''}${formatVal(currentVal)}` : <span className="text-[#D4CBC0]">— click to enter</span>}
        </p>
      )}

      {!editing && (
        <div className="flex items-center gap-2 mt-1.5">
          {hasDelta && pct !== 0 && (
            <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${pct > 0 ? 'delta-up' : 'delta-down'}`}>
              {pct > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
              {pct > 0 ? '+' : ''}{pct}%
            </span>
          )}
          {hasDelta && pct === 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold delta-flat">
              <Minus className="h-2.5 w-2.5" />0%
            </span>
          )}
          {prevVal && !isNaN(p) && (
            <span className="text-[11px] text-[#7A6A60]">prev: {prefix || ''}{formatVal(prevVal)}</span>
          )}
        </div>
      )}
      {!editing && hasVal && (
        <p className="text-[10px] text-[#D4CBC0] mt-0.5 italic">manual · hover to edit</p>
      )}
    </div>
  )
}

function SummaryMetrics({ weekStart, queryStart, queryEnd }: { weekStart: string; queryStart?: string; queryEnd?: string }) {
  const { data, prevData, loading } = useSummaryData(weekStart, queryStart, queryEnd)

  if (loading) return (
    <div>
      <p className="eyebrow mb-3">Key Numbers</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SUMMARY_METRICS.map(m => (
          <div
            key={`${m.section}:${m.key}`}
            className="rounded-[16px] bg-white border border-[#D4CBC0] p-4 shadow-[0_4px_20px_rgba(40,20,10,.07)]"
          >
            <p className="eyebrow mb-1.5">{m.label}</p>
            <div className="flex items-center gap-2 h-[2rem]">
              <div className="w-4 h-4 border-2 border-[#6B4C4C] border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const hasAny = !loading && SUMMARY_METRICS.some(m => {
    const v = data[`${m.section}:${m.key}`]
    return v && v !== '' && v !== '0'
  })

  if (!loading && !hasAny) return null

  return (
    <div>
      <p className="eyebrow mb-3">Key Numbers</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SUMMARY_METRICS.map(m => {
          const val = data[`${m.section}:${m.key}`] || ''
          const prev = prevData[`${m.section}:${m.key}`] || ''
          const n = parseFloat(val)
          const p = parseFloat(prev)
          const hasVal = val && val !== ''
          const hasDelta = !isNaN(n) && !isNaN(p) && p > 0
          const pct = hasDelta ? Math.round(((n - p) / p) * 100) : 0

          if (m.isManual) {
            return (
              <ManualEditCard
                key={`${m.section}:${m.key}`}
                label={m.label}
                prefix={m.prefix}
                firestoreKey={`${m.section}:${m.key}`}
                weekStart={weekStart}
                sectionKey={m.section}
                entryKey={m.key}
                currentVal={val}
                prevVal={prev}
              />
            )
          }

          if (m.isGSI) {
            const high  = data['gsi:gsi_high']  || '0'
            const demo  = data['gsi:gsi_demo']   || '0'
            return (
              <div
                key={`${m.section}:${m.key}`}
                className="rounded-[16px] bg-white border border-[#D4CBC0] p-4 shadow-[0_4px_20px_rgba(40,20,10,.07)]"
              >
                <p className="eyebrow mb-1.5">{m.label}</p>
                <p className="text-[1.5rem] font-[500] text-[#2A1F1A] tabular-nums leading-tight">
                  {hasVal ? n.toLocaleString() : '—'}
                </p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  {hasDelta && pct !== 0 && (
                    <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${pct > 0 ? 'delta-up' : 'delta-down'}`}>
                      {pct > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                      {pct > 0 ? '+' : ''}{pct}%
                    </span>
                  )}
                  {prev && !isNaN(p) && (
                    <span className="text-[11px] text-[#7A6A60]">prev: {p}</span>
                  )}
                </div>
                {hasVal && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] font-[600] text-[#DC2626]">🔴 {high} high</span>
                    <span className="text-[10px] text-[#7A6A60]">·</span>
                    <span className="text-[10px] font-[600] text-[#16A34A]">📅 {demo} demo</span>
                  </div>
                )}
              </div>
            )
          }

          return (
            <div
              key={`${m.section}:${m.key}`}
              className="rounded-[16px] bg-white border border-[#D4CBC0] p-4 shadow-[0_4px_20px_rgba(40,20,10,.07)]"
            >
              <p className="eyebrow mb-1.5">{m.label}</p>
              <p className="text-[1.5rem] font-[500] text-[#2A1F1A] tabular-nums leading-tight">
                {hasVal ? `${m.prefix || ''}${isNaN(n) ? val : n.toLocaleString()}` : '—'}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                {hasDelta && pct !== 0 && (
                  <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${pct > 0 ? 'delta-up' : 'delta-down'}`}>
                    {pct > 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                    {pct > 0 ? '+' : ''}{pct}%
                  </span>
                )}
                {hasDelta && pct === 0 && (
                  <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold delta-flat">
                    <Minus className="h-2.5 w-2.5" />0%
                  </span>
                )}
                {prev && !isNaN(p) && (
                  <span className="text-[11px] text-[#7A6A60]">prev: {m.prefix || ''}{p.toLocaleString()}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function SummaryPage() {
  const { weekStart: ws, queryStart, queryEnd } = useWeek();
  const { flags, loading } = useDerivedRagFlags(ws);

  const weekDate = new Date(ws + "T00:00:00");
  const weekEnd = endOfWeek(weekDate, { weekStartsOn: 1 });

  return (
    <SectionShell
      title="Summary"
      description={`Week of ${format(weekDate, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`}
    >
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-2 text-[#7A6A60]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-[13px]">Loading…</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* RAG Cards — auto-populated from Activity Summary below */}
          <div className="grid gap-4 md:grid-cols-3">
            {(["red", "yellow", "green"] as const).map(s => (
              <RagCard key={s} status={s} flags={flags} />
            ))}
          </div>

          {/* Hint */}
          <div className="px-1">
            <p className="caption">
              Set a status and write a one-line update on a row in Activity Summary below — it shows up here automatically, in the matching color.
            </p>
          </div>

          {/* Key Metrics Overview */}
          <SummaryMetrics weekStart={ws} queryStart={queryStart} queryEnd={queryEnd} />

          {/* Activity Summary — one-line status per marketing function */}
          <div>
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="eyebrow">Activity Summary</p>
              <p className="caption">Click the dot to cycle status · double-click summary to edit</p>
            </div>
            <ActivitySummaryTable weekStart={ws} />
          </div>

          {/* High Priority Leads — synced to date range */}
          <HighPriorityLeads queryStart={queryStart || ws} queryEnd={queryEnd || format(addWeeks(new Date(ws + 'T00:00:00'), 1), 'yyyy-MM-dd')} />
        </div>
      )}
    </SectionShell>
  );
}
