'use client'

import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'

export type IntentJourney = { organization: string; country: string; from: string; to: string; timeBetween: string }
export type NamedCount = { name: string; count: number }
export type BuyerIntent = {
  signalsLast7Days: number
  totalSignalsAllTime: number
  startedFromG2Count: number
  startedFromSiteCount: number
  topOrganizations: NamedCount[]
  topCountries: NamedCount[]
  recentHighIntent: IntentJourney[]
  source?: string
  snapshotAt?: string
}

/** Read-only weekly buyer-intent snapshot. Firestore: g2_buyer_intent/{weekStart}. */
export function useG2BuyerIntent(weekStart: string) {
  const [data, setData] = useState<BuyerIntent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!weekStart) return
    setLoading(true)
    const unsub = onSnapshot(
      doc(getDb(), 'g2_buyer_intent', weekStart),
      (snap) => { setData(snap.exists() ? (snap.data() as BuyerIntent) : null); setLoading(false) },
      (err) => {
        if (err.code !== 'permission-denied') console.warn('g2 buyer intent error:', err.code)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [weekStart])

  return { data, loading }
}
