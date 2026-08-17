'use client'

import { useState, useCallback, useEffect } from 'react'
import { useWeeklyMetrics } from '@/hooks/useWeeklyMetrics'
import { useAuth } from '@/lib/auth-context'
import { getDb } from '@/lib/firebase'
import { deleteDoc, doc } from 'firebase/firestore'

const RATING_KEY = 'domain_rating'

function ratingColor(n: number): { bg: string; text: string; bar: string } {
  if (n <= 3) return { bg: 'rgba(220,38,38,.06)', text: '#DC2626', bar: '#DC2626' }
  if (n <= 5) return { bg: 'rgba(217,119,6,.06)', text: '#D97706', bar: '#D97706' }
  if (n <= 7) return { bg: 'rgba(37,99,235,.06)', text: '#2563EB', bar: '#2563EB' }
  return { bg: 'rgba(22,163,74,.06)', text: '#16A34A', bar: '#16A34A' }
}

function ratingLabel(n: number): string {
  if (n <= 2) return 'Critical'
  if (n <= 4) return 'Needs Work'
  if (n <= 6) return 'On Track'
  if (n <= 8) return 'Good'
  return 'Excellent'
}

type Props = {
  sectionKey: string
  weekStart: string
  sectionLabel?: string
}

export function DomainRatingSlider({ sectionKey, weekStart, sectionLabel }: Props) {
  const { data, saveMetric } = useWeeklyMetrics(sectionKey, weekStart)
  const { user } = useAuth()

  const saved = parseInt(data[RATING_KEY]?.value || '0', 10)
  const [draft, setDraft] = useState<number>(saved || 0)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)

  // Sync when Firestore data loads
  useEffect(() => {
    if (saved > 0) setDraft(saved)
  }, [saved])

  const handleChange = (val: number) => {
    setDraft(val)
  }

  const handleCommit = useCallback(async (val: number) => {
    if (val === saved) return
    setSaving(true)
    try {
      await saveMetric(RATING_KEY, String(val), '', user?.email || 'anonymous')
    } finally {
      setSaving(false)
    }
  }, [saved, saveMetric, user])

  const handleReset = useCallback(async () => {
    setResetting(true)
    try {
      const db = getDb()
      await deleteDoc(doc(db, 'weekly_metrics', weekStart, 'sections', sectionKey, 'entries', RATING_KEY))
      setDraft(0)
    } finally {
      setResetting(false)
    }
  }, [sectionKey, weekStart])

  const colors = draft > 0 ? ratingColor(draft) : { bg: 'rgba(107,76,76,.04)', text: '#7A6A60', bar: '#D4CBC0' }
  const pct = ((draft - 1) / 9) * 100

  return (
    <div
      className="rounded-[20px] border border-[#D4CBC0] p-5 transition-colors"
      style={{ background: draft > 0 ? colors.bg : 'white' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="eyebrow">Manager Rating</p>
          {sectionLabel && (
            <p className="text-[12px] text-[#7A6A60] mt-0.5">{sectionLabel}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {draft > 0 && (
            <span
              className="text-[11px] font-[600] px-2 py-0.5 rounded-full"
              style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.text}30` }}
            >
              {ratingLabel(draft)}
            </span>
          )}
          <span
            className="font-['Playfair_Display'] font-[500] text-[2rem] leading-none tabular-nums"
            style={{ color: draft > 0 ? colors.text : '#D4CBC0' }}
          >
            {draft > 0 ? draft : '—'}
          </span>
          <span className="text-[14px] text-[#7A6A60]">/10</span>
        </div>
      </div>

      {/* Slider */}
      <div className="relative mt-2">
        {/* Track background */}
        <div className="h-[6px] rounded-full bg-[#D4CBC0]/50 relative overflow-hidden">
          {/* Filled portion */}
          {draft > 0 && (
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all duration-150"
              style={{ width: `${pct}%`, background: colors.bar }}
            />
          )}
        </div>
        <input
          type="range"
          min={1}
          max={10}
          step={1}
          value={draft || 1}
          onChange={e => handleChange(parseInt(e.target.value))}
          onMouseUp={e => handleCommit(parseInt((e.target as HTMLInputElement).value))}
          onTouchEnd={e => handleCommit(parseInt((e.target as HTMLInputElement).value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-[6px]"
          style={{ margin: 0 }}
        />
        {/* Thumb indicator */}
        {draft > 0 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 w-[18px] h-[18px] rounded-full border-2 border-white shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-all duration-150 pointer-events-none"
            style={{
              left: `calc(${pct}% - 9px)`,
              background: colors.bar,
            }}
          />
        )}
      </div>

      {/* Scale labels */}
      <div className="flex justify-between mt-3 px-0.5">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
          <button
            key={n}
            onClick={() => { handleChange(n); handleCommit(n) }}
            className="text-[10px] font-[500] w-[18px] text-center transition-colors rounded"
            style={{
              color: draft === n ? colors.text : '#D4CBC0',
              fontWeight: draft === n ? 700 : 500,
            }}
          >
            {n}
          </button>
        ))}
      </div>

      {saving && (
        <p className="text-[11px] text-[#7A6A60] mt-2 text-right">Saving…</p>
      )}
      {!saving && data[RATING_KEY]?.updatedBy && (
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={handleReset}
            disabled={resetting}
            className="text-[11px] text-[#D4CBC0] hover:text-[#DC2626] transition-colors disabled:opacity-50"
          >
            {resetting ? 'Resetting…' : 'Reset rating'}
          </button>
          <p className="text-[11px] text-[#D4CBC0]">
            by {data[RATING_KEY].updatedBy.split('@')[0]}
          </p>
        </div>
      )}
    </div>
  )
}
