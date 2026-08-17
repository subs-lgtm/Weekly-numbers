import { NextRequest, NextResponse } from 'next/server'

const HS_BASE = 'https://api.hubapi.com'
const HS_TOKEN = () => process.env.HUBSPOT_API_KEY!

async function searchAll(filters: any[], properties: string[]): Promise<any[]> {
  const all: any[] = []
  let after: number | undefined = undefined
  while (true) {
    const res: Response = await fetch(`${HS_BASE}/crm/v3/objects/contacts/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${HS_TOKEN()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filterGroups: [{ filters }],
        properties,
        limit: 100,
        ...(after !== undefined ? { after } : {}),
      }),
    })
    const data: any = await res.json()
    all.push(...(data.results || []))
    if (!data.paging?.next?.after) break
    after = data.paging.next.after
  }
  return all
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start') // yyyy-MM-dd
  const end   = searchParams.get('end')   // yyyy-MM-dd

  const PROPS = [
    'event_name', 'event_intent_level', 'event_meeting_outcome',
    'event_meeting_type', 'event_meeting_booked_by', 'event_meeting_date', 'createdate',
  ]

  // Fetch ALL event leads (event_name is set) — no date filter at the HubSpot query level
  // We apply date filtering in JS below so we can handle missing event_meeting_date gracefully
  const contacts = await searchAll([
    { propertyName: 'event_name', operator: 'HAS_PROPERTY' },
  ], PROPS)

  // Parse date range
  const rangeStart = start ? new Date(start + 'T00:00:00Z').getTime() : null
  const rangeEnd   = end   ? new Date(end   + 'T23:59:59Z').getTime() : null

  const by_event:   Record<string, number> = {}
  const by_intent:  Record<string, number> = {}
  const by_outcome: Record<string, number> = {}
  const by_type:    Record<string, number> = {}

  // Total = all event leads always (regardless of date range)
  // Breakdowns:
  //   - by_event / by_intent: all leads (event attendance doesn't depend on meeting date)
  //   - by_outcome / by_type: only leads where event_meeting_date falls in range,
  //     OR where event_meeting_date is not set (meeting date unknown — include always)
  for (const c of contacts) {
    const p = c.properties
    const event   = (p.event_name           || 'Unknown').trim()
    const intent  = (p.event_intent_level   || '—').trim()
    const outcome = (p.event_meeting_outcome || '—').trim()
    const type    = (p.event_meeting_type    || '—').trim()

    // Always count in by_event + by_intent (attendance data, not meeting-date-dependent)
    by_event[event]   = (by_event[event]   || 0) + 1
    by_intent[intent] = (by_intent[intent] || 0) + 1

    // For meeting outcome + type: filter by event_meeting_date if set, else always include
    const meetingDateStr = p.event_meeting_date || ''
    let inRange = true
    if (meetingDateStr && rangeStart && rangeEnd) {
      const meetingTs = new Date(meetingDateStr).getTime()
      inRange = meetingTs >= rangeStart && meetingTs <= rangeEnd
    }

    if (inRange) {
      by_outcome[outcome] = (by_outcome[outcome] || 0) + 1
      by_type[type]       = (by_type[type]       || 0) + 1
    }
  }

  return NextResponse.json({
    total: contacts.length,
    by_event,
    by_intent_level: by_intent,
    by_meeting_outcome: by_outcome,
    by_meeting_type: by_type,
    // Pass back so the component can show context
    date_filtered: !!(rangeStart && rangeEnd),
    date_range: start && end ? `${start} → ${end}` : null,
  })
}
