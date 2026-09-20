import { NextRequest, NextResponse } from "next/server"
import { getAdminDb } from "@/lib/scorecard-admin"
import { getScorecardChannels } from "@/lib/nav-channels"
import { DEFAULT_RULES, type ScorecardRules, type ChannelScore } from "@/lib/scorecard-types"

/**
 * GET /api/channel-scorecard?month=YYYY-MM
 *
 * Read-only — returns every score recorded for the month, the live color rules, and the channel
 * list (so the frontend never has to duplicate getScorecardChannels() logic). No auth required
 * to read (matches the rest of this dashboard — every other page is read-open once logged in via
 * the app shell's own auth gate; only writes are server-verified here).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const month = searchParams.get("month")
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month param required, format YYYY-MM" }, { status: 400 })
  }

  try {
    const db = getAdminDb()
    const [scoresSnap, rulesDoc] = await Promise.all([
      db.collection("channel_scores").where("month", "==", month).get(),
      db.collection("scorecard_config").doc("rules").get(),
    ])

    const scores: ChannelScore[] = scoresSnap.docs.map((d: any) => d.data())
    const rules: ScorecardRules = rulesDoc.exists
      ? { ...DEFAULT_RULES, ...rulesDoc.data() }
      : DEFAULT_RULES

    return NextResponse.json({
      month,
      scores,
      rules,
      channels: getScorecardChannels(),
    })
  } catch (err: any) {
    console.error("[channel-scorecard] GET error:", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
