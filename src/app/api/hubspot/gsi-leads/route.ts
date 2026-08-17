import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/hubspot/gsi-leads?start=YYYY-MM-DD&end=YYYY-MM-DD
 *
 * Queries HubSpot contacts with lead_form_type = "GSI and SI" OR "Accenture"
 * within the given date range. Returns full breakdown for the dashboard card.
 */

const HUBSPOT_API_BASE = 'https://api.hubapi.com'

const PROPERTIES = [
  'firstname', 'lastname', 'email',
  'company', 'jobtitle', 'numemployees', 'country', 'industry',
  'lyzr_lead_score', 'lyzr_lead_score_category',
  'hs_lead_status', 'lifecyclestage',
  'hs_latest_meeting_activity',
  'lsa_booked_demo',
  'hubspot_owner_id',
  'createdate',
  'lead_form_type', 'lead_source_category',
]

// HubSpot owner ID → name
const OWNER_NAMES: Record<string, string> = {
  '79625780': 'Praveen',
  '92317016': 'Kaushik',
  '85561094': 'Anju',
  '91353602': 'Pooja',
  '91998497': 'Ashish Mali',
  '79356446': 'Priyanka',
  '80445580': 'Harshini',
  '84992427': 'Naveedh',
  '82937730': 'Arko',
  '86814642': 'Bharath',
  '87062975': 'Kushal',
  '86891194': 'Shefali',
  '83011296': 'Ravi K',
  '84992415': 'Joel',
  '88719021': 'Jill',
  '76416555': 'Rob',
  '90534432': 'Jason',
  '2133509980': 'Siva',
  '85265274': 'Thanusha',
  '91022058': 'Amol',
}

async function searchAll(apiKey: string, filterGroups: object[], properties: string[]) {
  const results: any[] = []
  let after: string | undefined

  while (true) {
    const body: any = { filterGroups, properties, limit: 100 }
    if (after) body.after = after

    const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      if (res.status === 429) { await new Promise(r => setTimeout(r, 1100)); continue }
      throw new Error(`HubSpot search failed: ${res.status}`)
    }

    const data = await res.json()
    results.push(...(data.results || []))
    if (!data.paging?.next?.after || !data.results?.length) break
    after = data.paging.next.after
    await new Promise(r => setTimeout(r, 150))
  }

  return results
}

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end   = searchParams.get('end')

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end params required' }, { status: 400 })
  }

  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'HUBSPOT_API_KEY not configured' }, { status: 500 })

  try {
    const startMs = new Date(start + 'T00:00:00.000Z').getTime()
    const endMs   = new Date(end   + 'T00:00:00.000Z').getTime()

    const dateFilters = [
      { propertyName: 'createdate', operator: 'GTE', value: startMs.toString() },
      { propertyName: 'createdate', operator: 'LT',  value: endMs.toString() },
      { propertyName: 'email',      operator: 'NOT_CONTAINS_TOKEN', value: 'lyzr.ai' },
    ]

    // Fetch GSI and SI + Accenture contacts in date range
    const contacts = await searchAll(apiKey, [
      { filters: [...dateFilters, { propertyName: 'lead_form_type', operator: 'CONTAINS_TOKEN', value: 'GSI and SI' }] },
      { filters: [...dateFilters, { propertyName: 'lead_form_type', operator: 'CONTAINS_TOKEN', value: 'Accenture'  }] },
    ], PROPERTIES)

    // Deduplicate
    const seen = new Set<string>()
    const unique: any[] = []
    for (const c of contacts) {
      if (!seen.has(c.id)) { seen.add(c.id); unique.push(c) }
    }

    // Compute breakdowns
    let high = 0, medium = 0, low = 0, unscored = 0
    let demoBooked = 0, meetingBooked = 0
    let gsiCount = 0, accentureCount = 0
    const byOwner: Record<string, number> = {}
    const byCountry: Record<string, number> = {}

    const DEMO_STATUSES = new Set([
      'Demo Booked', 'Demo Completed', 'Demo Completed - PLG',
      'Demo Completed - Disqualified', 'Demo no show',
      'Demo Cancelled by Client', 'Demo Completed - Ghosting',
    ])

    const contacts_list: Array<{
      id: string; name: string; email: string; company: string;
      jobTitle: string; country: string; score: number; priority: string;
      owner: string; demoBooked: boolean; meetingBooked: boolean;
      formType: string; createdate: string;
    }> = []

    for (const c of unique) {
      const p = c.properties || {}
      const cat    = p.lyzr_lead_score_category || ''
      const status = p.hs_lead_status || ''
      const ft     = (p.lead_form_type || '').toLowerCase()

      if (cat.includes('high'))   high++
      else if (cat.includes('medium')) medium++
      else if (cat.includes('low'))    low++
      else unscored++

      if (DEMO_STATUSES.has(status)) demoBooked++
      if (p.hs_latest_meeting_activity) meetingBooked++

      if (ft.includes('accenture'))  accentureCount++
      else                           gsiCount++

      const ownerId   = p.hubspot_owner_id || ''
      const ownerName = OWNER_NAMES[ownerId] || ownerId || 'Unassigned'
      byOwner[ownerName] = (byOwner[ownerName] || 0) + 1

      const country = p.country || 'Unknown'
      byCountry[country] = (byCountry[country] || 0) + 1

      contacts_list.push({
        id:           c.id,
        name:         [p.firstname, p.lastname].filter(Boolean).join(' ') || '—',
        email:        p.email || '—',
        company:      p.company || '—',
        jobTitle:     p.jobtitle || '—',
        country,
        score:        parseFloat(p.lyzr_lead_score || '0') || 0,
        priority:     cat.includes('high') ? 'High' : cat.includes('medium') ? 'Medium' : cat.includes('low') ? 'Low' : 'Unscored',
        owner:        ownerName,
        demoBooked:   DEMO_STATUSES.has(status),
        meetingBooked:!!p.hs_latest_meeting_activity,
        formType:     p.lead_form_type || 'GSI and SI',
        createdate:   p.createdate || '',
      })
    }

    // Sort contacts by score desc
    contacts_list.sort((a, b) => b.score - a.score)

    return NextResponse.json({
      total:    unique.length,
      gsi:      gsiCount,
      accenture:accentureCount,
      priority: { high, medium, low, unscored },
      demoBooked,
      meetingBooked,
      byOwner:  Object.entries(byOwner).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
      byCountry:Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([country, count]) => ({ country, count })),
      contacts: contacts_list,
      dateRange:{ start, end },
    })
  } catch (err: any) {
    console.error('[gsi-leads]', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
