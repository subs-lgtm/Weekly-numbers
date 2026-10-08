'use client'

import { useState } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useG2ClickList, type ClickItem } from '@/hooks/useG2ClickBreakdown'
import { cn } from '@/lib/utils'

function ClickRow({
  item, isMax, maxCount, onUpdateCount, onDelete,
}: {
  item: ClickItem
  isMax: boolean
  maxCount: number
  onUpdateCount: (count: number) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(String(item.count))
  const [saving, setSaving] = useState(false)

  const commit = async () => {
    const n = parseInt(val, 10)
    setEditing(false)
    if (isNaN(n) || n === item.count) { setVal(String(item.count)); return }
    setSaving(true)
    await onUpdateCount(n)
    setSaving(false)
  }

  const pct = maxCount > 0 ? Math.max(3, (item.count / maxCount) * 100) : 3

  return (
    <div className="group/clickrow flex items-center gap-3 py-1.5">
      <span className="w-[150px] shrink-0 truncate text-[12.5px] font-[600] text-[#2A1F1A]" title={item.label}>{item.label}</span>
      <div className="h-[15px] flex-1 overflow-hidden rounded-[5px] bg-[#F2EDE8]">
        <div className="h-full rounded-[5px] bg-[#6B4C4C] transition-all" style={{ width: `${pct}%` }} />
      </div>
      {editing ? (
        <input
          type="number"
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => { if (e.key === 'Enter') void commit(); if (e.key === 'Escape') { setVal(String(item.count)); setEditing(false) } }}
          className="w-[64px] shrink-0 rounded-[6px] border border-[#6B4C4C] bg-white px-2 py-0.5 text-right text-[12.5px] font-[700] text-[#2A1F1A] outline-none ring-1 ring-[rgba(107,76,76,.15)]"
        />
      ) : (
        <button
          onClick={() => { setVal(String(item.count)); setEditing(true) }}
          className="w-[64px] shrink-0 rounded-[6px] px-2 py-0.5 text-right text-[12.5px] font-[700] text-[#2A1F1A] tabular-nums hover:bg-[#F2EDE8]"
          title="Click to edit"
        >
          {saving ? <Loader2 className="ml-auto h-3 w-3 animate-spin" /> : item.count.toLocaleString()}
        </button>
      )}
      <button
        onClick={() => void onDelete()}
        className="shrink-0 text-[#D4CBC0] opacity-0 transition-opacity hover:text-[#DC2626] group-hover/clickrow:opacity-100"
        title="Remove"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function AddRow({ onAdd }: { onAdd: (label: string, count: number) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [count, setCount] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!label.trim() || !count.trim() || isNaN(parseInt(count, 10))) return
    setSaving(true)
    await onAdd(label.trim(), parseInt(count, 10))
    setSaving(false)
    setLabel(''); setCount(''); setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#D4CBC0] px-3 py-1 text-[11.5px] font-[600] text-[#6B4C4C] hover:bg-[#F2EDE8]"
      >
        <Plus className="h-3 w-3" /> Add
      </button>
    )
  }
  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        type="text" placeholder="Name…" value={label} autoFocus
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
        className="min-w-0 flex-1 rounded-[6px] border border-[#D4CBC0] bg-white px-2 py-1 text-[12.5px] outline-none focus:border-[#6B4C4C]"
      />
      <input
        type="number" placeholder="0" value={count}
        onChange={(e) => setCount(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void submit(); if (e.key === 'Escape') setOpen(false) }}
        className="w-[64px] shrink-0 rounded-[6px] border border-[#D4CBC0] bg-white px-2 py-1 text-right text-[12.5px] outline-none focus:border-[#6B4C4C]"
      />
      <button onClick={() => void submit()} disabled={saving} className="shrink-0 rounded-full bg-[#6B4C4C] px-3 py-1 text-[11.5px] font-[600] text-[#F9F5F1] hover:opacity-90 disabled:opacity-50">
        {saving ? '…' : 'Save'}
      </button>
    </div>
  )
}

function ClickPanel({ title, weekStart, listKey }: { title: string; weekStart: string; listKey: string }) {
  const { user } = useAuth()
  const { items, loading, save } = useG2ClickList(weekStart, listKey)
  const sorted = [...items].sort((a, b) => b.count - a.count)
  const max = Math.max(1, ...sorted.map((i) => i.count))

  const updateCount = async (label: string, count: number) => {
    const next = items.map((i) => (i.label === label ? { ...i, count } : i))
    await save(next, user?.email || 'unknown')
  }
  const deleteItem = async (label: string) => {
    await save(items.filter((i) => i.label !== label), user?.email || 'unknown')
  }
  const addItem = async (label: string, count: number) => {
    if (items.some((i) => i.label === label)) return
    await save([...items, { label, count }], user?.email || 'unknown')
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">{title}</span>
      </div>
      {loading ? (
        <p className="text-[12.5px] text-[#7A6A60]">Loading…</p>
      ) : sorted.length === 0 ? (
        <p className="text-[12.5px] italic text-[#D4CBC0]">No data yet — add the first row below.</p>
      ) : (
        <div>
          {sorted.map((item) => (
            <ClickRow
              key={item.label}
              item={item}
              isMax={item.count === max}
              maxCount={max}
              onUpdateCount={(c) => updateCount(item.label, c)}
              onDelete={() => deleteItem(item.label)}
            />
          ))}
        </div>
      )}
      <AddRow onAdd={addItem} />
    </div>
  )
}

export function G2ClickBreakdown({ weekStart }: { weekStart: string }) {
  return (
    <div className={cn('row-2')}>
      <ClickPanel title="Clicks by Topic" weekStart={weekStart} listKey="topics" />
      <ClickPanel title="Clicks by Competitor" weekStart={weekStart} listKey="competitors" />
    </div>
  )
}
