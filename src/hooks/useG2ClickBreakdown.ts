'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { doc, onSnapshot, setDoc, serverTimestamp, type Unsubscribe } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'

export type ClickItem = { label: string; count: number }
export type ClickList = { items: ClickItem[]; updatedBy?: string; updatedAt?: string | null }

/**
 * One ranked {label, count} list (e.g. "Clicks by Topic" or "Clicks by Competitor") per
 * week/listKey — manual for now (typed in from a G2 export), same weekly-doc convention as
 * useWeeklyMetrics, just a list shape instead of a flat metric. Firestore:
 * g2_click_breakdown/{weekStart}/lists/{listKey}.
 */
export function useG2ClickList(weekStart: string, listKey: string) {
  const [data, setData] = useState<ClickList>({ items: [] })
  const [loading, setLoading] = useState(true)
  const unsubRef = useRef<Unsubscribe | null>(null)

  useEffect(() => {
    if (!weekStart || !listKey) return
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null }
    setLoading(true)
    const db = getDb()
    const ref = doc(db, 'g2_click_breakdown', weekStart, 'lists', listKey)
    unsubRef.current = onSnapshot(
      ref,
      (snap) => {
        setData(snap.exists() ? (snap.data() as ClickList) : { items: [] })
        setLoading(false)
      },
      (err) => {
        if (err.code !== 'permission-denied') console.warn(`g2 click list error [${listKey}]:`, err.code)
        setLoading(false)
      }
    )
    return () => { if (unsubRef.current) { unsubRef.current(); unsubRef.current = null } }
  }, [weekStart, listKey])

  const save = useCallback(
    async (items: ClickItem[], userEmail: string) => {
      const db = getDb()
      const ref = doc(db, 'g2_click_breakdown', weekStart, 'lists', listKey)
      await setDoc(ref, { items, updatedBy: userEmail, updatedAt: serverTimestamp() })
    },
    [weekStart, listKey]
  )

  return { items: data.items || [], loading, save }
}
