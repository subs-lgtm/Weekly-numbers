import { NextResponse } from "next/server"
import { createSign } from "crypto"

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
  const signature = createSign("RSA-SHA256").update(`${header}.${payload}`).sign(key, "base64url")
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${header}.${payload}.${signature}`,
  })
  const data = await res.json()
  if (!data.access_token) throw new Error("Google auth failed: " + JSON.stringify(data))
  return data.access_token
}

// Column indices (0-based from row 1 headers)
const COL = {
  weekNum: 0,          // A - Week #
  month: 1,            // B - Month
  interestDate: 2,     // C - Expressed Interest Date
  inboundOutbound: 3,  // D - Inbound or Outbound
  leadFormType: 4,     // E - Inbound Lead Form Type
  autobooked: 5,       // F - Inbound Autobooked to calendar
  companyName: 6,      // G - Company Name
  vertical: 7,         // H - Vertical
  contactName: 8,      // I - Contact Name
  title: 9,            // J - Title
  location: 10,        // K - Location
  linkedinUrl: 11,     // L - Contact LinkedIn URL
  productHook: 12,     // M - Product Hook
  channel: 13,         // N - Channel Meeting Booked By
  introScheduled: 14,  // O - Intro Call Scheduled
  introDate: 15,       // P - Intro Call Date
  introCompleted: 16,  // Q - Intro Call Completed
  leadStatus: 17,      // R - Lead Status
  lifecycleStage: 18,  // S - Lifecycle Stage
  sqls: 19,            // T - SQLs
  qualifiedOpp: 20,    // U - Qualified Opportunity
  closedWon: 21,       // V - Closed Won
  leadStatus2: 22,     // W - Lead Status (duplicate)
  lifecycleStage2: 23, // X - Lead Lifecycle Stage (duplicate)
  productSelling: 24,  // Y - Product we're selling
  sdrOwner: 25,        // Z - SDR Owner
}

function parseSheetDate(s: string): string | null {
  if (!s) return null
  let cleaned = s.trim().replace(/,(\d)/g, ", $1")
  // Handle ordinal suffixes: "12th", "1st", "2nd", "3rd"
  cleaned = cleaned.replace(/(\d+)(st|nd|rd|th)/gi, "$1")
  const d = new Date(cleaned)
  if (isNaN(d.getTime())) return null
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export interface MeetingRow {
  weekNum: string
  month: string
  interestDate: string
  parsedDate: string | null
  inboundOutbound: string
  leadFormType: string
  autobooked: string
  companyName: string
  vertical: string
  contactName: string
  title: string
  location: string
  linkedinUrl: string
  productHook: string
  channel: string
  introScheduled: string
  introDate: string
  introCompleted: string
  leadStatus: string
  lifecycleStage: string
  isSql: boolean
  qualifiedOpp: boolean
  closedWon: boolean
  productSelling: string
  sdrOwner: string
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const startDateParam = searchParams.get("startDate")
    const endDateParam = searchParams.get("endDate")

    const token = await getAccessToken()
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(TAB_NAME)}!A2:Z1000?majorDimension=ROWS`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Sheets API error: ${err.substring(0, 200)}`)
    }

    const data = await res.json()
    const rawRows: string[][] = data.values || []

    // Parse rows — skip separator rows (like "2026 Meetings")
    const rows: MeetingRow[] = rawRows
      .filter(r => r[COL.companyName]?.trim() || r[COL.contactName]?.trim())
      .map(r => ({
        weekNum: (r[COL.weekNum] || "").trim(),
        month: (r[COL.month] || "").trim(),
        interestDate: (r[COL.interestDate] || "").trim(),
        parsedDate: parseSheetDate(r[COL.interestDate] || ""),
        inboundOutbound: (r[COL.inboundOutbound] || "").trim(),
        leadFormType: (r[COL.leadFormType] || "").trim(),
        autobooked: (r[COL.autobooked] || "").trim(),
        companyName: (r[COL.companyName] || "").trim(),
        vertical: (r[COL.vertical] || "").trim(),
        contactName: (r[COL.contactName] || "").trim(),
        title: (r[COL.title] || "").trim(),
        location: (r[COL.location] || "").trim(),
        linkedinUrl: (r[COL.linkedinUrl] || "").trim(),
        productHook: (r[COL.productHook] || "").trim(),
        channel: (r[COL.channel] || "").trim(),
        introScheduled: (r[COL.introScheduled] || "").trim(),
        introDate: (r[COL.introDate] || "").trim(),
        introCompleted: (r[COL.introCompleted] || "").trim(),
        leadStatus: (r[COL.leadStatus] || "").trim(),
        lifecycleStage: (r[COL.lifecycleStage] || "").trim(),
        isSql: (r[COL.sqls] || "").trim().toLowerCase() === "yes",
        qualifiedOpp: (r[COL.qualifiedOpp] || "").trim().toLowerCase() === "yes",
        closedWon: (r[COL.closedWon] || "").trim().toLowerCase() === "yes",
        productSelling: (r[COL.productSelling] || "").trim(),
        sdrOwner: (r[COL.sdrOwner] || "").trim(),
      }))

    // Filter by date range if provided
    let filtered: MeetingRow[]
    if (startDateParam && endDateParam) {
      filtered = rows.filter(r => {
        if (!r.parsedDate) return false
        return r.parsedDate >= startDateParam && r.parsedDate < endDateParam
      })
    } else {
      filtered = rows
    }

    // Aggregations
    const totalMeetings = filtered.length
    const introScheduledCount = filtered.filter(r => r.introScheduled.toLowerCase() === "yes").length
    const introCompletedCount = filtered.filter(r => r.introCompleted.toLowerCase() === "yes").length
    const sqlCount = filtered.filter(r => r.isSql).length
    const oppCount = filtered.filter(r => r.qualifiedOpp).length
    const closedWonCount = filtered.filter(r => r.closedWon).length
    const noShowCount = filtered.filter(r => r.introCompleted.toLowerCase() === "no show" || r.introCompleted.toLowerCase() === "no").length

    // By source (Inbound/Outbound/Event)
    const bySource: Record<string, number> = {}
    for (const r of filtered) {
      const src = r.inboundOutbound || "Unknown"
      bySource[src] = (bySource[src] || 0) + 1
    }

    // By vertical/industry
    const byVertical: Record<string, number> = {}
    for (const r of filtered) {
      const v = r.vertical || "Unknown"
      byVertical[v] = (byVertical[v] || 0) + 1
    }

    // By product hook
    const byProduct: Record<string, number> = {}
    for (const r of filtered) {
      const p = r.productHook || "Unknown"
      byProduct[p] = (byProduct[p] || 0) + 1
    }

    // By channel
    const byChannel: Record<string, number> = {}
    for (const r of filtered) {
      const c = r.channel || "Unknown"
      byChannel[c] = (byChannel[c] || 0) + 1
    }

    // By SDR owner
    const bySDR: Record<string, { total: number; completed: number; sql: number; opp: number }> = {}
    for (const r of filtered) {
      const sdr = r.sdrOwner || "Unknown"
      if (!bySDR[sdr]) bySDR[sdr] = { total: 0, completed: 0, sql: 0, opp: 0 }
      bySDR[sdr].total++
      if (r.introCompleted.toLowerCase() === "yes") bySDR[sdr].completed++
      if (r.isSql) bySDR[sdr].sql++
      if (r.qualifiedOpp) bySDR[sdr].opp++
    }

    // By lifecycle stage
    const byStage: Record<string, number> = {}
    for (const r of filtered) {
      const s = r.lifecycleStage || "Unknown"
      byStage[s] = (byStage[s] || 0) + 1
    }

    // By lead status
    const byLeadStatus: Record<string, number> = {}
    for (const r of filtered) {
      const s = r.leadStatus || "Unknown"
      byLeadStatus[s] = (byLeadStatus[s] || 0) + 1
    }

    // By month
    const byMonth: Record<string, number> = {}
    for (const r of filtered) {
      const m = r.month || "Unknown"
      byMonth[m] = (byMonth[m] || 0) + 1
    }

    // By location (country)
    const byLocation: Record<string, number> = {}
    for (const r of filtered) {
      const loc = r.location || "Unknown"
      // Extract country from "City, Country" format
      const parts = loc.split(",")
      const country = parts.length > 1 ? parts[parts.length - 1].trim() : loc.trim()
      byLocation[country] = (byLocation[country] || 0) + 1
    }

    // Funnel data
    const funnel = {
      meetings: totalMeetings,
      introScheduled: introScheduledCount,
      introCompleted: introCompletedCount,
      sql: sqlCount,
      opportunity: oppCount,
      closedWon: closedWonCount,
    }

    // Show rate
    const showRate = introScheduledCount > 0 ? Math.round((introCompletedCount / introScheduledCount) * 100) : 0

    return NextResponse.json({
      totals: {
        meetings: totalMeetings,
        introScheduled: introScheduledCount,
        introCompleted: introCompletedCount,
        noShow: noShowCount,
        sqls: sqlCount,
        opportunities: oppCount,
        closedWon: closedWonCount,
        showRate,
      },
      funnel,
      bySource,
      byVertical,
      byProduct,
      byChannel,
      bySDR,
      byStage,
      byLeadStatus,
      byMonth,
      byLocation,
      meetings: filtered.map(r => ({
        date: r.interestDate,
        company: r.companyName,
        contact: r.contactName,
        title: r.title,
        vertical: r.vertical,
        source: r.inboundOutbound,
        product: r.productHook,
        channel: r.channel,
        status: r.leadStatus,
        stage: r.lifecycleStage,
        sdr: r.sdrOwner,
        introCompleted: r.introCompleted,
        isSql: r.isSql,
        isOpp: r.qualifiedOpp,
        location: r.location,
      })),
      rowCount: filtered.length,
    })
  } catch (err: unknown) {
    console.error("[meetings-tracker]", err)
    const message = err instanceof Error ? err.message : "Failed to fetch meetings data"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
