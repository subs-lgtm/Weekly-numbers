"use client"

import { useCallback, useEffect, useState } from "react"
import { getFirebaseAuth } from "@/lib/firebase"
import type { ChannelScore, ScorecardRules } from "@/lib/scorecard-types"
import type { ScorecardChannel } from "@/lib/nav-channels"

export type ScorecardData = {
  scores: ChannelScore[]
  rules: ScorecardRules
  channels: ScorecardChannel[]
}

async function authedFetch(url: string, init: RequestInit = {}) {
  const token = await getFirebaseAuth().currentUser?.getIdToken()
  if (!token) throw new Error("Not signed in")
  const res = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`)
  return body
}

export function useScorecardData(month: string) {
  const [data, setData] = useState<ScorecardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/channel-scorecard?month=${month}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || "Failed to load scorecard")
      setData({ scores: body.scores, rules: body.rules, channels: body.channels })
    } catch (e: any) {
      setError(e.message || "Failed to load scorecard")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/channel-scorecard?month=${month}`)
      .then((r) => r.json().then((body) => ({ ok: r.ok, body })))
      .then(({ ok, body }) => {
        if (cancelled) return
        if (!ok) throw new Error(body.error || "Failed to load scorecard")
        setData({ scores: body.scores, rules: body.rules, channels: body.channels })
      })
      .catch((e) => { if (!cancelled) { setError(e.message || "Failed to load scorecard"); setData(null) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [month])

  const upsertScore = useCallback(
    async (params: { channel_id: string; month: string; week_number: number; score: number; reason: string }) => {
      const body = await authedFetch("/api/channel-scorecard/score", { method: "PUT", body: JSON.stringify(params) })
      await refetch()
      return body.score as ChannelScore
    },
    [refetch],
  )

  const clearScore = useCallback(
    async (params: { channel_id: string; month: string; week_number: number }) => {
      await authedFetch("/api/channel-scorecard/score", { method: "DELETE", body: JSON.stringify(params) })
      await refetch()
    },
    [refetch],
  )

  const updateRules = useCallback(
    async (patch: Partial<ScorecardRules>) => {
      const body = await authedFetch("/api/channel-scorecard/rules", { method: "PUT", body: JSON.stringify(patch) })
      await refetch()
      return body.rules as ScorecardRules
    },
    [refetch],
  )

  return { data, loading, error, refetch, upsertScore, clearScore, updateRules }
}
