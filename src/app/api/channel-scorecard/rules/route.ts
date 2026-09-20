import { NextRequest, NextResponse } from "next/server"
import { getAdminDb, getSessionUser } from "@/lib/scorecard-admin"
import { DEFAULT_RULES, validateRules, type ScorecardRules } from "@/lib/scorecard-types"

/** PUT /api/channel-scorecard/rules — update the color-band config. Auth-gated like /score. */
export async function PUT(req: NextRequest) {
  const user = await getSessionUser(req)
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  try {
    const body = await req.json()
    const patch: Partial<ScorecardRules> = {
      green_from: body.green_from,
      red_below: body.red_below,
      reason_required_below: body.reason_required_below,
      min_reason_length: body.min_reason_length,
    }
    const check = validateRules(patch)
    if (!check.valid) return NextResponse.json({ error: check.error }, { status: 400 })

    const db = getAdminDb()
    const docRef = db.collection("scorecard_config").doc("rules")
    const existingSnap = await docRef.get()
    const existing: ScorecardRules = existingSnap.exists ? { ...DEFAULT_RULES, ...existingSnap.data() } : DEFAULT_RULES

    const next: ScorecardRules = {
      green_from: patch.green_from ?? existing.green_from,
      red_below: patch.red_below ?? existing.red_below,
      reason_required_below: patch.reason_required_below ?? existing.reason_required_below,
      min_reason_length: patch.min_reason_length ?? existing.min_reason_length,
    }
    // Re-validate the merged result — individual fields can each be valid alone but conflict once merged.
    const mergedCheck = validateRules(next)
    if (!mergedCheck.valid) return NextResponse.json({ error: mergedCheck.error }, { status: 400 })

    await docRef.set({ ...next, updated_by: user.email, updated_at: new Date().toISOString() })
    return NextResponse.json({ rules: next })
  } catch (err: any) {
    console.error("[channel-scorecard/rules] PUT error:", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
