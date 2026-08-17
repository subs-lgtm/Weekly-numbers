'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase'
import { format, startOfWeek, subWeeks } from 'date-fns'

export type MetricEntry = {
  value: string
  notes: string
  updatedBy: string
  updatedAt: string | null
}

export type WeekMetrics = Record<string, MetricEntry>

export function weekKey(date: Date = new Date()): string {
  const monday = startOfWeek(date, { weekStartsOn: 1 })
  if (date.getDay() === 1) {
    return format(subWeeks(monday, 1), 'yyyy-MM-dd')
  }
  return format(monday, 'yyyy-MM-dd')
}

export function useWeeklyMetrics(sectionKey: string, weekStart: string) {
  const [data, setData] = useState<WeekMetrics>({})
  const [loading, setLoading] = useState(true)
  const unsubRef = useRef<Unsubscribe | null>(null)

  useEffect(() => {
    if (!sectionKey || !weekStart) return

    // Immediately tear down the old listener before creating a new one
    if (unsubRef.current) {
      unsubRef.current()
      unsubRef.current = null
    }

    setLoading(true)

    const db = getDb()
    const entriesCol = collection(
      db,
      'weekly_metrics',
      weekStart,
      'sections',
      sectionKey,
      'entries'
    )

    unsubRef.current = onSnapshot(
      entriesCol,
      (snap) => {
        const result: WeekMetrics = {}
        snap.forEach((d) => {
          result[d.id] = d.data() as MetricEntry
        })
        setData(result)
        setLoading(false)
      },
      (err) => {
        // Silently handle permission errors
        if (err.code !== 'permission-denied') {
          console.warn(`Firestore listener error [${sectionKey}/${weekStart}]:`, err.code)
        }
        setLoading(false)
      }
    )

    return () => {
      if (unsubRef.current) {
        unsubRef.current()
        unsubRef.current = null
      }
    }
  }, [sectionKey, weekStart])

  const saveMetric = useCallback(
    async (metricKey: string, value: string, notes: string, userEmail: string) => {
      const db = getDb()
      const ref = doc(
        db,
        'weekly_metrics',
        weekStart,
        'sections',
        sectionKey,
        'entries',
        metricKey
      )
      await setDoc(ref, {
        value,
        notes,
        updatedBy: userEmail,
        updatedAt: serverTimestamp(),
      })
    },
    [sectionKey, weekStart]
  )

  return { data, loading, saveMetric }
}

export function usePrevWeekMetrics(sectionKey: string, weekStart: string) {
  const [data, setData] = useState<WeekMetrics>({})

  useEffect(() => {
    if (!sectionKey || !weekStart) return
    const prevWeek = format(
      subWeeks(new Date(weekStart + 'T00:00:00'), 1),
      'yyyy-MM-dd'
    )
    const db = getDb()
    const entriesCol = collection(
      db,
      'weekly_metrics',
      prevWeek,
      'sections',
      sectionKey,
      'entries'
    )
    const unsub = onSnapshot(
      entriesCol,
      (snap) => {
        const result: WeekMetrics = {}
        snap.forEach((d) => {
          result[d.id] = d.data() as MetricEntry
        })
        setData(result)
        unsub()
      },
      (err) => {
        console.warn(`Firestore prev-week error [${sectionKey}]:`, err.code)
      }
    )
    return () => unsub()
  }, [sectionKey, weekStart])

  return data
}
