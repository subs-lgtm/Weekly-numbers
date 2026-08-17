import { type NextRequest, NextResponse } from 'next/server'

/**
 * Sales Performance API — lives inside the weekly-marketing-numbers-recovered app
 * so /api/sales-performance resolves correctly from the dashboard pages.
 */

export const maxDuration = 60

const HS_BASE = 'https://api.hubspot.com'
const HUBSPOT_KEY = process.env.HUBSPOT_API_KEY!

const SDR_POOL: Record<string, { name: string }> = {
  '79356446':  { name: 'Priyanka' },
  '80445580':  { name: 'Harshini' },
  '84992427':  { name: 'Naveedh' },
  '82937730':  { name: 'Arko' },
  '86814642':  { name: 'Bharath' },
  '87062975':  { name: 'Kushal' },
  '86891194':  { name: 'Shefali' },
  '91998497':  { name: 'Ashish Mali' },
  '92317016':  { name: 'Kaushik' },
  '91353602':  { name: 'Pooja' },
  '83011296':  { name: 'Ravi K' },
}

const PROPS = [
  'email', 'firstname', 'lastname', 'company',
  'hs_lead_status', 'lifecyclestage', 'createdate', 'hubspot_owner_id',
  'lsa_lead_score_category', 'lyzr_lead_score_category',
  'hs_last_sales_activity_timestamp', 'notes_last_contacted', 'num_contacted_notes',
]

const JUNK_STATUSES = new Set(['Junk Lead', 'UNQUALIFIED', 'Discarded'])

async function searchAll(filterGroups: object[]) {
  const all: Array<Record<string, unknown>> = []
  let after: string | undefined
  while (true) {
    const body: Record<string, unknown> = { filterGroups, properties: PROPS, limit: 100 }
    if (after) body.after = after
    const res = await fetch(`${HS_BASE}/crm/v3/objects/contacts/search`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${HUBSPOT_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.status === 429) { await new Promise(r => setTimeout(r, 1100)); continue }
    if (!res.ok) throw new Error(`HubSpot ${res.status}`)
    const data = await res.json() as { results: Array<Record<string, unknown>>; paging?: { next?: { after: string } } }
    all.push(...(data.results || []))
    if (data.paging?.next?.after) { after = data.paging.next.after; await new Promise(r => setTimeout(r, 150)) }
    else break
  }
  return all
}

function getPrio(c: Record<string, unknown>) {
  const p = (c.properties as Record<string, string>)
  const v = p?.lsa_lead_score_category || p?.lyzr_lead_score_category || ''
  if (v === 'high_priority') return 'high'
  if (v === 'medium_priority') return 'medium'
  return 'low'
}

function detail(c: Record<string, unknown>, hrs: number | null) {
  const p = c.properties as Record<string, string>
  const created = new Date(p.createdate || Date.now())
  return {
    id: c.id as string,
    name: [p.firstname, p.lastname].filter(Boolean).join(' ') || '—',
    email: p.email || '—', company: p.company || '—',
    status: p.hs_lead_status || 'OPEN', priority: getPrio(c),
    created: created.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    daysAgo: Math.floor((Date.now() - created.getTime()) / 86400000),
    respondedHrs: hrs, hubspotUrl: `https://app.hubspot.com/contacts/${c.id}`,
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const endTs   = url.searchParams.get('end')   ? new Date(url.searchParams.get('end')!   + 'T23:59:59Z').getTime() : Date.now()
  const startTs = url.searchParams.get('start') ? new Date(url.searchParams.get('start')! + 'T00:00:00Z').getTime() : endTs - 60 * 86400000

  try {
    const ownerContacts: Record<string, Array<Record<string, unknown>>> = {}
    await Promise.all(Object.entries(SDR_POOL).map(async ([ownerId]) => {
      ownerContacts[ownerId] = await searchAll([{ filters: [
        { propertyName: 'hubspot_owner_id', operator: 'EQ', value: ownerId },
        { propertyName: 'lead_form_type',   operator: 'CONTAINS_TOKEN', value: 'Book a Demo' },
        { propertyName: 'createdate',       operator: 'GTE', value: String(startTs) },
        { propertyName: 'createdate',       operator: 'LTE', value: String(endTs) },
        { propertyName: 'email',            operator: 'NOT_CONTAINS_TOKEN', value: 'lyzr.ai' },
      ]}])
      await new Promise(r => setTimeout(r, 100))
    }))

    const junkRaw = await searchAll(
      ['Junk Lead', 'UNQUALIFIED', 'Discarded'].map(s => ({ filters: [
        { propertyName: 'hs_lead_status',  operator: 'EQ', value: s },
        { propertyName: 'lead_form_type',  operator: 'CONTAINS_TOKEN', value: 'Book a Demo' },
        { propertyName: 'createdate',      operator: 'GTE', value: String(startTs) },
        { propertyName: 'createdate',      operator: 'LTE', value: String(endTs) },
        { propertyName: 'email',           operator: 'NOT_CONTAINS_TOKEN', value: 'lyzr.ai' },
      ]}))
    )
    const junkByOwner: Record<string, Array<Record<string, unknown>>> = {}
    for (const c of junkRaw) {
      const oid = (c.properties as Record<string, string>)?.hubspot_owner_id || 'unknown'
      if (!junkByOwner[oid]) junkByOwner[oid] = []
      junkByOwner[oid].push(c)
    }

    const owners = Object.entries(SDR_POOL).map(([ownerId, { name }]) => {
      const contacts = ownerContacts[ownerId] || []
      const junkContacts = junkByOwner[ownerId] || []
      const sla = {
        high:   { assigned:0,responded:0,noReply:0,w24:0,times:[] as number[] },
        medium: { assigned:0,responded:0,noReply:0,w24:0,times:[] as number[] },
        low:    { assigned:0,responded:0,noReply:0,w24:0,times:[] as number[] },
      }
      const funnel = { open:0,working:0,demoBooked:0,demoCompleted:0,noShow:0,cancelled:0,ghosting:0,disqualified:0,stalled:0,opp:0,customer:0,junk:0 }
      const drill = { noReply:[] as ReturnType<typeof detail>[],responded:[] as ReturnType<typeof detail>[],working:[] as ReturnType<typeof detail>[],demoBooked:[] as ReturnType<typeof detail>[],demoCompleted:[] as ReturnType<typeof detail>[],opp:[] as ReturnType<typeof detail>[],customer:[] as ReturnType<typeof detail>[] }

      for (const c of contacts) {
        const p = c.properties as Record<string, string>
        const prio = getPrio(c) as 'high'|'medium'|'low'
        const status = p.hs_lead_status || 'OPEN'
        const lc = p.lifecyclestage || ''
        const created = new Date(p.createdate).getTime()
        const sp = sla[prio]; sp.assigned++
        if (status === 'OPEN') funnel.open++
        else if (status === 'Working') funnel.working++
        else if (status === 'Demo Booked') funnel.demoBooked++
        else if (status === 'Demo Completed' || status === 'Demo Completed - PLG') funnel.demoCompleted++
        else if (status === 'Demo no show') funnel.noShow++
        else if (status === 'Demo Cancelled by Client') funnel.cancelled++
        else if (status === 'Demo Completed - Ghosting') funnel.ghosting++
        else if (status === 'Demo Completed - Disqualified') funnel.disqualified++
        else if (status === 'Stalled') funnel.stalled++
        if (JUNK_STATUSES.has(status)) funnel.junk++
        if (lc === 'opportunity' || lc === '249550600') funnel.opp++
        if (lc === 'customer') funnel.customer++
        const actTs = p.hs_last_sales_activity_timestamp ? new Date(p.hs_last_sales_activity_timestamp).getTime() : null
        const hrs = (actTs && actTs > created) ? Math.round((actTs - created) / 3600000) : null
        if (hrs !== null) { sp.responded++; sp.times.push(hrs); if (hrs <= 24) sp.w24++; drill.responded.push(detail(c,hrs)) }
        else { sp.noReply++; drill.noReply.push(detail(c,null)) }
        const det = detail(c, hrs)
        if (status === 'Working') drill.working.push(det)
        if (status === 'Demo Booked') drill.demoBooked.push(det)
        if (status === 'Demo Completed' || status === 'Demo Completed - PLG') drill.demoCompleted.push(det)
        if (lc === 'opportunity' || lc === '249550600') drill.opp.push(det)
        if (lc === 'customer') drill.customer.push(det)
      }

      function calc(sp: typeof sla.high) {
        const s = [...sp.times].sort((a,b)=>a-b)
        return { ...sp, avg: s.length?Math.round(s.reduce((x,h)=>x+h,0)/s.length):0, median: s.length?Math.round(s[Math.floor(s.length/2)]):0, times: undefined }
      }
      const allTimes = [...sla.high.times,...sla.medium.times,...sla.low.times]
      const allSorted = [...allTimes].sort((a,b)=>a-b)
      const slaStats = { high:calc(sla.high), medium:calc(sla.medium), low:calc(sla.low), all:{
        assigned:sla.high.assigned+sla.medium.assigned+sla.low.assigned,
        responded:sla.high.responded+sla.medium.responded+sla.low.responded,
        noReply:sla.high.noReply+sla.medium.noReply+sla.low.noReply,
        w24:sla.high.w24+sla.medium.w24+sla.low.w24,
        avg:allTimes.length?Math.round(allTimes.reduce((s,h)=>s+h,0)/allTimes.length):0,
        median:allSorted.length?Math.round(allSorted[Math.floor(allSorted.length/2)]):0,
      }}

      const junkBuckets = {j0:0,j1:0,j2:0,j3plus:0}
      const junkDetails: Array<ReturnType<typeof detail> & {emailsBeforeJunk:number}> = []
      for (const c of junkContacts) {
        const n = parseInt((c.properties as Record<string,string>).num_contacted_notes || '0')
        if (n===0) junkBuckets.j0++; else if (n===1) junkBuckets.j1++; else if (n===2) junkBuckets.j2++; else junkBuckets.j3plus++
        junkDetails.push({...detail(c,null), emailsBeforeJunk:n})
      }

      // Fetch noShow contacts for this owner with reachout data
      const noShowLeads = contacts.filter(c => (c.properties as Record<string,string>).hs_lead_status === 'Demo no show')
      const noShowWithReachout = noShowLeads.filter(c => {
        const p = c.properties as Record<string,string>
        return parseInt(p.num_contacted_notes || '0') > 0
      })

      return { ownerId, name, sla:slaStats, funnel, junk:{total:junkContacts.length,...junkBuckets,details:junkDetails.slice(0,50)},
        noShow: {
          total: noShowLeads.length,
          reachouts: noShowWithReachout.length,
          details: noShowLeads.slice(0,50).map(c => {
            const p = c.properties as Record<string,string>
            return {
              ...detail(c, null),
              contactedCount: parseInt(p.num_contacted_notes || '0'),
              lastContacted: p.notes_last_contacted || null,
            }
          }),
        },
        drill:{ noReply:drill.noReply.slice(0,50), responded:drill.responded.slice(0,50), working:drill.working.slice(0,50), demoBooked:drill.demoBooked.slice(0,50), demoCompleted:drill.demoCompleted.slice(0,50), opp:drill.opp.slice(0,50), customer:drill.customer.slice(0,50) }}
    })

    const totals = owners.reduce((acc,o)=>({
      assigned:acc.assigned+o.sla.all.assigned, responded:acc.responded+o.sla.all.responded,
      noReply:acc.noReply+o.sla.all.noReply, w24:acc.w24+o.sla.all.w24,
      demoBooked:acc.demoBooked+o.funnel.demoBooked, demoCompleted:acc.demoCompleted+o.funnel.demoCompleted,
      opp:acc.opp+o.funnel.opp, customer:acc.customer+o.funnel.customer, junk:acc.junk+o.junk.total,
    }), {assigned:0,responded:0,noReply:0,w24:0,demoBooked:0,demoCompleted:0,opp:0,customer:0,junk:0})

    return NextResponse.json({ ok:true, dateRange:{start:new Date(startTs).toISOString().slice(0,10),end:new Date(endTs).toISOString().slice(0,10)}, totals, owners },
      { headers:{'Cache-Control':'s-maxage=300, stale-while-revalidate=60'} })
  } catch(e) {
    return NextResponse.json({error:(e as Error).message},{status:500})
  }
}
