import { NextRequest, NextResponse } from "next/server"
import { createSign } from "crypto"

/**
 * GET /api/sdr-sql-tracker?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Reads the "Meetings Booked" tab of the SDR tracker sheet — SDRs log each meeting there
 * directly (SQL / Qualified Opportunity / Closed Won / Closed Lost per lead), which is more
 * complete than HubSpot's lifecyclestage-derived counts for the same weeks: SDRs often mark a
 * lead SQL/Opportunity in this sheet before (or without ever) updating the matching HubSpot
 * property. Bucketed by "Expressed Interest Date" (the row's lead-entry date) into Mon-Sun
 * weeks, matching how the rest of this dashboard buckets by week.
 *
 * NOT the same sheet tab as /api/sdr-activity (that reads the older, now-hidden
 * "SDR Weekly Activity" tab, which stopped being updated around mid-2026).
 */

export const maxDuration = 30

const SHEET_ID = "1REVpGqF-E_0WNQgUJ1xNA41MCO-zOFfWJ1Q7dznsCG4"
const TAB_NAME = "Meetings Booked"
const SA_EMAIL = process.env.VERTEX_SA_EMAIL || "automation@abm-agent.iam.gserviceaccount.com"

function getSAKey(): string {
  const raw = process.env.VERTEX_SA_KEY || ""
  return raw.replace(/\\n/g, "\n")
}

async function getAccessToken(): Promise<string> {
  const key = getSAKey()
  if (!key) throw new Error("VERTEX_SA_KEY not configured")

  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(JSON.stringify({
    iss: SA_EMAIL,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  })).toString("base64url")

  const signature = createSign("RSA-SHA256")
    .update(`${header}.${payload}`)
    .sign(key, "base64url")

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${header}.${payload}.${signature}`,
  })
  const data = await res.json()
  if (!data.access_token) throw new Error("Google auth failed: " + JSON.stringify(data))
  return data.access_token
}

// Column indices (0-based) on the "Meetings Booked" tab
const COL = {
  expressedInterestDate: 2, // C
  introCallDate: 15,        // P
  sqls: 19,                 // T — "Yes" / "No"
  qualifiedOpp: 20,          // U — "Yes" / blank
  closedWon: 22,             // W — "Yes" / blank
  closedLost: 23,            // X — "Yes" / blank
}

// Returns a YYYY-MM-DD string using the LOCAL calendar date `new Date(...)` parses the sheet
// string into — never round-trips through toISOString()/UTC, which would shift the date
// backward by a day for any runtime timezone behind UTC. String comparison of YYYY-MM-DD
// values is timezone-agnostic, so callers compare these directly against start/end params.
function parseSheetDate(s: string | undefined): string | null {
  if (!s) return null
  const cleaned = s.trim().replace(/,(\d)/g, ", $1").replace(/\s+/g, " ")
  const d = new Date(cleaned)
  if (isNaN(d.getTime())) return null
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const isYes = (v: string | undefined) => (v || "").trim().toLowerCase() === "yes"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const startParam = searchParams.get("start")
  const endParam = searchParams.get("end")

  try {
    const token = await getAccessToken()
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(TAB_NAME)}!A2:X5000?majorDimension=ROWS`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Sheets API error: ${err.substring(0, 200)}`)
    }
    const data = await res.json()
    const rows: string[][] = data.values || []

    let total = 0
    let sql = 0
    let opp = 0
    let won = 0
    let lost = 0

    for (const r of rows) {
      // Skip section-divider rows like ["2026 Meetings"] which only have column A populated
      const expressed = parseSheetDate(r[COL.expressedInterestDate])
      if (!expressed) continue

      if (startParam && expressed < startParam) continue
      if (endParam && expressed >= endParam) continue

      total++
      if (isYes(r[COL.sqls])) sql++
      if (isYes(r[COL.qualifiedOpp])) opp++
      if (isYes(r[COL.closedWon])) won++
      if (isYes(r[COL.closedLost])) lost++
    }

    return NextResponse.json({ total, sql, opp, won, lost, source: "sdr-sheet", date_range: { start: startParam, end: endParam } })
  } catch (err: unknown) {
    console.error("[sdr-sql-tracker]", err)
    const message = err instanceof Error ? err.message : "Failed to fetch SDR SQL tracker"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
