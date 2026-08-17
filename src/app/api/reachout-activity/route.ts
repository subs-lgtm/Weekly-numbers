import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

const HS_BASE       = 'https://api.hubspot.com'
const INSTANTLY_KEY = 'NDMyMDI3MWUtNDQ4OS00OTBhLWFlMTEtYjcwY2EwMjNlMmE0OkVZUlNzVHZya3BYTg=='
const INSTANTLY_BASE = 'https://api.instantly.ai/api/v2'

// HubSpot owner ID → SDR info + Instantly workspace member email
const SDR_POOL: Record<string, { name: string; email: string }> = {
  '79356446': { name: 'Priyanka',    email: 'priyanka@lyzr.ai'    },
  '80445580': { name: 'Harshini',    email: 'harshini@lyzr.ai'    },
  '84992427': { name: 'Naveedh',     email: 'naveedh@lyzr.ai'     },
  '82937730': { name: 'Arko',        email: 'arko@lyzr.ai'        },
  '86814642': { name: 'Bharath',     email: 'bharath@lyzr.ai'     },
  '87062975': { name: 'Kushal',      email: 'kushal@lyzr.ai'      },
  '86891194': { name: 'Shefali',     email: 'shefali@lyzr.ai'     },
  '91998497': { name: 'Ashish Mali', email: 'ashish.mali@lyzr.ai' },
  '92317016': { name: 'Kaushik',     email: 'kaushik.venkatesan@lyzr.ai' },
  '91353602': { name: 'Pooja',       email: 'pooja@lyzr.ai'       },
  '83011296': { name: 'Ravi K',      email: 'ravi.k@lyzr.ai'      },
}

const HS_PROPS = [
  'email', 'firstname', 'lastname', 'company',
  'hs_lead_status', 'lifecyclestage', 'createdate', 'hubspot_owner_id',
  'lsa_lead_score_category', 'lyzr_lead_score_category',
  'lead_form_type', 'lead_source_category',
]

const DEMO_BOOKED = new Set([
  'Demo Booked', 'Demo Completed', 'Demo Completed - PLG',
  'Demo Completed - Disqualified', 'Demo no show',
  'Demo Cancelled by Client', 'Demo Completed - Ghosting',
])
const DEMO_DONE = new Set(['Demo Completed', 'Demo Completed - PLG'])
const OPP_STAGES = new Set(['249550600', 'customer', 'opportunity', 'salesqualifiedlead'])

// ── HubSpot: fetch all MQLs in date range ─────────────────────────────────────
async function fetchMQLs(apiKey: string, startMs: number, endMs: number) {
  const all: any[] = []
  let after: string | undefined
  while (true) {
    const body: any = {
      filterGroups: [{
        filters: [
          { propertyName: 'createdate',     operator: 'GTE', value: startMs.toString() },
          { propertyName: 'createdate',     operator: 'LT',  value: endMs.toString()   },
          { propertyName: 'email',          operator: 'NOT_CONTAINS_TOKEN', value: 'lyzr.ai' },
          { propertyName: 'lead_form_type', operator: 'IN',  values: ['Book a Demo', 'Email Form', 'Pre-Built Agents'] },
        ],
      }],
      properties: HS_PROPS,
      limit: 100,
    }
    if (after) body.after = after
    const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.status === 429) { await new Promise(r => setTimeout(r, 1100)); continue }
    if (!res.ok) throw new Error(`HubSpot ${res.status}`)
    const data = await res.json()
    all.push(...(data.results || []))
    if (data.paging?.next?.after) { after = data.paging.next.after; await new Promise(r => setTimeout(r, 150)) }
    else break
  }
  return all
}

// ── Instantly: get workspace member user_ids keyed by email ──────────────────
async function getMemberUserIds(): Promise<Record<string, string>> {
  const res = await fetch(`${INSTANTLY_BASE}/workspace-members?limit=100`, {
    headers: { Authorization: `Bearer ${INSTANTLY_KEY}` },
  })
  if (!res.ok) return {}
  const data = await res.json()
  const map: Record<string, string> = {}
  for (const m of (data.items || [])) {
    const email = (m.user_email || m.email || '').toLowerCase()
    if (email && m.user_id) map[email] = m.user_id
  }
  return map
}

// ── Instantly: for each MQL email, check if it was contacted and get activity ─
// Returns { matched, emailsSent, emailsOpened, emailsReplied } for the matched MQLs only
async function checkEmailsInInstantly(
  emails: string[],
  userId: string
): Promise<{ mqlsViaInstantly: number; emailsSentToMQLs: number; opensFromMQLs: number; repliesFromMQLs: number }> {
  if (!emails.length || !userId) return { mqlsViaInstantly: 0, emailsSentToMQLs: 0, opensFromMQLs: 0, repliesFromMQLs: 0 }

  let mqlsViaInstantly = 0
  let emailsSentToMQLs = 0
  let opensFromMQLs = 0
  let repliesFromMQLs = 0

  // Process in parallel batches of 5
  for (let i = 0; i < emails.length; i += 5) {
    const batch = emails.slice(i, i + 5)
    const results = await Promise.all(
      batch.map(email =>
        fetch(`${INSTANTLY_BASE}/leads/list`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${INSTANTLY_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.toLowerCase(), limit: 10 }),
        })
        .then(r => r.ok ? r.json() : { items: [] })
        .catch(() => ({ items: [] }))
      )
    )
    for (const data of results) {
      const leads: any[] = data.items || []
      // Find lead records assigned to this specific SDR
      const matchedLeads = leads.filter((l: any) => l.assigned_to === userId)
      if (matchedLeads.length > 0) {
        mqlsViaInstantly++
        // Sum up email activity across all records for this email (can appear in multiple campaigns)
        for (const lead of matchedLeads) {
          // email_open_count = total opens, email_reply_count = total replies
          // emails sent to this lead = sum of steps in status_summary or use open+reply as proxy
          // Instantly doesn't expose raw sent count per lead directly, but contacted = 1 email per step
          const stepsCount = lead.status_summary?.lastStep?.stepID
            ? parseInt((lead.status_summary.lastStep.stepID.split('_')[0] || '0')) + 1
            : 1
          emailsSentToMQLs += stepsCount
          opensFromMQLs   += lead.email_open_count   || 0
          repliesFromMQLs += lead.email_reply_count  || 0
        }
      }
    }
  }
  return { mqlsViaInstantly, emailsSentToMQLs, opensFromMQLs, repliesFromMQLs }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end   = searchParams.get('end')
  if (!start || !end) return NextResponse.json({ error: 'start and end required' }, { status: 400 })

  const apiKey  = process.env.HUBSPOT_API_KEY!
  const startMs = new Date(start + 'T00:00:00.000Z').getTime()
  const endMs   = new Date(end   + 'T00:00:00.000Z').getTime()

  // Fetch HubSpot MQLs + Instantly member map in parallel
  const [contacts, memberMap] = await Promise.all([
    fetchMQLs(apiKey, startMs, endMs),
    getMemberUserIds(),
  ])

  // Build per-SDR stats from HubSpot
  const stats: Record<string, {
    ownerId: string; name: string; email: string
    mqls: number; high: number; medium: number; low: number; unknown: number
    demoBooked: number; demoDone: number; working: number; opp: number
    mqlEmails: string[]
    mqlsViaInstantly: number
    emailsSentToMQLs: number   // emails Instantly sent to MQL contacts only
    opensFromMQLs: number
    repliesFromMQLs: number
  }> = {}

  for (const [ownerId, info] of Object.entries(SDR_POOL)) {
    stats[ownerId] = {
      ownerId, name: info.name, email: info.email,
      mqls: 0, high: 0, medium: 0, low: 0, unknown: 0,
      demoBooked: 0, demoDone: 0, working: 0, opp: 0,
      mqlEmails: [], mqlsViaInstantly: 0, emailsSentToMQLs: 0, opensFromMQLs: 0, repliesFromMQLs: 0,
    }
  }

  for (const c of contacts) {
    const p = c.properties || {}
    const ownerId = p.hubspot_owner_id || ''
    const s = stats[ownerId]
    if (!s) continue

    s.mqls++
    const cat = p.lsa_lead_score_category || p.lyzr_lead_score_category || ''
    if (cat === 'high_priority')   s.high++
    else if (cat === 'medium_priority') s.medium++
    else if (cat === 'low_priority')    s.low++
    else s.unknown++

    if (DEMO_BOOKED.has(p.hs_lead_status || '')) s.demoBooked++
    if (DEMO_DONE.has(p.hs_lead_status || ''))   s.demoDone++
    if (p.hs_lead_status === 'Working') s.working++
    if (OPP_STAGES.has(p.lifecyclestage || ''))  s.opp++

    const email = (p.email || '').toLowerCase().trim()
    if (email && !email.includes('@lyzr.ai')) s.mqlEmails.push(email)
  }

  // For each SDR: look up their MQL emails in Instantly to count matches
  // Only run for SDRs that have MQLs in this period
  await Promise.all(
    Object.values(stats).map(async s => {
      if (s.mqlEmails.length === 0) return
      const userId = memberMap[s.email.toLowerCase()]
      if (!userId) return
      const result = await checkEmailsInInstantly(s.mqlEmails, userId)
      s.mqlsViaInstantly  = result.mqlsViaInstantly
      s.emailsSentToMQLs  = result.emailsSentToMQLs
      s.opensFromMQLs     = result.opensFromMQLs
      s.repliesFromMQLs   = result.repliesFromMQLs
    })
  )

  const owners = Object.values(stats)
    .filter(s => s.mqls > 0)
    .sort((a, b) => b.mqls - a.mqls)

  const totals = owners.reduce((acc, s) => ({
    mqls:              acc.mqls + s.mqls,
    high:              acc.high + s.high,
    medium:            acc.medium + s.medium,
    low:               acc.low + s.low,
    demoBooked:        acc.demoBooked + s.demoBooked,
    demoDone:          acc.demoDone + s.demoDone,
    opp:               acc.opp + s.opp,
    mqlsViaInstantly:  acc.mqlsViaInstantly + s.mqlsViaInstantly,
    emailsSentToMQLs:  acc.emailsSentToMQLs + s.emailsSentToMQLs,
    opensFromMQLs:     acc.opensFromMQLs + s.opensFromMQLs,
    repliesFromMQLs:   acc.repliesFromMQLs + s.repliesFromMQLs,
  }), { mqls:0, high:0, medium:0, low:0, demoBooked:0, demoDone:0, opp:0, mqlsViaInstantly:0, emailsSentToMQLs:0, opensFromMQLs:0, repliesFromMQLs:0 })

  return NextResponse.json({ owners, totals, dateRange: { start, end } })
}
