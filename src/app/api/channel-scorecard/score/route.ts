import { NextRequest, NextResponse } from "next/server"
import { getAdminDb, getSessionUser } from "@/lib/scorecard-admin"
import { getScorecardChannels } from "@/lib/nav-channels"
import { getMonthWeeks, getWeekStatus, parseMonthKey } from "@/lib/scorecard-weeks"
import {
  DEFAULT_RULES, isReasonRequired, scoreDocId,
  type ScorecardRules, type ChannelScore, type HistoryEntry,
} from "@/lib/scorecard-types"

/**
 * PUT /api/channel-scorecard/score — upsert one score.
 * DELETE /api/channel-scorecard/score — clear one score.
 *
 * Both require a valid Firebase session (Authorization: Bearer <idToken>) — `scored_by`/
 * `changed_by` always comes from the verified token, never from the request body, even if the
 * body includes a name/email field (any such field is ignored).
 */

async function loadRules(db: any): Promise<ScorecardRules> {
  const doc = await db.collection("scorecard_config").doc("rules").get()
  return doc.exists ? { ...DEFAULT_RULES, ...doc.data() } : DEFAULT_RULES
}

function validateChannelAndWeek(channelId: string, month: string, weekNumber: number): string | null {
  if (!getScorecardChannels().some((c) => c.id === channelId)) return "unknown channel"
  if (!/^\d{4}-\d{2}$/.test(month)) return "month must be YYYY-MM"
  if (![1, 2, 3, 4].includes(weekNumber)) return "week_number must be 1-4"
  const { year, month: m } = parseMonthKey(month)
  const weeks = getMonthWeeks(year, m)
  const week = weeks.find((w) => w.weekNumber === weekNumber)!
  if (getWeekStatus(week) === "locked") return "cannot score a week that hasn't started yet"
  return null
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const { channel_id, month, week_number, score, reason } = body as {
      channel_id?: string; month?: string; week_number?: number; score?: number; reason?: string
    }

    if (!channel_id || !month || !week_number) {
      return NextResponse.json({ error: "channel_id, month, week_number are required" }, { status: 400 })
    }
    const structuralError = validateChannelAndWeek(channel_id, month, week_number)
    if (structuralError) return NextResponse.json({ error: structuralError }, { status: 400 })

    if (typeof score !== "number" || !Number.isInteger(score) || score < 1 || score > 10) {
      return NextResponse.json({ error: "score must be an integer 1-10" }, { status: 400 })
    }

    const db = getAdminDb()
    const rules = await loadRules(db)
    const reasonText = (reason || "").trim()
    if (isReasonRequired(score, rules) && reasonText.length < rules.min_reason_length) {
      return NextResponse.json(
        { error: `reason is required for scores below ${rules.reason_required_below} and must be at least ${rules.min_reason_length} characters` },
        { status: 400 },
      )
    }

    const docId = scoreDocId(channel_id, month, week_number)
    const docRef = db.collection("channel_scores").doc(docId)
    const existingSnap = await docRef.get()
    const existing: ChannelScore | null = existingSnap.exists ? existingSnap.data() : null

    const now = new Date().toISOString()
    const next: ChannelScore = {
      channel_id, month, week_number: week_number as 1 | 2 | 3 | 4,
      score, reason: reasonText, scored_by: user.email,
      created_at: existing?.created_at || now,
      updated_at: now,
    }
    await docRef.set(next)

    const historyEntry: HistoryEntry = {
      action: existing ? "edit" : "create",
      channel_id, month, week_number: week_number as 1 | 2 | 3 | 4,
      old_value: existing ? { score: existing.score, reason: existing.reason } : null,
      new_value: { score, reason: reasonText },
      changed_by: user.email,
      changed_at: now,
    }
    await db.collection("channel_scores_history").add(historyEntry)

    return NextResponse.json({ score: next })
  } catch (err: any) {
    console.error("[channel-scorecard/score] PUT error:", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const { channel_id, month, week_number } = body as { channel_id?: string; month?: string; week_number?: number }
    if (!channel_id || !month || !week_number) {
      return NextResponse.json({ error: "channel_id, month, week_number are required" }, { status: 400 })
    }
    const structuralError = validateChannelAndWeek(channel_id, month, week_number)
    if (structuralError) return NextResponse.json({ error: structuralError }, { status: 400 })

    const db = getAdminDb()
    const docId = scoreDocId(channel_id, month, week_number)
    const docRef = db.collection("channel_scores").doc(docId)
    const existingSnap = await docRef.get()
    if (!existingSnap.exists) {
      return NextResponse.json({ error: "no score to clear" }, { status: 404 })
    }
    const existing: ChannelScore = existingSnap.data()
    await docRef.delete()

    const now = new Date().toISOString()
    const historyEntry: HistoryEntry = {
      action: "clear",
      channel_id, month, week_number: week_number as 1 | 2 | 3 | 4,
      old_value: { score: existing.score, reason: existing.reason },
      new_value: null,
      changed_by: user.email,
      changed_at: now,
    }
    await db.collection("channel_scores_history").add(historyEntry)

    return NextResponse.json({ cleared: true })
  } catch (err: any) {
    console.error("[channel-scorecard/score] DELETE error:", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
