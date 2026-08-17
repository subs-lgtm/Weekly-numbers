'use client'

import { useState, useRef, useCallback } from 'react'
import { useWeeklyMetrics, usePrevWeekMetrics } from '@/hooks/useWeeklyMetrics'
import { usePendingDeletions, useDeleteRequests } from '@/hooks/useDeleteRequests'
import { useAuth } from '@/lib/auth-context'
import type { MetricDef } from '@/lib/metrics-config'
import { format, subWeeks } from 'date-fns'
import { Check, Loader2, TrendingUp, TrendingDown, Minus, Trash2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type Props = {
  sectionKey: string
  metrics: MetricDef[]
  weekStart: string
  customMetrics?: MetricDef[]
  onAddMetric?: (label: string, unit: string) => Promise<void>
  onRenameMetric?: (metricKey: string, newLabel: string) => Promise<void>
}

function EditableLabel({ label, metricKey, isCustom, onRename }: { label: string; metricKey: string; isCustom: boolean; onRename?: (newLabel: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(label)

  // Sync with prop when not editing
  const prevLabel = useRef(label)
  if (label !== prevLabel.current && !editing) {
    setVal(label)
    prevLabel.current = label
  }

  if (!onRename) {
    return <span className="text-[14px] font-[500] text-[#2A1F1A] leading-snug">{label}</span>
  }

  if (!editing) {
    return (
      <span
        className="text-[14px] font-[500] text-[#2A1F1A] leading-snug cursor-pointer hover:underline hover:decoration-dotted hover:decoration-[#D4CBC0] hover:underline-offset-2"
        onDoubleClick={() => { setVal(label); setEditing(true) }}
        title="Double-click to rename"
      >
        {label}
      </span>
    )
  }

  return (
    <input
      type="text"
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={async () => {
        if (val.trim() && val.trim() !== label) {
          await onRename(val.trim())
        }
        setEditing(false)
      }}
      onKeyDown={async e => {
        if (e.key === 'Enter') {
          if (val.trim() && val.trim() !== label) await onRename(val.trim())
          setEditing(false)
        }
        if (e.key === 'Escape') { setVal(label); setEditing(false) }
      }}
      autoFocus
      className="text-[14px] font-[500] text-[#2A1F1A] bg-white border border-[#6B4C4C] rounded-[6px] px-2 py-0.5 outline-none ring-1 ring-[rgba(107,76,76,.15)] w-[180px]"
    />
  )
}

function formatDisplay(value: string, unit?: MetricDef['unit']): string {
  if (!value && value !== '0') return '—'
  if (unit === 'currency') {
    const n = parseFloat(value)
    if (isNaN(n)) return value
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`
    return `$${n.toLocaleString()}`
  }
  if (unit === 'percent') return `${value}%`
  if (unit === 'number') {
    const n = parseFloat(value)
    if (isNaN(n)) return value
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
    return n.toLocaleString()
  }
  return value
}

function Delta({ current, prev, unit }: { current: string; prev: string; unit?: MetricDef['unit'] }) {
  if (!current || !prev || unit === 'text') return null
  const c = parseFloat(current)
  const p = parseFloat(prev)
  if (isNaN(c) || isNaN(p) || p === 0) return null
  const pct = Math.round(((c - p) / p) * 100)
  if (pct === 0) return (
    <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold delta-flat">
      <Minus className="h-2.5 w-2.5" />0%
    </span>
  )
  if (pct > 0) return (
    <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold delta-up">
      <TrendingUp className="h-2.5 w-2.5" />+{pct}%
    </span>
  )
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold delta-down">
      <TrendingDown className="h-2.5 w-2.5" />{pct}%
    </span>
  )
}


type CellProps = {
  metricKey: string
  metric: MetricDef
  value: string
  notes: string
  prevValue: string
  onSave: (key: string, value: string, notes: string) => Promise<void>
  updatedBy?: string
  isCustom?: boolean
  isPendingDeletion?: boolean
  onDelete?: () => void
  onRename?: (newLabel: string) => Promise<void>
}

function MetricRow({ metricKey, metric, value, notes, prevValue, onSave, updatedBy, isCustom, isPendingDeletion, onDelete, onRename }: CellProps) {
  // Show input by default when no value exists — makes it obvious where to type
  const isEmpty = !value && value !== '0'
  const [editing, setEditing] = useState(isEmpty)
  const [localVal, setLocalVal] = useState(value)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = () => {
    setLocalVal(value)
    setEditing(true)
    setSaved(false)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const commit = useCallback(async () => {
    if (localVal === value) {
      if (!localVal && localVal !== '0') return
      setEditing(false)
      return
    }
    setSaving(true)
    await onSave(metricKey, localVal, '')
    setSaving(false)
    setSaved(true)
    if (localVal || localVal === '0') setEditing(false)
    setTimeout(() => setSaved(false), 2500)
  }, [localVal, value, metricKey, onSave])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void commit()
    if (e.key === 'Escape') setEditing(false)
  }

  const hasValue = value !== '' && value !== undefined

  return (
    <tr className="group/row border-b border-[#D4CBC0]/50 last:border-0 hover:bg-[#F9F5F1]/60 transition-colors duration-150">
      {/* Metric label — double-click to edit */}
      <td className="py-3 px-5 w-[220px]">
        <div className="flex items-center gap-2">
          <EditableLabel
            label={metric.label}
            metricKey={metricKey}
            isCustom={!!isCustom}
            onRename={onRename}
          />
          {isPendingDeletion && (
            <span className="bg-[rgba(217,119,6,.10)] text-[#D97706] rounded-[9999px] text-[10px] font-[700] uppercase tracking-[0.16em] px-2 py-0.5">
              Pending deletion
            </span>
          )}
          {isCustom && onDelete && (
            <button
              onClick={onDelete}
              className="opacity-0 group-hover/row:opacity-100 transition-opacity ml-auto text-[#7A6A60] hover:text-[#DC2626]"
              title="Request deletion"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </td>

      {/* Previous week */}
      <td className="py-3 px-4 w-[120px] text-right">
        <span className="text-[13px] text-[#7A6A60] tabular-nums">
          {formatDisplay(prevValue, metric.unit)}
        </span>
      </td>

      {/* Current week — inline editable */}
      <td className="py-3 px-4 w-[160px]">
        {editing ? (
          <input
            ref={inputRef}
            type={metric.unit === 'text' ? 'text' : 'number'}
            value={localVal}
            onChange={e => setLocalVal(e.target.value)}
            onBlur={() => void commit()}
            onKeyDown={handleKeyDown}
            className={cn(
              'w-full rounded-[8px] border border-[#6B4C4C] bg-white px-3 py-1.5',
              'text-[14px] font-[600] text-right text-[#2A1F1A] tabular-nums',
              'outline-none ring-2 ring-[rgba(107,76,76,.15)]',
              'placeholder:text-[#D4CBC0]'
            )}
            placeholder={metric.unit === 'text' ? 'Type…' : '0'}
          />
        ) : (
          <button
            onClick={startEdit}
            className={cn(
              'w-full flex items-center justify-end gap-1.5 rounded-[8px] px-3 py-1.5 cursor-pointer',
              'text-[14px] tabular-nums transition-all duration-150',
              'hover:bg-[#F2EDE8] hover:ring-1 hover:ring-[#D4CBC0]',
              hasValue ? 'font-[600] text-[#2A1F1A]' : 'font-[400] text-[#7A6A60]'
            )}
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#6B4C4C]" />
            ) : saved ? (
              <>
                <Check className="h-3.5 w-3.5 text-[#16A34A]" />
                <span className="text-[#16A34A]">{formatDisplay(value, metric.unit)}</span>
              </>
            ) : (
              hasValue ? formatDisplay(value, metric.unit) : 'Enter value'
            )}
          </button>
        )}
      </td>

      {/* WoW delta */}
      <td className="py-3 px-4 w-[90px] text-right">
        <Delta current={value} prev={prevValue} unit={metric.unit} />
      </td>

      {/* Updated by */}
      <td className="py-3 px-4 hidden lg:table-cell w-[100px]">
        {updatedBy && (
          <span className="caption truncate">{updatedBy.split('@')[0]}</span>
        )}
      </td>
    </tr>
  )
}


function AddMetricRow({ onAdd }: { onAdd: (label: string, unit: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [unit, setUnit] = useState<string>('number')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!label.trim()) return
    setSaving(true)
    await onAdd(label.trim(), unit)
    setSaving(false)
    setLabel('')
    setUnit('number')
    setOpen(false)
  }

  if (!open) {
    return (
      <tr>
        <td colSpan={5} className="py-3 px-5">
          <button
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 bg-[#6B4C4C] text-[#F9F5F1] rounded-[9999px] px-4 py-1.5 text-[13px] font-[500] hover:opacity-90 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Metric
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-[#D4CBC0]/50 bg-[#F9F5F1]/40">
      <td className="py-3 px-5">
        <input
          type="text"
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void handleSave(); if (e.key === 'Escape') setOpen(false) }}
          placeholder="Metric name…"
          autoFocus
          className={cn(
            'w-full rounded-[8px] border border-[#D4CBC0] bg-white px-3 py-1.5',
            'text-[14px] text-[#2A1F1A] outline-none',
            'focus:border-[#6B4C4C] focus:ring-1 focus:ring-[rgba(107,76,76,.15)]'
          )}
        />
      </td>
      <td className="py-3 px-4" colSpan={2}>
        <select
          value={unit}
          onChange={e => setUnit(e.target.value)}
          className={cn(
            'rounded-[8px] border border-[#D4CBC0] bg-white px-3 py-1.5',
            'text-[13px] text-[#2A1F1A] outline-none',
            'focus:border-[#6B4C4C] focus:ring-1 focus:ring-[rgba(107,76,76,.15)]'
          )}
        >
          <option value="number">Number</option>
          <option value="currency">Currency</option>
          <option value="percent">Percent</option>
          <option value="text">Text</option>
        </select>
      </td>
      <td className="py-3 px-4" colSpan={2}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleSave()}
            disabled={saving || !label.trim()}
            className="inline-flex items-center gap-1.5 bg-[#6B4C4C] text-[#F9F5F1] rounded-[9999px] px-4 py-1.5 text-[13px] font-[500] hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Save
          </button>
          <button
            onClick={() => { setOpen(false); setLabel(''); setUnit('number') }}
            className="bg-transparent border border-[#D4CBC0] text-[#6B4C4C] rounded-[9999px] px-4 py-1.5 text-[13px] font-[500] hover:bg-[#F2EDE8] transition-colors"
          >
            Cancel
          </button>
        </div>
      </td>
    </tr>
  )
}

function ConfirmDeleteDialog({
  metricLabel,
  onConfirm,
  onCancel,
}: {
  metricLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-6 shadow-[0_8px_32px_rgba(40,20,10,.10)] max-w-sm w-full mx-4">
        <h3 className="text-[16px] font-[600] text-[#2A1F1A] mb-2">Delete metric?</h3>
        <p className="text-[13px] text-[#7A6A60] mb-5">
          This will send a deletion request for <span className="font-[600] text-[#2A1F1A]">{metricLabel}</span> to admins for approval.
        </p>
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={onCancel}
            className="bg-transparent border border-[#D4CBC0] text-[#6B4C4C] rounded-[9999px] px-4 py-1.5 text-[13px] font-[500] hover:bg-[#F2EDE8] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="bg-[#DC2626] text-white rounded-[9999px] px-4 py-1.5 text-[13px] font-[500] hover:opacity-90 transition-opacity"
          >
            Request Deletion
          </button>
        </div>
      </div>
    </div>
  )
}


export function InlineMetricTable({ sectionKey, metrics, weekStart, customMetrics = [], onAddMetric, onRenameMetric }: Props) {
  const { user } = useAuth()
  const { data, loading, saveMetric } = useWeeklyMetrics(sectionKey, weekStart)
  const prevData = usePrevWeekMetrics(sectionKey, weekStart)
  const pendingKeys = usePendingDeletions(sectionKey)
  const { createRequest } = useDeleteRequests()
  const [deleteTarget, setDeleteTarget] = useState<MetricDef | null>(null)

  const prevWeekLabel = format(subWeeks(new Date(weekStart + 'T00:00:00'), 1), 'MMM d')
  const currWeekLabel = format(new Date(weekStart + 'T00:00:00'), 'MMM d')

  // Build set of custom metric keys for identification — filter out duplicates of static keys
  const staticKeySet = new Set(metrics.map(m => m.key))
  const dedupedCustom = customMetrics.filter(m => !staticKeySet.has(m.key))
  const customKeySet = new Set(dedupedCustom.map(m => m.key))
  const allMetrics = [...metrics, ...dedupedCustom]

  const handleSave = useCallback(
    async (metricKey: string, value: string, notes: string) => {
      await saveMetric(metricKey, value, notes, user?.email ?? 'unknown')
    },
    [saveMetric, user]
  )

  const handleDeleteRequest = async () => {
    if (!deleteTarget || !user?.email) return
    await createRequest(sectionKey, deleteTarget.key, deleteTarget.label, user.email)
    toast.success('Deletion request sent for approval')
    setDeleteTarget(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-2 text-[#7A6A60]">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-[13px]">Loading metrics…</span>
      </div>
    )
  }

  return (
    <>
      {deleteTarget && (
        <ConfirmDeleteDialog
          metricLabel={deleteTarget.label}
          onConfirm={() => void handleDeleteRequest()}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      <div className="rounded-[20px] border border-[#D4CBC0] overflow-hidden bg-white shadow-[0_4px_20px_rgba(40,20,10,.07)]">
        <table className="w-full">
          <thead>
            <tr className="bg-[#F9F5F1] border-b border-[#D4CBC0]">
              <th className="py-3 px-5 text-left">
                <span className="eyebrow">Metric</span>
              </th>
              <th className="py-3 px-4 text-right">
                <span className="eyebrow">Prev ({prevWeekLabel})</span>
              </th>
              <th className="py-3 px-4 text-right">
                <span className="eyebrow">This Week ({currWeekLabel})</span>
              </th>
              <th className="py-3 px-4 text-right">
                <span className="eyebrow">WoW</span>
              </th>
              <th className="py-3 px-4 text-left hidden lg:table-cell">
                <span className="eyebrow">By</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {allMetrics.map((m) => (
              <MetricRow
                key={m.key}
                metricKey={m.key}
                metric={m}
                value={data[m.key]?.value ?? ''}
                notes={data[m.key]?.notes ?? ''}
                prevValue={prevData[m.key]?.value ?? ''}
                onSave={handleSave}
                updatedBy={data[m.key]?.updatedBy}
                isCustom={customKeySet.has(m.key)}
                isPendingDeletion={pendingKeys.has(m.key)}
                onDelete={customKeySet.has(m.key) ? () => setDeleteTarget(m) : undefined}
                onRename={onRenameMetric ? async (newLabel: string) => { await onRenameMetric(m.key, newLabel) } : undefined}
              />
            ))}
            {onAddMetric && <AddMetricRow onAdd={onAddMetric} />}
          </tbody>
        </table>
        <div className="px-5 py-2.5 bg-[#F9F5F1] border-t border-[#D4CBC0]">
          <p className="caption">
            Click any value or note to edit inline · saves automatically · syncs in real-time for all team members
          </p>
        </div>
      </div>
    </>
  )
}