import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const HS = 'https://api.hubspot.com'
const KEY = () => process.env.HUBSPOT_API_KEY!

const OWNER_NAMES: Record<string, string> = {
  '79356446': 'Priyanka', '80445580': 'Harshini', '84992427': 'Naveedh',
  '82937730': 'Arko', '86814642': 'Bharath', '87062975': 'Kushal',
  '86891194': 'Shefali', '91998497': 'Ashish Mali', '92317016': 'Kaushik',
  '91353602': 'Pooja', '83011296': 'Ravi K', '84992415': 'Joel',
  '88719021': 'Jill', '76416555': 'Rob', '90534432': 'Jason',
  '2133509980': 'Siva', '79625780': 'Praveen', '85561094': 'Anju',
  '85265274': 'Thanusha', '91022058': 'Amol',
}

const STAGE_LABEL: Record<string, string> = {
  // Verified against Lyzr's actual HubSpot lifecyclestage property options
  'lead':                   'Lead',
  'subscriber':             'Subscriber',
  'marketingqualifiedlead': 'MQL',
  'opportunity':            'SQL',         // Lyzr's "opportunity" value = SQL (Sales Qualified Lead)
  'salesqualifiedlead':     'SQL',         // standard HubSpot value (fallback)
  '249550600':              'Opportunity', // Lyzr's custom Opportunity stage
  'customer':               'Customer',
  '242934529':              'Discarded',
  '1331052807':             'Disqualified',
  '258802811':              '—',
}

const STATUS_EMOJI: Record<string, string> = {
  'Demo Booked': '📅', 'Demo Completed': '✅', 'Working': '🔄',
  'OPEN': '🔓', 'UNQUALIFIED': '❌', 'Demo no show': '👻',
  'Demo Cancelled by Client': '🚫', 'Demo Completed - PLG': '✅',
  'Associated with a deal': '💼',
}

async function hs(path: string, body?: object) {
  const opts: RequestInit = { headers: { Authorization: `Bearer ${KEY()}`, 'Content-Type': 'application/json' } }
  if (body) { opts.method = 'POST'; opts.body = JSON.stringify(body) }
  const r = await fetch(`${HS}${path}`, opts)
  if (!r.ok) return null
  return r.json()
}

async function getActivityCounts(contactId: string) {
  const [emails, calls, notes, meetings] = await Promise.all([
    hs(`/crm/v4/objects/contacts/${contactId}/associations/emails?limit=100`),
    hs(`/crm/v4/objects/contacts/${contactId}/associations/calls?limit=100`),
    hs(`/crm/v4/objects/contacts/${contactId}/associations/notes?limit=100`),
    hs(`/crm/v4/objects/contacts/${contactId}/associations/meetings?limit=100`),
  ])
  return {
    emails: (emails?.results || []).length,
    calls: (calls?.results || []).length,
    notes: (notes?.results || []).length,
    meetings: (meetings?.results || []).length,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end   = searchParams.get('end')

  if (!start || !end) return NextResponse.json({ error: 'start and end required' }, { status: 400 })

  const startMs = new Date(start + 'T00:00:00.000Z').getTime()
  const endMs   = new Date(end   + 'T00:00:00.000Z').getTime()

  // Fetch high-priority leads (score ≥ 70 = high_priority category) in the date range
  // Includes: Book a Demo / Email Form / Pre-Built Agents AND GSI and SI / Accenture form types
  const [data, gsiData] = await Promise.all([
    hs('/crm/v3/objects/contacts/search', {
      filterGroups: [{
        filters: [
          { propertyName: 'createdate', operator: 'GTE', value: startMs.toString() },
          { propertyName: 'createdate', operator: 'LT',  value: endMs.toString() },
          { propertyName: 'email', operator: 'NOT_CONTAINS_TOKEN', value: 'lyzr.ai' },
          { propertyName: 'lyzr_lead_score_category', operator: 'EQ', value: 'high_priority' },
          { propertyName: 'lead_form_type', operator: 'IN', values: ['Book a Demo', 'Email Form', 'Pre-Built Agents'] },
        ],
      }],
      properties: [
        'email', 'firstname', 'lastname', 'jobtitle', 'company',
        'lyzr_lead_score', 'lyzr_lead_score_category',
        'lifecyclestage', 'hs_lead_status', 'hubspot_owner_id',
        'lead_form_type', 'lead_source_category', 'createdate',
        'hs_latest_meeting_activity', 'num_contacted_notes',
        'notes_last_contacted', 'hs_last_sales_activity_timestamp',
      ],
      sorts: [{ propertyName: 'lyzr_lead_score', direction: 'DESCENDING' }],
      limit: 50,
    }),
    // Also fetch GSI/SI + Accenture high priority leads
    hs('/crm/v3/objects/contacts/search', {
      filterGroups: [
        {
          filters: [
            { propertyName: 'createdate', operator: 'GTE', value: startMs.toString() },
            { propertyName: 'createdate', operator: 'LT',  value: endMs.toString() },
            { propertyName: 'email', operator: 'NOT_CONTAINS_TOKEN', value: 'lyzr.ai' },
            { propertyName: 'lyzr_lead_score_category', operator: 'EQ', value: 'high_priority' },
            { propertyName: 'lead_form_type', operator: 'CONTAINS_TOKEN', value: 'GSI and SI' },
          ],
        },
        {
          filters: [
            { propertyName: 'createdate', operator: 'GTE', value: startMs.toString() },
            { propertyName: 'createdate', operator: 'LT',  value: endMs.toString() },
            { propertyName: 'email', operator: 'NOT_CONTAINS_TOKEN', value: 'lyzr.ai' },
            { propertyName: 'lyzr_lead_score_category', operator: 'EQ', value: 'high_priority' },
            { propertyName: 'lead_form_type', operator: 'CONTAINS_TOKEN', value: 'Accenture' },
          ],
        },
      ],
      properties: [
        'email', 'firstname', 'lastname', 'jobtitle', 'company',
        'lyzr_lead_score', 'lyzr_lead_score_category',
        'lifecyclestage', 'hs_lead_status', 'hubspot_owner_id',
        'lead_form_type', 'lead_source_category', 'createdate',
        'hs_latest_meeting_activity', 'num_contacted_notes',
        'notes_last_contacted', 'hs_last_sales_activity_timestamp',
      ],
      sorts: [{ propertyName: 'lyzr_lead_score', direction: 'DESCENDING' }],
      limit: 50,
    }),
  ])

  if (!data || !data.results) return NextResponse.json({ leads: [] })

  // Merge and deduplicate by contact ID
  const seen = new Set<string>()
  const allResults: any[] = []
  for (const c of [...(data.results || []), ...(gsiData?.results || [])]) {
    if (!seen.has(c.id)) { seen.add(c.id); allResults.push(c) }
  }
  // Re-sort merged results by score descending
  allResults.sort((a, b) => parseInt(b.properties?.lyzr_lead_score || '0') - parseInt(a.properties?.lyzr_lead_score || '0'))

  // Fetch activity counts for each lead in parallel batches of 5
  const leads = []
  const results = allResults

  for (let i = 0; i < results.length; i += 5) {
    const batch = results.slice(i, i + 5)
    const batchActivity = await Promise.all(
      batch.map((c: any) => getActivityCounts(c.id))
    )
    for (let j = 0; j < batch.length; j++) {
      const c = batch[j]
      const p = c.properties || {}
      const activity = batchActivity[j]
      const totalActivity = activity.emails + activity.calls + activity.notes + activity.meetings
      const ownerId = p.hubspot_owner_id || ''
      const ownerName = OWNER_NAMES[ownerId] || 'Unassigned'
      const stage = p.lifecyclestage || ''
      const status = p.hs_lead_status || ''
      const score = parseInt(p.lyzr_lead_score || '0')
      const hasActivity = totalActivity > 0

      // SLA: hours from createdate to first outreach activity
      // Use the earliest of: notes_last_contacted, hs_last_sales_activity_timestamp
      // If no activity logged → SLA is still pending (hours since creation)
      const createdMs = p.createdate ? new Date(p.createdate).getTime() : 0
      const firstActivityMs = Math.min(
        ...[
          p.notes_last_contacted,
          p.hs_last_sales_activity_timestamp,
          p.hs_latest_meeting_activity,
        ]
          .filter(Boolean)
          .map((ts: string) => new Date(ts).getTime())
          .filter((ms: number) => ms > 0 && ms >= createdMs)
      )
      const slaHours = createdMs > 0
        ? firstActivityMs !== Infinity
          ? Math.round((firstActivityMs - createdMs) / 3600000) // hours to first activity
          : Math.round((Date.now() - createdMs) / 3600000)      // still waiting — hours elapsed
        : null
      const slaContacted = firstActivityMs !== Infinity && hasActivity

      leads.push({
        id: c.id,
        name: [p.firstname, p.lastname].filter(Boolean).join(' ') || p.email || '—',
        email: p.email || '',
        company: p.company || '—',
        jobTitle: p.jobtitle || '—',
        score,
        owner: ownerName,
        ownerId,
        stage: STAGE_LABEL[stage] || stage || '—',
        status,
        statusEmoji: STATUS_EMOJI[status] || '•',
        formType: (p.lead_form_type || '').split(';')[0].trim() || '—',
        source: p.lead_source_category || '—',
        createdAt: p.createdate?.slice(0, 10) || '',
        slaHours,         // hours to first contact (or hours waiting if not yet contacted)
        slaContacted,     // true = SDR has contacted, false = still waiting
        activity: {
          emails: activity.emails,
          calls: activity.calls,
          notes: activity.notes,
          meetings: activity.meetings,
          total: totalActivity,
        },
        contacted: hasActivity,
        hsLink: `https://app.hubspot.com/contacts/45094316/contact/${c.id}`,
      })
    }
    await new Promise(r => setTimeout(r, 100))
  }

  const contacted = leads.filter(l => l.contacted).length
  const unassigned = leads.filter(l => l.owner === 'Unassigned').length

  return NextResponse.json({
    leads,
    total: leads.length,
    contacted,
    unassigned,
    dateRange: { start, end },
  })
}
