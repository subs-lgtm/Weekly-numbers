'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X } from 'lucide-react'
import { getDb } from '@/lib/firebase'
import {
  collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { useAuth } from '@/lib/auth-context'
import { timeAgo } from './ActivitySummaryTable'

// Weekly RAG Status — v2, 2026-09-14. First cut (a per-channel status+3-points table,
// mirroring Activity Summary's category list) was explicitly rejected as too big and the
// wrong shape ("don't give something like status per category"). This version is what was
// actually asked for: a plain, freely-growing red/yellow/green log, NOT tied to the channel
// list at all -- anyone adds a one-line item to whichever color bucket, whenever, and it just
// keeps accumulating through the week (closer to the original pre-restructure RAG board's
// feel, but standalone rather than derived from Activity Summary). Fully isolated: own
// Firestore collection (`rag_log`, a flat per-week list of items -- not nested per channel),
// own hook, no shared data or derivation from `activity_summary` at all. Only `timeAgo` is
// reused from ActivitySummaryTable.tsx (a plain formatting helper, not a data dependency).

export type RagLogStatus = 'red' | 'yellow' | 'green'

export type RagLogItem = {
  id: string
  status: RagLogStatus
  text: string
  addedBy: string
  createdAt: any
}

const RAG_CONFIG: Record<RagLogStatus, { label: string; dot: string; bg: string; border: string; text: string }> = {
  red:    { label: 'Red',    dot: 'bg-[#DC2626]', bg: 'bg-[rgba(220,38,38,.06)]', border: 'border-[rgba(220,38,38,.25)]', text: 'text-[#DC2626]' },
  yellow: { label: 'Yellow', dot: 'bg-[#D97706]', bg: 'bg-[rgba(217,119,6,.06)]', border: 'border-[rgba(217,119,6,.25)]', text: 'text-[#D97706]' },
  green:  { label: 'Green',  dot: 'bg-[#16A34A]', bg: 'bg-[rgba(22,163,74,.06)]', border: 'border-[rgba(22,163,74,.25)]', text: 'text-[#16A34A]' },
}

const STATUS_ORDER: RagLogStatus[] = ['red', 'yellow', 'green']

export function useRagLog(weekStart: string) {
  const [items, setItems] = useState<RagLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const unsubRef = useRef<Unsubscribe | null>(null)

  useEffect(() => {
    setLoading(true)
    const db = getDb()
    // Flat per-week collection -- every item is its own doc, ordered oldest-first so a
    // bucket reads top-to-bottom as "the order people added things".
    const col = query(collection(db, 'rag_log', weekStart, 'items'), orderBy('createdAt', 'asc'))
    unsubRef.current = onSnapshot(col, (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<RagLogItem, 'id'>) })))
      setLoading(false)
    }, () => setLoading(false))
    return () => { unsubRef.current?.() }
  }, [weekStart])

  const addItem = useCallback(async (status: RagLogStatus, text: string, userEmail: string) => {
    const db = getDb()
    await addDoc(collection(db, 'rag_log', weekStart, 'items'), {
      status, text, addedBy: userEmail, createdAt: serverTimestamp(),
    })
  }, [weekStart])

  const removeItem = useCallback(async (id: string) => {
    const db = getDb()
    await deleteDoc(doc(db, 'rag_log', weekStart, 'items', id))
  }, [weekStart])

  return { items, loading, addItem, removeItem }
}

function RagColumn({
  status, items, onAdd, onRemove,
}: {
  status: RagLogStatus
  items: RagLogItem[]
  onAdd: (text: string) => void
  onRemove: (id: string) => void
}) {
  const cfg = RAG_CONFIG[status]
  const [draft, setDraft] = useState('')

  const submit = () => {
    const t = draft.trim()
    if (!t) return
    onAdd(t)
    setDraft('')
  }

  return (
    <div className={`rounded-[20px] border ${cfg.border} ${cfg.bg} p-5 shadow-[0_4px_20px_rgba(40,20,10,.04)] flex flex-col`}>
      <div className="flex items-center gap-2 mb-3">
        <span className={`h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
        <span className={`text-[13px] font-[600] ${cfg.text} uppercase tracking-[0.1em]`}>{cfg.label}</span>
        <span className="text-[11px] text-[#7A6A60]">({items.length})</span>
      </div>

      <div className="space-y-2 mb-3 flex-1">
        {items.length === 0 && (
          <p className="text-[12px] text-[#7A6A60] italic">Nothing added yet.</p>
        )}
        {items.map(item => (
          <div key={item.id} className="rounded-[12px] bg-white/80 border border-[#D4CBC0]/40 p-3 flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] text-[#2A1F1A] leading-[1.4]">{item.text}</p>
              <p className="mt-1 text-[10px] text-[#A99A8E]">
                {item.addedBy?.split('@')[0]}
                {item.createdAt?.toDate && ` · ${timeAgo(item.createdAt.toDate().toISOString())}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              title="Remove"
              className="flex-shrink-0 text-[#D4CBC0] hover:text-[#DC2626] transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <input
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder={`Add a ${cfg.label.toLowerCase()} item…`}
          className="flex-1 text-[12.5px] text-[#2A1F1A] bg-white border border-[#D4CBC0] rounded-[8px] px-2.5 py-1.5 outline-none focus:border-[#6B4C4C] focus:ring-1 focus:ring-[rgba(107,76,76,.15)]"
        />
        <button
          type="button"
          onClick={submit}
          className="flex-shrink-0 text-[12px] font-[600] text-white bg-[#2A1F1A] rounded-[8px] px-3 py-1.5 hover:brightness-110 transition-all"
        >
          Add
        </button>
      </div>
    </div>
  )
}

export function WeeklyRagStatus({ weekStart }: { weekStart: string }) {
  const { items, loading, addItem, removeItem } = useRagLog(weekStart)
  const { user } = useAuth()

  if (loading) {
    return (
      <div className="rounded-[16px] border border-[#D4CBC0] bg-white p-8 flex items-center justify-center gap-2">
        <div className="w-4 h-4 border-2 border-[#6B4C4C] border-t-transparent rounded-full animate-spin" />
        <span className="text-[13px] text-[#7A6A60]">Loading RAG status…</span>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {STATUS_ORDER.map(status => (
        <RagColumn
          key={status}
          status={status}
          items={items.filter(i => i.status === status)}
          onAdd={(text) => { void addItem(status, text, user?.email || 'unknown') }}
          onRemove={(id) => { void removeItem(id) }}
        />
      ))}
    </div>
  )
}
