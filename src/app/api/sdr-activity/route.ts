import { NextResponse } from "next/server"
import { createSign } from "crypto"

export const maxDuration = 30

const SHEET_ID = "1REVpGqF-E_0WNQgUJ1xNA41MCO-zOFfWJ1Q7dznsCG4"
const TAB_NAME = "SDR Weekly Activity"
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

// Column indices (0-based, from row 2 headers)
const COL = {
  weekStart: 0,       // A - Week Start
  month: 1,           // B - Month
  quarter: 2,         // C - Quarter
  bdrName: 3,         // D - BDR Name
  campaign: 4,        // E - Campaign Name
  industry: 5,        // F - Industry / Segment
  region: 6,          // G - Region
  product: 7,         // H - Product Pitched
  channel: 8,         // I - Channel
  persona: 9,         // J - Persona Targeted
  contactsMapped: 10, // K - Contacts Mapped
  liRequests: 11,     // L - LI Connection Requests Sent
  liAccepted: 12,     // M - Accepted LI Connections
  liMessages: 13,     // N - Unique LI Messages Sent
  liFollowups: 14,    // O - LinkedIn Follow Ups Sent
  emailsSent: 15,     // P - Emails Sent
  callAttempts: 16,   // Q - Call Attempts
  liveConversations: 17, // R - Live Conversations
  negativeResponses: 18, // S - Negative Responses
  positiveResponses: 19, // T - Positive Responses
  totalResponses: 20, // U - Total Responses
  meetingsBooked: 21, // V - Meetings Booked
  meetingsHeld: 22,   // W - Meetings Held
  showRate: 23,       // X - Show Rate
  sqls: 24,           // Y - SQLs Created
  opps: 25,           // Z - Opportunities Created
  pipelineValue: 26,  // AA - Pipeline Value
  totalTouches: 27,   // AB - Total Outbound Touches
  acceptanceRate: 28, // AC - Connection Acceptance Rate (formula)
  responseRate: 29,   // AD - Response Rate (formula)
  meetingConvRate: 30, // AE - Meeting Conversion Rate (formula)
  callConnectRate: 31, // AF - Call Connect Rate (formula)
}

function parseNum(val: string | undefined): number {
  if (!val) return 0
  const cleaned = val.replace(/[,$%#REF!VALUE+]/g, "").trim()
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

// Normalize channel names (LinkedIn vs Linkedin)
function normalizeChannel(ch: string): string {
  const lower = ch.toLowerCase().trim()
  if (lower === "linkedin") return "LinkedIn"
  if (lower === "mail") return "Email"
  if (lower === "call") return "Cold Call"
  if (lower === "instantly") return "Instantly"
  if (lower === "heyreach") return "Heyreach"
  return ch.trim()
}

// Normalize product names (handle typos/duplicates)
function normalizeProduct(prod: string): string {
  const lower = prod.toLowerCase().trim()
  if (lower.includes("spotlight") || lower.includes("spotight") || lower.includes("cvc")) return "CVC Spotlight"
  if (lower === "studio" || lower === "lyzr_studio") return "Studio"
  if (lower.includes("lyzr gpt") || lower === "lyzrgpt" || lower.includes("lgpt")) return "Lyzr GPT"
  if (lower.includes("architect")) return "Lyzr Architect"
  if (lower.includes("plug")) return "Plug & Play"
  if (lower.includes("skott")) return "Skott"
  if (lower.includes("lyzr (various)") || lower === "lyzr") return "Lyzr (Multiple)"
  return prod.trim()
}

export interface SDRRow {
  weekStart: string
  month: string
  quarter: string
  bdrName: string
  campaign: string
  industry: string
  region: string
  product: string
  channel: string
  persona: string
  contactsMapped: number
  liRequests: number
  liAccepted: number
  liMessages: number
  liFollowups: number
  emailsSent: number
  callAttempts: number
  liveConversations: number
  negativeResponses: number
  positiveResponses: number
  totalResponses: number
  meetingsBooked: number
  meetingsHeld: number
  sqls: number
  opps: number
  pipelineValue: number
  totalTouches: number
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const weekFilter = searchParams.get("week") // e.g. "2026-06-02" (legacy single week)
    const startDateParam = searchParams.get("startDate") // e.g. "2026-06-02"
    const endDateParam = searchParams.get("endDate") // e.g. "2026-06-09"

    const token = await getAccessToken()

    // Fetch all data rows (skip header row 1 and column header row 2)
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(TAB_NAME)}!A3:AF10000?majorDimension=ROWS`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Sheets API error: ${err.substring(0, 200)}`)
    }

    const data = await res.json()
    const rawRows: string[][] = data.values || []

    // Parse into structured rows
    const rows: SDRRow[] = rawRows
      .filter(r => r[COL.bdrName]?.trim()) // Must have BDR name (weekStart can be empty for some rows)
      .map(r => ({
        weekStart: r[COL.weekStart] || "",
        month: r[COL.month] || "",
        quarter: r[COL.quarter] || "",
        bdrName: (r[COL.bdrName] || "").trim(),
        campaign: (r[COL.campaign] || "").trim(),
        industry: (r[COL.industry] || "").trim(),
        region: (r[COL.region] || "").trim(),
        product: normalizeProduct(r[COL.product] || ""),
        channel: normalizeChannel(r[COL.channel] || ""),
        persona: (r[COL.persona] || "").trim(),
        contactsMapped: parseNum(r[COL.contactsMapped]),
        liRequests: parseNum(r[COL.liRequests]),
        liAccepted: parseNum(r[COL.liAccepted]),
        liMessages: parseNum(r[COL.liMessages]),
        liFollowups: parseNum(r[COL.liFollowups]),
        emailsSent: parseNum(r[COL.emailsSent]),
        callAttempts: parseNum(r[COL.callAttempts]),
        liveConversations: parseNum(r[COL.liveConversations]),
        negativeResponses: parseNum(r[COL.negativeResponses]),
        positiveResponses: parseNum(r[COL.positiveResponses]),
        totalResponses: parseNum(r[COL.totalResponses]),
        meetingsBooked: parseNum(r[COL.meetingsBooked]),
        meetingsHeld: parseNum(r[COL.meetingsHeld]),
        sqls: parseNum(r[COL.sqls]),
        opps: parseNum(r[COL.opps]),
        pipelineValue: parseNum(r[COL.pipelineValue]),
        totalTouches: parseNum(r[COL.totalTouches]),
      }))

    // Get unique weeks for filtering
    const uniqueWeeks = [...new Set(rows.map(r => r.weekStart))].filter(Boolean)

    // Parse a sheet date string into a comparable yyyy-MM-dd string (local date, no timezone issues)
    function parseSheetDate(s: string): string | null {
      if (!s) return null
      // Normalize: remove extra spaces, fix "June 1,2026" → "June 1, 2026"
      let cleaned = s.trim().replace(/,(\d)/g, ', $1')
      const d = new Date(cleaned)
      if (isNaN(d.getTime())) return null
      // Extract as UTC parts to avoid timezone offset issues
      // new Date("June 1, 2026") parses as local time → use getFullYear/Month/Date
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    // Filter by date range (startDate/endDate) or single week
    let filtered: SDRRow[]
    if (startDateParam && endDateParam) {
      filtered = rows.filter(r => {
        if (!r.weekStart) return false
        const parsed = parseSheetDate(r.weekStart)
        if (!parsed) return false
        return parsed >= startDateParam && parsed < endDateParam
      })
    } else if (weekFilter) {
      filtered = rows.filter(r => r.weekStart === weekFilter)
    } else {
      filtered = rows
    }

    // Aggregate by BDR for the selected week(s)
    const byBDR: Record<string, {
      totalTouches: number; meetingsBooked: number; meetingsHeld: number;
      emailsSent: number; callAttempts: number; liMessages: number; liRequests: number;
      liAccepted: number; positiveResponses: number; totalResponses: number;
      sqls: number; opps: number; pipelineValue: number; campaigns: number;
    }> = {}

    for (const row of filtered) {
      if (!byBDR[row.bdrName]) {
        byBDR[row.bdrName] = {
          totalTouches: 0, meetingsBooked: 0, meetingsHeld: 0,
          emailsSent: 0, callAttempts: 0, liMessages: 0, liRequests: 0,
          liAccepted: 0, positiveResponses: 0, totalResponses: 0,
          sqls: 0, opps: 0, pipelineValue: 0, campaigns: 0,
        }
      }
      const b = byBDR[row.bdrName]
      b.totalTouches += row.totalTouches
      b.meetingsBooked += row.meetingsBooked
      b.meetingsHeld += row.meetingsHeld
      b.emailsSent += row.emailsSent
      b.callAttempts += row.callAttempts
      b.liMessages += row.liMessages
      b.liRequests += row.liRequests
      b.liAccepted += row.liAccepted
      b.positiveResponses += row.positiveResponses
      b.totalResponses += row.totalResponses
      b.sqls += row.sqls
      b.opps += row.opps
      b.pipelineValue += row.pipelineValue
      b.campaigns += 1
    }

    // Weekly trend (by week start date)
    const weeklyTrend: Record<string, { touches: number; meetings: number; responses: number; sqls: number }> = {}
    for (const row of rows) {
      if (!weeklyTrend[row.weekStart]) {
        weeklyTrend[row.weekStart] = { touches: 0, meetings: 0, responses: 0, sqls: 0 }
      }
      weeklyTrend[row.weekStart].touches += row.totalTouches
      weeklyTrend[row.weekStart].meetings += row.meetingsBooked
      weeklyTrend[row.weekStart].responses += row.totalResponses
      weeklyTrend[row.weekStart].sqls += row.sqls
    }

    // Channel breakdown for filtered data
    const byChannel: Record<string, { touches: number; meetings: number }> = {}
    for (const row of filtered) {
      const ch = row.channel || "Other"
      if (!byChannel[ch]) byChannel[ch] = { touches: 0, meetings: 0 }
      byChannel[ch].touches += row.totalTouches
      byChannel[ch].meetings += row.meetingsBooked
    }

    // Region breakdown
    const byRegion: Record<string, { touches: number; meetings: number; count: number }> = {}
    for (const row of filtered) {
      const reg = row.region?.trim() || "Unknown"
      if (!byRegion[reg]) byRegion[reg] = { touches: 0, meetings: 0, count: 0 }
      byRegion[reg].touches += row.totalTouches
      byRegion[reg].meetings += row.meetingsBooked
      byRegion[reg].count += 1
    }

    // Product Pitched breakdown
    const byProduct: Record<string, { touches: number; meetings: number; count: number }> = {}
    for (const row of filtered) {
      const prod = row.product?.trim() || "Unknown"
      if (!byProduct[prod]) byProduct[prod] = { touches: 0, meetings: 0, count: 0 }
      byProduct[prod].touches += row.totalTouches
      byProduct[prod].meetings += row.meetingsBooked
      byProduct[prod].count += 1
    }

    // Industry/Segment breakdown
    const byIndustry: Record<string, { touches: number; meetings: number; count: number }> = {}
    for (const row of filtered) {
      const ind = row.industry?.trim() || "Unknown"
      if (!byIndustry[ind]) byIndustry[ind] = { touches: 0, meetings: 0, count: 0 }
      byIndustry[ind].touches += row.totalTouches
      byIndustry[ind].meetings += row.meetingsBooked
      byIndustry[ind].count += 1
    }

    // Campaign breakdown
    const byCampaign: Record<string, { touches: number; meetings: number; responses: number; count: number }> = {}
    for (const row of filtered) {
      const camp = row.campaign?.trim() || "Unknown"
      if (!byCampaign[camp]) byCampaign[camp] = { touches: 0, meetings: 0, responses: 0, count: 0 }
      byCampaign[camp].touches += row.totalTouches
      byCampaign[camp].meetings += row.meetingsBooked
      byCampaign[camp].responses += row.totalResponses
      byCampaign[camp].count += 1
    }

    // Persona breakdown
    const byPersona: Record<string, { touches: number; meetings: number; count: number }> = {}
    for (const row of filtered) {
      const persona = row.persona?.trim() || "Unknown"
      if (!byPersona[persona]) byPersona[persona] = { touches: 0, meetings: 0, count: 0 }
      byPersona[persona].touches += row.totalTouches
      byPersona[persona].meetings += row.meetingsBooked
      byPersona[persona].count += 1
    }

    // Totals for scorecards
    const totals = filtered.reduce((acc, r) => ({
      totalTouches: acc.totalTouches + r.totalTouches,
      meetingsBooked: acc.meetingsBooked + r.meetingsBooked,
      meetingsHeld: acc.meetingsHeld + r.meetingsHeld,
      emailsSent: acc.emailsSent + r.emailsSent,
      callAttempts: acc.callAttempts + r.callAttempts,
      liMessages: acc.liMessages + r.liMessages,
      liRequests: acc.liRequests + r.liRequests,
      liAccepted: acc.liAccepted + r.liAccepted,
      liFollowups: acc.liFollowups + r.liFollowups,
      contactsMapped: acc.contactsMapped + r.contactsMapped,
      liveConversations: acc.liveConversations + r.liveConversations,
      negativeResponses: acc.negativeResponses + r.negativeResponses,
      positiveResponses: acc.positiveResponses + r.positiveResponses,
      totalResponses: acc.totalResponses + r.totalResponses,
      sqls: acc.sqls + r.sqls,
      opps: acc.opps + r.opps,
      pipelineValue: acc.pipelineValue + r.pipelineValue,
    }), {
      totalTouches: 0, meetingsBooked: 0, meetingsHeld: 0,
      emailsSent: 0, callAttempts: 0, liMessages: 0, liRequests: 0,
      liAccepted: 0, liFollowups: 0, contactsMapped: 0,
      liveConversations: 0, negativeResponses: 0,
      positiveResponses: 0, totalResponses: 0,
      sqls: 0, opps: 0, pipelineValue: 0,
    })

    return NextResponse.json({
      totals,
      byBDR,
      byChannel,
      byRegion,
      byProduct,
      byIndustry,
      byCampaign,
      byPersona,
      weeklyTrend,
      uniqueWeeks,
      rowCount: filtered.length,
    })
  } catch (err: unknown) {
    console.error("[sdr-activity]", err)
    const message = err instanceof Error ? err.message : "Failed to fetch SDR activity"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
