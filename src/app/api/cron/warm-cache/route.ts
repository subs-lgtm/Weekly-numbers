import { NextRequest, NextResponse } from 'next/server'
import { format, startOfWeek, addWeeks, isBefore } from 'date-fns'

export const maxDuration = 300

/**
 * Daily cron: warms the MQL cache for all weeks from April 1 to current week.
 * Past weeks are cached for 24h in Firestore, current week for 1h.
 * This ensures any custom date range query is instant (just sums cached weeks).
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
  const startDate = new Date('2026-04-01')
  const today = new Date()

  // Generate all Monday-start weeks
  let cursor = startOfWeek(startDate, { weekStartsOn: 1 })
  const weeks: { start: string; end: string }[] = []

  while (isBefore(cursor, today)) {
    const start = format(cursor, 'yyyy-MM-dd')
    const end = format(addWeeks(cursor, 1), 'yyyy-MM-dd')
    weeks.push({ start, end })
    cursor = addWeeks(cursor, 1)
  }

  let warmed = 0
  let errors = 0

  for (const { start, end } of weeks) {
    try {
      // Warm MQLs cache
      await fetch(`${baseUrl}/api/hubspot/mqls?start=${start}&end=${end}`)
      // Warm All Leads cache
      await fetch(`${baseUrl}/api/hubspot/mqls?start=${start}&end=${end}&mode=all`)
      warmed++
    } catch {
      errors++
    }
    // Small delay between requests
    await new Promise(r => setTimeout(r, 200))
  }

  return NextResponse.json({
    success: true,
    weeks: weeks.length,
    warmed,
    errors,
    range: `${weeks[0]?.start} → ${weeks[weeks.length - 1]?.end}`,
  })
}
