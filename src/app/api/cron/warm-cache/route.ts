import { NextRequest, NextResponse } from 'next/server'
import { format, startOfWeek, addWeeks } from 'date-fns'

export const maxDuration = 300

/**
 * Daily cron: warms the MQL cache (Firestore mql_cache) for the recent weeks and months the Leads page loads.
 * Past ranges stay fresh 7 days; current-period entries are served stale and refreshed in the background.
 * 
 * Schedule: daily at 6am UTC via Vercel cron
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL || `https://${req.headers.get('host')}`
  // Since the 7 Oct auth gate (src/proxy.ts) every /api/* call needs credentials; the cron's own sub-requests
  // were being 401'd, so nothing was actually warmed. CRON_SECRET bearer is accepted by the gate.
  const headers: Record<string, string> = cronSecret ? { authorization: `Bearer ${cronSecret}` } : {}
  const today = new Date()

  // Ranges the Leads page asks for: the last 12 Monday-start weeks and the last 7 calendar months (mode=all),
  // plus the weeks in default MQL mode. Newest first so the ranges people look at are warm even if the run is cut off.
  const ranges: { start: string; end: string; mode: '' | '&mode=all' }[] = []
  const thisMonday = startOfWeek(today, { weekStartsOn: 1 })
  for (let i = 0; i < 12; i++) {
    const s = addWeeks(thisMonday, -i)
    const e = addWeeks(s, 1)
    const r = { start: format(s, 'yyyy-MM-dd'), end: format(e, 'yyyy-MM-dd') }
    ranges.push({ ...r, mode: '&mode=all' }, { ...r, mode: '' })
  }
  for (let i = 0; i < 7; i++) {
    const s = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const e = new Date(today.getFullYear(), today.getMonth() - i + 1, 1)
    ranges.push({ start: format(s, 'yyyy-MM-dd'), end: format(e, 'yyyy-MM-dd'), mode: '&mode=all' })
  }

  let warmed = 0
  let errors = 0
  const CONCURRENCY = 3
  let next = 0
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < ranges.length) {
      const { start, end, mode } = ranges[next++]
      try {
        const r = await fetch(`${baseUrl}/api/hubspot/mqls?start=${start}&end=${end}${mode}&slim=1`, { headers })
        if (r.ok) warmed++; else errors++
      } catch { errors++ }
    }
  }))

  return NextResponse.json({ success: true, ranges: ranges.length, warmed, errors })
}
