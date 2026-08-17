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
import type { MetricDef } from '@/lib/metrics-config'

function slugify(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export function useCustomMetrics(sectionKey: string) {
  const [customMetrics, setCustomMetrics] = useState<MetricDef[]>([])
  const [labelOverrides, setLabelOverrides] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const unsubRef = useRef<Unsubscribe | null>(null)
  const unsubOverridesRef = useRef<Unsubscribe | null>(null)

  useEffect(() => {
    if (!sectionKey) return
    setLoading(true)

    const db = getDb()
    const itemsCol = collection(db, 'custom_metrics', sectionKey, 'items')

    unsubRef.current = onSnapshot(itemsCol, (snap) => {
      const result: MetricDef[] = []
      snap.forEach((d) => {
        const data = d.data()
        result.push({
          key: data.key ?? d.id,
          label: data.label,
          unit: data.unit ?? 'number',
        })
      })
      setCustomMetrics(result)
      setLoading(false)
    })

    // Listen for label overrides (static metric renames)
    const overridesCol = collection(db, 'label_overrides', sectionKey, 'items')
    unsubOverridesRef.current = onSnapshot(overridesCol, (snap) => {
      const result: Record<string, string> = {}
      snap.forEach((d) => {
        const data = d.data()
        if (data.label) result[d.id] = data.label
      })
      setLabelOverrides(result)
    })

    return () => {
      unsubRef.current?.()
      unsubOverridesRef.current?.()
    }
  }, [sectionKey])

  const addMetric = useCallback(
    async (label: string, unit: string, createdBy: string) => {
      const db = getDb()
      const key = slugify(label)
      const ref = doc(db, 'custom_metrics', sectionKey, 'items', key)
      await setDoc(ref, {
        key,
        label,
        unit,
        createdBy,
        createdAt: serverTimestamp(),
      })
    },
    [sectionKey]
  )

  // deleteMetric doesn't delete directly — it creates a deletion request (Feature 3)
  // This is a no-op here; the actual deletion request is handled by useDeleteRequests
  const deleteMetric = useCallback(
    async (_metricKey: string) => {
      // Handled by deletion request flow — see useDeleteRequests
    },
    []
  )

  const renameMetric = useCallback(
    async (metricKey: string, newLabel: string) => {
      const db = getDb()
      // For custom metrics, update the custom_metrics doc
      const customRef = doc(db, 'custom_metrics', sectionKey, 'items', metricKey)
      // For static metrics, store in label_overrides
      const overrideRef = doc(db, 'label_overrides', sectionKey, 'items', metricKey)
      // Try both — one will be a no-op
      await Promise.all([
        setDoc(customRef, { label: newLabel }, { merge: true }).catch(() => {}),
        setDoc(overrideRef, { label: newLabel }, { merge: true }),
      ])
    },
    [sectionKey]
  )

  return { customMetrics, labelOverrides, loading, addMetric, deleteMetric, renameMetric }
}
