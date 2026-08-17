'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '@/lib/firebase'

export type DeletionRequest = {
  id: string
  sectionKey: string
  metricKey: string
  metricLabel: string
  requestedBy: string
  requestedAt: string | null
  status: 'pending' | 'approved' | 'rejected'
  approvedBy?: string
}

export function useDeleteRequests() {
  const [requests, setRequests] = useState<DeletionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const unsubRef = useRef<Unsubscribe | null>(null)

  useEffect(() => {
    const db = getDb()
    const q = query(
      collection(db, 'deletion_requests'),
      where('status', '==', 'pending')
    )

    unsubRef.current = onSnapshot(q, (snap) => {
      const result: DeletionRequest[] = []
      snap.forEach((d) => {
        result.push({ id: d.id, ...d.data() } as DeletionRequest)
      })
      setRequests(result)
      setLoading(false)
    })

    return () => {
      unsubRef.current?.()
    }
  }, [])

  const approve = useCallback(async (requestId: string, approverEmail: string) => {
    const db = getDb()
    const reqRef = doc(db, 'deletion_requests', requestId)

    // Find the request to get sectionKey and metricKey
    const req = requests.find((r) => r.id === requestId)
    if (!req) return

    // Update request status
    await updateDoc(reqRef, {
      status: 'approved',
      approvedBy: approverEmail,
    })

    // Delete the custom metric
    const metricRef = doc(db, 'custom_metrics', req.sectionKey, 'items', req.metricKey)
    await deleteDoc(metricRef)
  }, [requests])

  const reject = useCallback(async (requestId: string, approverEmail: string) => {
    const db = getDb()
    const reqRef = doc(db, 'deletion_requests', requestId)
    await updateDoc(reqRef, {
      status: 'rejected',
      approvedBy: approverEmail,
    })
  }, [])

  const createRequest = useCallback(
    async (sectionKey: string, metricKey: string, metricLabel: string, requestedBy: string) => {
      const db = getDb()
      const id = `${sectionKey}_${metricKey}_${Date.now()}`
      const ref = doc(db, 'deletion_requests', id)
      await setDoc(ref, {
        sectionKey,
        metricKey,
        metricLabel,
        requestedBy,
        requestedAt: serverTimestamp(),
        status: 'pending',
      })
    },
    []
  )

  return { requests, loading, approve, reject, createRequest }
}

/** Hook to check if a specific metric has a pending deletion request */
export function usePendingDeletions(sectionKey: string) {
  const [pendingKeys, setPendingKeys] = useState<Set<string>>(new Set())
  const unsubRef = useRef<Unsubscribe | null>(null)

  useEffect(() => {
    if (!sectionKey) return
    const db = getDb()
    const q = query(
      collection(db, 'deletion_requests'),
      where('sectionKey', '==', sectionKey),
      where('status', '==', 'pending')
    )

    unsubRef.current = onSnapshot(q, (snap) => {
      const keys = new Set<string>()
      snap.forEach((d) => {
        const data = d.data()
        keys.add(data.metricKey)
      })
      setPendingKeys(keys)
    })

    return () => {
      unsubRef.current?.()
    }
  }, [sectionKey])

  return pendingKeys
}
