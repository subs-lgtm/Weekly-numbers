'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  collection, doc, onSnapshot, addDoc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy, type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase'

export type EventStatus = 'upcoming' | 'completed' | 'cancelled'

export type MarketingEvent = {
  id: string
  name: string
  date: string          // yyyy-MM-dd
  location?: string
  status: EventStatus
  leads?: number
  meetings_booked?: number
  notes?: string
  owner?: string
  createdBy?: string
  createdAt?: string | null
}

export function useEvents() {
  const [events, setEvents] = useState<MarketingEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const db = getDb()
    const q = query(collection(db, 'marketing_events'), orderBy('date', 'asc'))

    const unsub: Unsubscribe = onSnapshot(q, (snap) => {
      const result: MarketingEvent[] = []
      snap.forEach((d) => {
        result.push({ id: d.id, ...d.data() } as MarketingEvent)
      })
      setEvents(result)
      setLoading(false)
    })

    return () => unsub()
  }, [])

  const addEvent = useCallback(async (event: Omit<MarketingEvent, 'id'>, userEmail: string) => {
    const db = getDb()
    await addDoc(collection(db, 'marketing_events'), {
      ...event,
      createdBy: userEmail,
      createdAt: serverTimestamp(),
    })
  }, [])

  const updateEvent = useCallback(async (id: string, updates: Partial<MarketingEvent>) => {
    const db = getDb()
    await updateDoc(doc(db, 'marketing_events', id), updates)
  }, [])

  const deleteEvent = useCallback(async (id: string) => {
    const db = getDb()
    await deleteDoc(doc(db, 'marketing_events', id))
  }, [])

  return { events, loading, addEvent, updateEvent, deleteEvent }
}
