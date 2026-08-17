import { NextRequest, NextResponse } from 'next/server'
import { createSign } from 'crypto'

// Cloud Partner Marketing Tracker — "Task Tracker Q3" tab.
// This route replicates the recompute logic documented on that workbook's
// "Current Week Dashboard" tab (see its "How this tab works" notes), rather
// than reading the dashboard tab's cells directly — so this stays correct
// even if rows are inserted/deleted on the source tab (rule 8: reads by
// position, not by cell address).
const SHEET_ID = '1xJjS_SL9D1srmXo7gp3dRHcGNUzqLPLe5z3ERYRS5gs'
const SA_EMAIL = 'automation@abm-agent.iam.gserviceaccount.com'
const TASK_TRACKER_RANGE = "'Task Tracker Q3'!A2:I200" // rule 8: source range is rows 2-200

async function getToken(): Promise<string> {
  const key = (process.env.VERTEX_SA_KEY || '').replace(/\\n/g, '\n')
  const now = Math.floor(Date.now() / 1000)
  const hdr = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const pay = Buffer.from(JSON.stringify({
    iss: SA_EMAIL, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now,
  })).toString('base64url')
  const si = `${hdr}.${pay}`
  const sign = createSign('RSA-SHA256')
  sign.update(si)
  const jwt = `${si}.${sign.sign(key, 'base64url')}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  const d = await res.json() as { access_token?: string }
  if (!d.access_token) throw new Error(`Token failed: ${JSON.stringify(d)}`)
  return d.access_token
}

export type TrackerTask = {
  bucket: string
  task: string
  assignee: string
  deliverable: string
  priority: string
  status: string
  dateDelivered: string
  notes: string
  outputUrl: string
}

export type BucketBreakdown = {
  bucket: string
  completed: number
  inProgress: number
  total: number
}

export const maxDuration = 30

// Rule 6/7: Date Delivered accepts a real date ("14-Aug-2026") or the
// tracker's text style ("14th Aug") — day + month, year taken from the
// reporting Monday (weekAnchor). Anything else (blank, "8/14", "next week")
// does not parse and the task is excluded from "completed".
function parseDateDelivered(raw: string, anchorYear: number): Date | null {
  if (!raw?.trim()) return null
  const s = raw.trim()

  // "14th Aug", "14 Aug", "6th Aug"
  const ordinalMatch = s.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,})$/)
  if (ordinalMatch) {
    const day = parseInt(ordinalMatch[1], 10)
    const monthStr = ordinalMatch[2].slice(0, 3)
    const d = new Date(`${monthStr} ${day}, ${anchorYear}`)
    return isNaN(d.getTime()) ? null : d
  }

  // "14-Aug-2026" / "14-Aug-26"
  const dashMatch = s.match(/^(\d{1,2})-([A-Za-z]{3,})-(\d{2,4})$/)
  if (dashMatch) {
    const day = parseInt(dashMatch[1], 10)
    const monthStr = dashMatch[2].slice(0, 3)
    let year = parseInt(dashMatch[3], 10)
    if (year < 100) year += 2000
    const d = new Date(`${monthStr} ${day}, ${year}`)
    return isNaN(d.getTime()) ? null : d
  }

  // Fallback: let Date parse anything else recognizable (e.g. "Aug 14, 2026")
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function startOfDay(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    // Rule 1: the only input is the reporting Monday. Defaults to the most
    // recent Monday (today if today is Monday) if not supplied.
    const weekParam = searchParams.get('week')
    const now = new Date()
    let anchor: Date
    if (weekParam) {
      anchor = startOfDay(new Date(weekParam + 'T00:00:00'))
    } else {
      const day = now.getDay() // 0=Sun..6=Sat
      const diffToMonday = day === 0 ? -6 : 1 - day
      anchor = startOfDay(new Date(now))
      anchor.setDate(anchor.getDate() + diffToMonday)
    }
    // Rule 2: window = anchor minus 7 days through anchor, both ends included.
    const windowStart = new Date(anchor)
    windowStart.setDate(windowStart.getDate() - 7)
    const windowEnd = anchor

    const token = await getToken()
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(TASK_TRACKER_RANGE)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json() as { values?: string[][]; error?: any }
    if (data.error) throw new Error(JSON.stringify(data.error))

    const rows = data.values || []
    const tasks: TrackerTask[] = rows
      .filter(r => r[0]?.trim() || r[1]?.trim())
      .map(r => ({
        bucket: (r[0] || '').trim(),
        task: (r[1] || '').trim(),
        assignee: (r[2] || '').trim(),
        deliverable: (r[3] || '').trim(),
        priority: (r[4] || '').trim(),
        status: (r[5] || '').trim(),
        dateDelivered: (r[6] || '').trim(),
        notes: (r[7] || '').trim(),
        outputUrl: (r[8] || '').trim(),
      }))
      // carry bucket forward for continuation rows without a repeated bucket label
      .reduce<TrackerTask[]>((acc, t) => {
        if (!t.bucket && acc.length > 0) t.bucket = acc[acc.length - 1].bucket
        acc.push(t)
        return acc
      }, [])
      .filter(t => t.task) // drop bucket-only / blank rows

    // Rule 3/4: Completed = Status is exactly "Done" AND Date Delivered
    // parses into the window. "Closed" (dropped/handed off) is deliberately
    // excluded from both completed and in-progress.
    const completed = tasks.filter(t => {
      if (t.status.toLowerCase() !== 'done') return false
      const d = parseDateDelivered(t.dateDelivered, anchor.getFullYear())
      if (!d) return false
      return d >= windowStart && d <= windowEnd
    })

    // Rule 5: Coming week list = Status is exactly "In-progress".
    const inProgress = tasks.filter(t => t.status.toLowerCase() === 'in-progress')

    // Per-bucket breakdown (rows 13-24 on the source dashboard tab).
    const bucketOrder: string[] = []
    for (const t of tasks) {
      if (t.bucket && !bucketOrder.includes(t.bucket)) bucketOrder.push(t.bucket)
    }
    const buckets: BucketBreakdown[] = bucketOrder.map(bucket => ({
      bucket,
      completed: completed.filter(t => t.bucket === bucket).length,
      inProgress: inProgress.filter(t => t.bucket === bucket).length,
      total: tasks.filter(t => t.bucket === bucket).length,
    }))

    return NextResponse.json({
      weekAnchor: anchor.toISOString().slice(0, 10),
      windowStart: windowStart.toISOString().slice(0, 10),
      windowEnd: windowEnd.toISOString().slice(0, 10),
      headline: {
        completedLastWeek: completed.length,
        inProgressNow: inProgress.length,
        totalTasks: tasks.length,
      },
      buckets,
      completed,
      inProgress,
      updatedAt: new Date().toISOString(),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
