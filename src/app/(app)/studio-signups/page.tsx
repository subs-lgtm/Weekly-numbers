'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { SectionShell } from '@/components/SectionShell'
import { LoadingScreen } from '@/components/LoadingScreen'
import { useWeeklyMetrics } from '@/hooks/useWeeklyMetrics'
import { useAuth } from '@/lib/auth-context'
import { useWeek } from '@/lib/week-context'
import { getDb } from '@/lib/firebase'
import {
  collection, onSnapshot, doc, setDoc, serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { format, startOfWeek, addWeeks, parseISO, isBefore, isAfter, addDays } from 'date-fns'
import { Users, Target, TrendingUp, Loader2 } from 'lucide-react'

/**
 * Editable score card — click to edit, Enter to save.
 */
function EditableCard({
  label,
  icon,
  value,
  subtitle,
  onSave,
  readOnly,
}: {
  label: string
  icon: React.ReactNode
  value: string
  subtitle?: string
  onSave: (val: string) => void
  readOnly?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const startEdit = () => {
    if (readOnly) return
    setEditing(true)
    setDraft(value || '')
  }

  const commitEdit = () => {
    if (draft !== value) {
      onSave(draft)
    }
    setEditing(false)
  }

  return (
    <div className="rounded-[20px] border border-[#D4CBC0] bg-white p-5 shadow-[0_4px_20px_rgba(40,20,10,.07)]">
      <div className="mb-2">{icon}</div>
      <p className="eyebrow mb-1">{label}</p>
      {editing ? (
        <input
          autoFocus
          type="text"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false) }}
          className="w-28 text-[1.75rem] font-['Playfair_Display'] font-[500] text-[#2A1F1A] bg-white border border-[#6B4C4C] rounded-[8px] px-2 py-0.5 outline-none"
        />
      ) : (
        <p
          onClick={startEdit}
          className={`font-['Playfair_Display'] font-[500] text-[1.75rem] text-[#2A1F1A] inline-block min-w-[40px] ${!readOnly ? 'cursor-pointer hover:bg-[#F9F5F1] hover:rounded-[8px] transition-colors' : ''}`}
          title={readOnly ? undefined : 'Click to edit'}
        >
          {value ? Number(value).toLocaleString() : '—'}
        </p>
      )}
      {subtitle && <p className="text-[12px] text-[#7A6A60] mt-1">{subtitle}</p>}
    </div>
  )
}

/**
 * Hook to aggregate metrics across a date range from Firestore.
 * For week mode: reads single week doc.
 * For month/custom: reads all weeks that overlap the range and sums values.
 */
function useRangeStudioMetrics() {
  const { weekStart, queryStart, queryEnd, range } = useWeek()
  const [data, setData] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  // Compute all week keys that overlap the range
  const weekKeys = useMemo(() => {
    if (range.mode === 'week') return [weekStart]

    const keys: string[] = []
    const start = parseISO(queryStart)
    const end = parseISO(queryEnd)
    // Walk from the Monday on or before queryStart
    let cursor = startOfWeek(start, { weekStartsOn: 1 })
    while (isBefore(cursor, end)) {
      keys.push(format(cursor, 'yyyy-MM-dd'))
      cursor = addWeeks(cursor, 1)
    }
    return keys.length > 0 ? keys : [weekStart]
  }, [weekStart, queryStart, queryEnd, range.mode])

  useEffect(() => {
    setLoading(true)
    setData({})

    const db = getDb()
    const unsubs: Unsubscribe[] = []
    const weekData: Record<string, Record<string, string>> = {}
    let loaded = 0

    for (const wk of weekKeys) {
      const col = collection(db, 'weekly_metrics', wk, 'sections', 'studio-signups', 'entries')
      unsubs.push(onSnapshot(col, snap => {
        const result: Record<string, string> = {}
        snap.forEach(d => { result[d.id] = d.data().value ?? '' })
        weekData[wk] = result
        loaded++

        // Once all weeks loaded, aggregate
        if (loaded >= weekKeys.length) {
          if (weekKeys.length === 1) {
            setData(weekData[weekKeys[0]] || {})
          } else {
            // For multi-week ranges: sum numeric values, take latest for cumulative
            const aggregated: Record<string, string> = {}
            const numericKeys = ['signups_last_week']
            const latestKeys = ['total_users', 'current_goal']

            for (const key of numericKeys) {
              let sum = 0
              for (const wk of weekKeys) {
                const v = parseFloat(weekData[wk]?.[key] || '')
                if (!isNaN(v)) sum += v
              }
              if (sum > 0) aggregated[key] = String(sum)
            }

            // For cumulative/goal, take the latest week that has data
            for (const key of latestKeys) {
              for (let i = weekKeys.length - 1; i >= 0; i--) {
                const v = weekData[weekKeys[i]]?.[key]
                if (v) { aggregated[key] = v; break }
              }
            }

            setData(aggregated)
          }
          setLoading(false)
        }
      }))
    }

    return () => unsubs.forEach(u => u())
  }, [weekKeys])

  return { data, loading, weekKeys }
}

export default function Page() {
  const { weekStart, range, queryStart, queryEnd } = useWeek()
  const { user } = useAuth()
  const { data: weekData, saveMetric } = useWeeklyMetrics('studio-signups', weekStart)
  const { data: rangeData, loading } = useRangeStudioMetrics()

  // In week mode, use direct Firestore data (editable).
  // In month/custom mode, show aggregated data (read-only for signups, editable for cumulative on anchor week).
  const isWeekMode = range.mode === 'week'

  const handleSave = useCallback((key: string, value: string) => {
    saveMetric(key, value, '', user?.email || 'anonymous')
  }, [saveMetric, user])

  if (loading) return <LoadingScreen />

  // Display values
  const signups = isWeekMode ? (weekData['signups_last_week']?.value || '') : (rangeData['signups_last_week'] || '')
  const totalUsers = isWeekMode ? (weekData['total_users']?.value || '') : (rangeData['total_users'] || '')
  const currentGoal = isWeekMode ? (weekData['current_goal']?.value || '') : (rangeData['current_goal'] || '')

  const signupsLabel = isWeekMode ? 'Signups This Week' : range.mode === 'month' ? 'Signups This Month' : 'Signups (Range)'
  const signupsSubtitle = isWeekMode
    ? `Week of ${format(parseISO(weekStart), 'MMM d')}`
    : range.label

  return (
    <SectionShell title="Agent Studio Users" description="Signup tracking — editable per week">
      <div className="space-y-6">
        {/* Editable score cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <EditableCard
            label="Total Users (Cumulative)"
            icon={<Users className="h-4 w-4 text-[#6B4C4C]" />}
            value={totalUsers}
            subtitle="As of latest"
            onSave={val => handleSave('total_users', val)}
            readOnly={!isWeekMode}
          />
          <EditableCard
            label="Current Goal"
            icon={<Target className="h-4 w-4 text-[#C96A5A]" />}
            value={currentGoal}
            subtitle="Target"
            onSave={val => handleSave('current_goal', val)}
            readOnly={!isWeekMode}
          />
          <EditableCard
            label={signupsLabel}
            icon={<TrendingUp className="h-4 w-4 text-[#16A34A]" />}
            value={signups}
            subtitle={signupsSubtitle}
            onSave={val => handleSave('signups_last_week', val)}
            readOnly={!isWeekMode}
          />
        </div>

        {/* Read-only hint for non-week modes */}
        {!isWeekMode && (
          <p className="caption px-1">
            Showing aggregated data across {range.label}. Switch to a single week to edit values.
          </p>
        )}

        {/* Week mode hint */}
        {isWeekMode && (
          <p className="caption px-1">
            Click any number to edit · values are saved per week · &quot;Signups This Week&quot; feeds the Summary card
          </p>
        )}
      </div>
    </SectionShell>
  )
}
