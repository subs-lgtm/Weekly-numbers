import { NextRequest, NextResponse, after } from 'next/server'
import { gzipSync, gunzipSync } from 'zlib'
import { STUDIO_DEALS_PIPELINE_ID, MARKETING_DEAL_SOURCES, STAGE_INFO, resolveChannel } from '@/lib/marketing-opportunities'

const HUBSPOT_API_BASE = 'https://api.hubapi.com'

// Optional caching via Firebase Admin — fails gracefully if not configured
let cacheDb: any = null
function getCacheDb() {
  if (cacheDb !== undefined && cacheDb !== null) return cacheDb
  try {
    const { initializeApp, getApps, cert } = require('firebase-admin/app')
    const { getFirestore } = require('firebase-admin/firestore')
    const SA_EMAIL = process.env.SA_CLIENT_EMAIL || ''
    const SA_KEY = (process.env.SA_PRIVATE_KEY || '').replace(/\\n/g, '\n')
    const PROJECT_ID = process.env.GCP_PROJECT_ID || 'abm-agent'
    if (!SA_EMAIL || !SA_KEY) { cacheDb = null; return null }
    const appName = 'mql-cache'
    const existing = getApps().find((a: any) => a.name === appName)
    const app = existing || initializeApp({ credential: cert({ projectId: PROJECT_ID, clientEmail: SA_EMAIL, privateKey: SA_KEY }) }, appName)
    cacheDb = getFirestore(app)
    return cacheDb
  } catch { cacheDb = null; return null }
}

// Cache entries are gzip-compressed Buffers. Two separate bugs used to make every mode=all write fail silently
// (so the Leads page was recomputed from HubSpot on every load, 10-50s per range): (1) the result carries
// `undefined` fields (funnel.closed_won_count), which Firestore rejects, and (2) uncompressed month ranges are
// 3MB+, over Firestore's 1MiB document limit. JSON round-trip drops the undefineds; gzip brings months to ~300KB.
const STALE_MAX_MS = 24 * 3600 * 1000 // a current-period entry older than 1h is served instantly, then refreshed in the background

async function getCachedEntry(start: string, end: string): Promise<{ result: any; ageMs: number; past: boolean } | null> {
  try {
    const db = getCacheDb()
    if (!db) return null
    const doc = await db.collection('mql_cache').doc(`${start}_${end}`).get()
    if (!doc.exists) return null
    const data = doc.data()!
    const cachedAt = data.cachedAt?.toDate?.() || new Date(0)
    const now = new Date()
    const result = data.gz ? JSON.parse(gunzipSync(Buffer.from(data.gz)).toString('utf8')) : data.result
    if (!result) return null
    return { result, ageMs: now.getTime() - cachedAt.getTime(), past: new Date(end + 'T00:00:00Z') < now }
  } catch { return null }
}

async function setCache(start: string, end: string, result: any): Promise<void> {
  try {
    const db = getCacheDb()
    if (!db) return
    const gz = gzipSync(Buffer.from(JSON.stringify(result), 'utf8'))
    await db.collection('mql_cache').doc(`${start}_${end}`).set({ gz, cachedAt: new Date(), start, end })
  } catch (e: any) { console.error('[mqls] cache write failed', start, String(e?.message).slice(0, 200)) }
}

async function searchAll(
  apiKey: string,
  filterGroups: object[],
  properties: string[],
): Promise<any[]> {
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
      const err = await res.text()
      // Rate limit — wait and retry once
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 1100))
        continue
      }
      throw new Error(`HubSpot search failed: ${err.substring(0, 200)}`)
    }

    const data = await res.json()
    results.push(...(data.results || []))
    const nextPage = data.paging?.next?.after
    if (!nextPage || data.results?.length === 0) break
    after = nextPage
    // Small delay between pages to avoid rate limits
    await new Promise(r => setTimeout(r, 150))
  }

  return results
}

export const maxDuration = 300

// "Webinar leads" shown on the Leads page exclude (a) registrations for IN-PERSON events hosted on Luma and
// (b) anything scoring below 50 on lead scoring. HubSpot has no in-person flag, so in-person Luma events are
// matched by title (the Lead Scoring Agent writes "Luma Registration: <event title>" into lsa_lead_source).
// Online Luma webinars are NOT excluded. Add new in-person event titles here as they appear.
const IN_PERSON_LUMA_EVENT = /(agent labs\b|ai made me do it|private sail|sail with siva|off the grid|financial services leadership dinner|leadership dinner|ai leaders'? table|off the record)/i
const WEBINAR_MIN_SCORE = 50

// --- Priority memory -------------------------------------------------------------------------
// HubSpot's live lyzr_lead_score / lyzr_lead_score_category get overwritten by the (lower-scoring) v2 model
// for leads that already had a v1 score (a High at 94 became 60 Medium in HubSpot on 2026-10-05, and whole
// weeks of High leads were rewritten on Sep 21-24). By request (2026-10-05) the dashboard remembers the
// HIGHEST priority it has ever seen for each Book a Demo lead and keeps counting it at that level, so past
// weeks stop shifting. Monotonic: a lead can only move up. Only leads the dashboard has seen are protected;
// the original v1 scores of leads overwritten before this shipped can't be recovered (seed manually).
const PRIORITY_RANK: Record<string, number> = { high_priority: 3, medium_priority: 2, low_priority: 1 }
const rankOf = (c: string) => PRIORITY_RANK[c] || 0

async function applyPriorityMemory(contacts: any[]): Promise<number> {
  try {
    const db = getCacheDb()
    if (!db) return 0
    const targets = contacts.filter(c => (c.properties?.lead_form_type || '').includes('Book a Demo'))
    let upgraded = 0
    for (let i = 0; i < targets.length; i += 200) {
      const chunk = targets.slice(i, i + 200)
      const refs = chunk.map(c => db.collection('mql_priority_memory').doc(String(c.id)))
      const snaps = await db.getAll(...refs)
      const batch = db.batch()
      let writes = 0
      chunk.forEach((c: any, idx: number) => {
        const props = c.properties || (c.properties = {})
        const curCat: string = props.lyzr_lead_score_category || ''
        const curScore = parseFloat(props.lyzr_lead_score || '0') || 0
        const mem = snaps[idx].exists ? snaps[idx].data() : null
        if (mem && rankOf(mem.category) > rankOf(curCat)) {
          // HubSpot now says lower than what we saw before: keep the remembered level and score.
          props.lyzr_lead_score_category = mem.category
          props.lyzr_lead_score = String(mem.score)
          upgraded++
        } else if (!mem || rankOf(curCat) > rankOf(mem.category) || (rankOf(curCat) === rankOf(mem.category) && curScore > (mem.score || 0))) {
          batch.set(refs[idx], { category: curCat, score: curScore, updatedAt: new Date(), ...(mem ? {} : { firstSeen: new Date() }) }, { merge: true })
          writes++
        }
      })
      if (writes) await batch.commit()
    }
    return upgraded
  } catch (e) {
    console.warn('[mqls] priority memory skipped:', (e as Error).message)
    return 0
  }
}

// HubSpot copies a company's lifecycle stage (Opportunity / Customer) onto contacts at that company the moment
// they are created (history source = COMPANIES, "LifecycleChangeToContactUpdate: triggered by companyId") - no
// person and no workflow moved them. Those contacts must not count as converted: 19 of 54 Playbook leads in the
// week of 5 Oct showed as "35% converted to MQL" purely because of this. We flag a contact when the LATEST change to its
// lifecycle stage is that automatic one (a later manual / workflow change clears the flag).
async function flagAutoLifecycle(apiKey: string, contacts: any[]): Promise<Set<string>> {
  const flagged = new Set<string>()
  try {
    const ids = contacts
      .filter(c => !['', 'lead', 'subscriber', 'other'].includes(c.properties?.lifecyclestage || ''))
      .map(c => String(c.id))
      .slice(0, 600)
    for (let i = 0; i < ids.length; i += 50) {
      const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/batch/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertiesWithHistory: ['lifecyclestage'], properties: ['lifecyclestage'], inputs: ids.slice(i, i + 50).map(id => ({ id })) }),
      })
      if (!res.ok) { if (res.status === 429) await new Promise(r => setTimeout(r, 1100)); continue }
      const data = await res.json()
      for (const r of data.results || []) {
        const latest = (r.propertiesWithHistory?.lifecyclestage || [])[0]
        if (latest?.sourceType === 'COMPANIES' && String(latest?.sourceId || '').startsWith('LifecycleChangeToContactUpdate')) flagged.add(String(r.id))
      }
    }
  } catch (e) { console.warn('[mqls] auto-lifecycle check skipped:', (e as Error).message) }
  return flagged
}

// Partner leads are often OLD contacts (e.g. imported from Apollo in June) that the Lead Scoring Agent later tags
// with lead_form_type "Partner Form". createdate never changes, so counting by createdate alone missed them
// (last week: 2 counted, 5 real). This finds contacts created BEFORE the window whose Partner Form tag was added
// DURING it, using the lead_form_type property history. Counted only into by_form_type_contains['Partner Form'].
async function findNewlyTaggedPartnerLeads(apiKey: string, startMs: number, endMs: number): Promise<Array<{ id: string; name: string; company: string; taggedAt: string }>> {
  const out: Array<{ id: string; name: string; company: string; taggedAt: string }> = []
  try {
    const older = await searchAll(apiKey, [{
      filters: [
        { propertyName: 'lead_form_type', operator: 'CONTAINS_TOKEN', value: 'Partner Form' },
        { propertyName: 'createdate', operator: 'LT', value: startMs.toString() },
        { propertyName: 'lastmodifieddate', operator: 'GTE', value: startMs.toString() },
        { propertyName: 'email', operator: 'NOT_CONTAINS_TOKEN', value: 'lyzr.ai' },
      ],
    }], ['createdate'])
    for (let i = 0; i < older.length; i += 50) {
      const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/batch/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertiesWithHistory: ['lead_form_type'], properties: ['firstname', 'lastname', 'company'], inputs: older.slice(i, i + 50).map((c: any) => ({ id: String(c.id) })) }),
      })
      if (!res.ok) { if (res.status === 429) await new Promise(r => setTimeout(r, 1100)); continue }
      const data = await res.json()
      for (const c of data.results || []) {
        const hist = [...(c.propertiesWithHistory?.lead_form_type || [])].sort((a: any, b: any) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
        let had = false
        for (const e of hist) {
          const has = String(e.value || '').split(';').map((x: string) => x.trim()).includes('Partner Form')
          const t = Date.parse(e.timestamp)
          if (has && !had && t >= startMs && t < endMs) {
            out.push({ id: String(c.id), name: [c.properties?.firstname, c.properties?.lastname].filter(Boolean).join(' '), company: c.properties?.company || '', taggedAt: e.timestamp })
          }
          had = has
        }
      }
    }
  } catch (e) { console.warn('[mqls] partner re-tag check skipped:', (e as Error).message) }
  return out
}

// Demo Booked / Demo Completed from the HubSpot MEETINGS object (not hs_lead_status, not lifecycle stage).
// For each lead that has a meeting we read its associated meetings and take the latest one: outcome
// (COMPLETED / NO_SHOW / CANCELED / RESCHEDULED / SCHEDULED), when it is/was, and the SDR's notes
// (hs_internal_meeting_notes first, else the latest note a person wrote on the contact). SDRs almost never set the
// outcome in HubSpot (Sep 2026: 0 of 131 meetings were marked COMPLETED), so a meeting whose time has PASSED and was not
// cancelled / rescheduled / marked no-show counts as HELD (demo took place). Confirmed COMPLETED is reported separately.
type MeetingStatus = 'completed' | 'held' | 'no_show' | 'canceled' | 'upcoming'
async function fetchMeetingDetails(apiKey: string, contactIds: string[], ownerMap: Record<string, string>) {
  const post = async (url: string, body: any) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`${HUBSPOT_API_BASE}${url}`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.status === 429) { await new Promise(r => setTimeout(r, 1100)); continue }
      return res.ok ? res.json() : { results: [] }
    }
    return { results: [] }
  }
  const meetingIdsOf = new Map<string, string[]>()
  const all = new Set<string>()
  for (let i = 0; i < contactIds.length; i += 100) {
    const data = await post('/crm/v4/associations/contacts/meetings/batch/read', { inputs: contactIds.slice(i, i + 100).map(id => ({ id })) })
    for (const r of data.results || []) {
      const ids = (r.to || []).map((t: any) => String(t.toObjectId))
      if (ids.length) { meetingIdsOf.set(String(r.from.id), ids); ids.forEach((m: string) => all.add(m)) }
    }
  }
  const meetings = new Map<string, any>()
  const ids = Array.from(all)
  for (let i = 0; i < ids.length; i += 100) {
    const data = await post('/crm/v3/objects/meetings/batch/read', {
      properties: ['hs_meeting_outcome', 'hs_meeting_start_time', 'hs_timestamp', 'hs_meeting_title', 'hs_meeting_body', 'hs_internal_meeting_notes', 'hubspot_owner_id', 'hs_lastmodifieddate'],
      inputs: ids.slice(i, i + 100).map(id => ({ id })),
    })
    for (const m of data.results || []) meetings.set(String(m.id), m.properties || {})
  }
  // SDR notes live on the contact as Note records (the meeting's own notes field and body are empty / just the Teams
  // invite). Take the latest note written by a person (owner set); automated notes ("Website chat with Leia") have no owner.
  const noteIdsOf = new Map<string, string[]>()
  const allNotes = new Set<string>()
  for (let i = 0; i < contactIds.length; i += 100) {
    const data = await post('/crm/v4/associations/contacts/notes/batch/read', { inputs: contactIds.slice(i, i + 100).map(id => ({ id })) })
    for (const r of data.results || []) {
      const nids = (r.to || []).map((t: any) => String(t.toObjectId))
      if (nids.length) { noteIdsOf.set(String(r.from.id), nids); nids.forEach((n: string) => allNotes.add(n)) }
    }
  }
  const notes = new Map<string, any>()
  const nidList = Array.from(allNotes)
  for (let i = 0; i < nidList.length; i += 100) {
    const data = await post('/crm/v3/objects/notes/batch/read', { properties: ['hs_note_body', 'hs_timestamp', 'hubspot_owner_id'], inputs: nidList.slice(i, i + 100).map(id => ({ id })) })
    for (const n of data.results || []) notes.set(String(n.id), n.properties || {})
  }
  const decode = (t: string) => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
  const strip = (t: string) => decode((t || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')).replace(/\s+/g, ' ').trim()
  const latestNote = (contactId: string) => {
    const list = (noteIdsOf.get(contactId) || []).map(id => notes.get(id)).filter(Boolean)
      .map((p: any) => ({ p, t: Date.parse(p.hs_timestamp || '') || 0, body: strip(p.hs_note_body) }))
      .filter(x => x.body)
      .sort((a, b) => b.t - a.t)
    return list.find(x => x.p.hubspot_owner_id) || null
  }
  const out = new Map<string, { status: MeetingStatus; completedAny: boolean; meetingAt: string | null; title: string; notes: string; noteBy: string; noteAt: string | null; outcome: string; meetingCount: number }>()
  meetingIdsOf.forEach((mids, contactId) => {
    const list = mids.map(id => ({ id, p: meetings.get(id) })).filter(x => x.p)
      .map(x => ({ ...x, t: Date.parse(x.p.hs_meeting_start_time || x.p.hs_timestamp || '') || 0 }))
      .sort((a, b) => b.t - a.t)
    if (!list.length) return
    const statusOf = (p: any, t: number): MeetingStatus => {
      const o = String(p.hs_meeting_outcome || '').toUpperCase()
      if (o === 'COMPLETED') return 'completed'
      if (o === 'NO_SHOW') return 'no_show'
      if (o === 'CANCELED' || o === 'RESCHEDULED') return 'canceled'
      return t > Date.now() ? 'upcoming' : 'held'
    }
    const statuses = list.map(x => statusOf(x.p, x.t))
    // Contact-level status: a confirmed completion wins, then a held meeting, then no-show, then upcoming, else cancelled only.
    const contactStatus: MeetingStatus = statuses.includes('completed') ? 'completed' : statuses.includes('held') ? 'held'
      : statuses.includes('no_show') ? 'no_show' : statuses.includes('upcoming') ? 'upcoming' : 'canceled'
    const completedAny = contactStatus === 'completed'
    // Headline = the most recent meeting that produced the contact-level status.
    const live = list.find((x, i) => statuses[i] === contactStatus) || list[0]
    const meetingNotes = strip((list.find(x => strip(x.p.hs_internal_meeting_notes))?.p || {}).hs_internal_meeting_notes)
    const ln = latestNote(contactId)
    const text = meetingNotes || ln?.body || ''
    out.set(contactId, {
      status: contactStatus,
      completedAny,
      meetingAt: live.t ? new Date(live.t).toISOString() : null,
      title: strip(live.p.hs_meeting_title),
      notes: text.slice(0, 420),
      noteBy: meetingNotes ? (ownerMap[String(live.p.hubspot_owner_id)] || '') : (ownerMap[String(ln?.p.hubspot_owner_id)] || ''),
      noteAt: !meetingNotes && ln?.t ? new Date(ln.t).toISOString() : null,
      outcome: String(live.p.hs_meeting_outcome || ''),
      meetingCount: list.length,
    })
  })
  return out
}

// Which playbook / asset a Playbook Download lead took. HubSpot keeps it in the form-submission event name
// ("How to take agents to production playbook | Lyzr AI: #agents_to_production .elementor-form"); LinkedIn lead-gen leads
// instead carry it in the campaign name ("Agent in Production Whitepaper|Technical Heads|Lead gen - 19 Aug'26"). Falls back to the page slug.
function playbookOf(p: any): string {
  if (!String(p.lead_form_type || '').split(';').map((x: string) => x.trim()).includes('Playbook Download')) return ''
  const ev = String(p.recent_conversion_event_name || '').trim()
  if (ev) return ev.split(' | ')[0].replace(/:\s*#.*$/, '').replace(/:\s*[^:]*(template form|\.elementor-form|form)\s*$/i, '').trim()
  // A LinkedIn campaign name only counts as a playbook name when it actually names an asset (not an ad audience like "Retargeting Aud").
  const camp = String(p.lead_campaign_name || '').split('|')[0].trim()
  if (camp && /whitepaper|playbook|checklist|guide|ebook|e-book|report|blueprint|use cases|template/i.test(camp)) return camp
  const m = String(p.hs_analytics_last_url || '').match(/\/(?:playbook|template)\/([^/?#]+)/i)
  return m ? m[1].replace(/-/g, ' ') : 'name not recorded in HubSpot'
}

// Marketing-lead filter for the meeting activity counts: the contact came through a marketing form other than Agent Studio
// (Book a Demo, Playbook, Contact Us, Partner Form, GSI and SI, Webinar ...). Excludes outbound / Apollo / Agent Studio-only
// product users (the sales team books many meetings with those), and internal / test contacts.
function isMarketingLead(p: any): boolean {
  const forms = String(p.lead_form_type || '').split(';').map((x: string) => x.trim()).filter(Boolean)
  if (!forms.some(f => f !== 'Agent Studio')) return false
  const email = String(p.email || '').toLowerCase()
  if (email.includes('lyzr.ai')) return false
  const name = `${p.firstname || ''} ${p.lastname || ''}`
  if (/\btest\b|\(ignore\)/i.test(name) || /^lyzr/i.test(String(p.company || ''))) return false
  return true
}

// ACTIVITY-BASED meetings for the selected period (what leadership counts weekly): independent of when the LEAD was created.
//   Booked    = unique leads with a meeting BOOKED (meeting record created) inside [start, end), not cancelled / rescheduled.
//   Completed = unique leads with a meeting that TOOK PLACE (start time inside [start, end) and already past) that was not
//               cancelled / rescheduled / marked no-show. SDRs rarely set the outcome, so held meetings count; confirmed
//               COMPLETED ones are reported separately.
// Lead type is not filtered (a Playbook lead who books a demo counts); @lyzr.ai contacts are excluded.
async function fetchMeetingActivity(apiKey: string, startMs: number, endMs: number, ownerMap: Record<string, string>) {
  // Strict: retry rate limits / 5xx with backoff and THROW if it still fails, so a transient HubSpot error can never be
  // turned into a "0" that gets cached (the caller catches, returns null and the result is not cached).
  const post = async (url: string, body: any) => {
    let last = 0
    for (let attempt = 0; attempt < 6; attempt++) {
      const res = await fetch(`${HUBSPOT_API_BASE}${url}`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) return res.json()
      last = res.status
      if (res.status === 429 || res.status >= 500) { await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); continue }
      break
    }
    throw new Error(`HubSpot ${url} failed: ${last}`)
  }
  const MP = ['hs_meeting_outcome', 'hs_meeting_start_time', 'hs_timestamp', 'hs_createdate', 'hs_meeting_title', 'hs_internal_meeting_notes', 'hubspot_owner_id']
  const searchMeetings = async (prop: 'hs_createdate' | 'hs_timestamp') => {
    const out: any[] = []
    let after: string | undefined
    while (true) {
      const body: any = { filterGroups: [{ filters: [{ propertyName: prop, operator: 'GTE', value: String(startMs) }, { propertyName: prop, operator: 'LT', value: String(endMs) }] }], properties: MP, limit: 100 }
      if (after) body.after = after
      const d = await post('/crm/v3/objects/meetings/search', body)
      out.push(...(d.results || []))
      after = d.paging?.next?.after
      if (!after) break
    }
    return out
  }
  const [created, started] = await Promise.all([searchMeetings('hs_createdate'), searchMeetings('hs_timestamp')])
  const meetings = new Map<string, any>()
  for (const m of [...created, ...started]) meetings.set(String(m.id), m.properties || {})
  const ids = Array.from(meetings.keys())
  const empty = { booked: 0, completed: 0, completed_confirmed: 0, held_unconfirmed: 0, no_show: 0, upcoming: 0, details: [] as any[] }
  if (!ids.length) return empty

  const contactsOf = new Map<string, string[]>()
  for (let i = 0; i < ids.length; i += 100) {
    const d = await post('/crm/v4/associations/meetings/contacts/batch/read', { inputs: ids.slice(i, i + 100).map(id => ({ id })) })
    for (const r of d.results || []) contactsOf.set(String(r.from.id), (r.to || []).map((t: any) => String(t.toObjectId)))
  }
  const cids = Array.from(new Set(Array.from(contactsOf.values()).flat()))
  const contacts = new Map<string, any>()
  for (let i = 0; i < cids.length; i += 100) {
    const d = await post('/crm/v3/objects/contacts/batch/read', { properties: ['email', 'firstname', 'lastname', 'company', 'jobtitle', 'message', 'platform_tools', 'lead_source_category', 'lead_form_type', 'hs_object_source_detail_1', 'hs_analytics_source', 'utm_source', 'utm_medium', 'recent_conversion_event_name', 'lead_campaign_name', 'hs_analytics_last_url'], inputs: cids.slice(i, i + 100).map(id => ({ id })) })
    for (const c of d.results || []) if (isMarketingLead(c.properties || {})) contacts.set(String(c.id), c.properties || {})
  }

  // SDR notes: latest Note record written by a person on the contact (the meeting's own notes/body are empty or just the Teams invite).
  const noteIdsOf = new Map<string, string[]>()
  const allNotes = new Set<string>()
  const cl = Array.from(contacts.keys())
  for (let i = 0; i < cl.length; i += 100) {
    const d = await post('/crm/v4/associations/contacts/notes/batch/read', { inputs: cl.slice(i, i + 100).map(id => ({ id })) })
    for (const r of d.results || []) { const n = (r.to || []).map((t: any) => String(t.toObjectId)); if (n.length) { noteIdsOf.set(String(r.from.id), n); n.forEach((x: string) => allNotes.add(x)) } }
  }
  const notes = new Map<string, any>()
  const nl = Array.from(allNotes)
  for (let i = 0; i < nl.length; i += 100) {
    const d = await post('/crm/v3/objects/notes/batch/read', { properties: ['hs_note_body', 'hs_timestamp', 'hubspot_owner_id'], inputs: nl.slice(i, i + 100).map(id => ({ id })) })
    for (const n of d.results || []) notes.set(String(n.id), n.properties || {})
  }
  const decode = (t: string) => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
  const strip = (t: string) => decode((t || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ')).replace(/\s+/g, ' ').trim()
  const latestNote = (cid: string) => (noteIdsOf.get(cid) || []).map(id => notes.get(id)).filter(Boolean)
    .map((p: any) => ({ p, t: Date.parse(p.hs_timestamp || '') || 0, body: strip(p.hs_note_body) }))
    .filter(x => x.body && x.p.hubspot_owner_id).sort((a, b) => b.t - a.t)[0] || null

  type Agg = { booked: boolean; held: boolean; confirmed: boolean; noShow: boolean; upcoming: boolean; heldAt: number; bookedMeetingAt: number; bookedAt: number; internalNotes: string; owner: string }
  const agg = new Map<string, Agg>()
  const now = Date.now()
  meetings.forEach((p, mid) => {
    const outcome = String(p.hs_meeting_outcome || '').toUpperCase()
    if (outcome === 'CANCELED' || outcome === 'RESCHEDULED') return
    const startAt = Date.parse(p.hs_meeting_start_time || p.hs_timestamp || '') || 0
    const createdAt = Date.parse(p.hs_createdate || '') || 0
    const isBooked = createdAt >= startMs && createdAt < endMs
    const inStartRange = startAt >= startMs && startAt < endMs
    const isHeld = inStartRange && startAt < now && outcome !== 'NO_SHOW'
    const isNoShow = inStartRange && outcome === 'NO_SHOW'
    for (const cid of contactsOf.get(mid) || []) {
      if (!contacts.has(cid)) continue
      const a = agg.get(cid) || { booked: false, held: false, confirmed: false, noShow: false, upcoming: false, heldAt: 0, bookedMeetingAt: 0, bookedAt: 0, internalNotes: '', owner: '' }
      if (isBooked && outcome !== 'NO_SHOW') { a.booked = true; if (createdAt >= a.bookedAt) { a.bookedAt = createdAt; a.bookedMeetingAt = startAt } if (startAt > now) a.upcoming = true }
      if (isHeld) { a.held = true; if (outcome === 'COMPLETED') a.confirmed = true; if (startAt >= a.heldAt) { a.heldAt = startAt; a.owner = ownerMap[String(p.hubspot_owner_id)] || a.owner } }
      if (isNoShow) a.noShow = true
      const inotes = strip(p.hs_internal_meeting_notes)
      if (inotes && !a.internalNotes) a.internalNotes = inotes
      agg.set(cid, a)
    }
  })

  const details: any[] = []
  agg.forEach((a, cid) => {
    if (!a.booked && !a.held && !a.noShow) return
    const c = contacts.get(cid)
    const ln = a.internalNotes ? null : latestNote(cid)
    const status = a.held ? (a.confirmed ? 'completed' : 'held') : a.noShow ? 'no_show' : (a.upcoming ? 'upcoming' : 'held')
    const sourceCat = c.lead_source_category || ''
    details.push({
      id: cid,
      name: [c.firstname, c.lastname].filter(Boolean).join(' ') || '—',
      company: c.company || '—', jobTitle: c.jobtitle || '—',
      message: (c.message || '').trim().slice(0, 600), platformTools: (c.platform_tools || '').trim(),
      ads: sourceCat === 'Paid Campaigns' || sourceCat === 'Paid Search / Paid Social',
      formType: String(c.lead_form_type || ''), createdVia: String(c.hs_object_source_detail_1 || ''),
      channel: resolveChannel(c), playbook: playbookOf(c), campaign: String(c.lead_campaign_name || '').trim(),
      booked: a.booked, held: a.held, status,
      meetingAt: new Date(a.held ? a.heldAt : (a.bookedMeetingAt || a.heldAt)).toISOString(),
      bookedAt: a.bookedAt ? new Date(a.bookedAt).toISOString() : null,
      notes: (a.internalNotes || ln?.body || '').slice(0, 420),
      noteBy: a.internalNotes ? a.owner : (ownerMap[String(ln?.p.hubspot_owner_id)] || ''),
      noteAt: !a.internalNotes && ln?.t ? new Date(ln.t).toISOString() : null,
    })
  })
  const heldRows = details.filter(d => d.held)
  return {
    booked: details.filter(d => d.booked).length,
    completed: heldRows.length,
    completed_confirmed: heldRows.filter(d => d.status === 'completed').length,
    held_unconfirmed: heldRows.filter(d => d.status === 'held').length,
    no_show: details.filter(d => d.status === 'no_show').length,
    upcoming: details.filter(d => d.booked && !d.held && d.status === 'upcoming').length,
    details,
  }
}

// ACTIVITY-BASED SQL and Opportunity for the selected period (independent of when the LEAD was created):
//   SQL         = unique marketing-form leads that ENTERED the SQL stage (HubSpot internal value 'opportunity') in [start, end),
//                 excluding stage changes HubSpot copied from the company and leads now Discarded.
//   Opportunity = unique marketing-form leads linked to a marketing-sourced Studio Deals deal CREATED in [start, end)
//                 (same deal-based rule as the Executive Dashboard: deal_source in MARKETING_DEAL_SOURCES). The contact's
//                 own lifecycle label is never consulted.
async function fetchPipelineActivity(apiKey: string, startMs: number, endMs: number) {
  // Strict: retry rate limits / 5xx with backoff and THROW if it still fails, so a transient HubSpot error can never be
  // turned into a "0" that gets cached (the caller catches, returns null and the result is not cached).
  const post = async (url: string, body: any) => {
    let last = 0
    for (let attempt = 0; attempt < 6; attempt++) {
      const res = await fetch(`${HUBSPOT_API_BASE}${url}`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok) return res.json()
      last = res.status
      if (res.status === 429 || res.status >= 500) { await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); continue }
      break
    }
    throw new Error(`HubSpot ${url} failed: ${last}`)
  }
  const CP = ['email', 'firstname', 'lastname', 'company', 'jobtitle', 'message', 'platform_tools', 'lead_source_category', 'lead_form_type', 'lifecyclestage', 'hs_v2_date_entered_opportunity', 'hs_analytics_source', 'utm_source', 'utm_medium', 'recent_conversion_event_name', 'lead_campaign_name', 'hs_analytics_last_url']
  const toRow = (id: string, c: any, extra: any = {}) => {
    const src = c.lead_source_category || ''
    return {
      id, name: [c.firstname, c.lastname].filter(Boolean).join(' ') || '—', company: c.company || '—', jobTitle: c.jobtitle || '—',
      message: (c.message || '').trim().slice(0, 600), platformTools: (c.platform_tools || '').trim(),
      ads: src === 'Paid Campaigns' || src === 'Paid Search / Paid Social', formType: String(c.lead_form_type || ''),
      // Acquisition channel (paid signals first, then lead source category, then HubSpot original source) - same rule as the Executive Dashboard.
      channel: resolveChannel(c), playbook: playbookOf(c), campaign: String(c.lead_campaign_name || '').trim(), ...extra,
    }
  }

  // ---- SQL: contacts that entered the SQL stage in the period
  const sqlCandidates: any[] = []
  let after: string | undefined
  while (true) {
    const body: any = { filterGroups: [{ filters: [
      { propertyName: 'hs_v2_date_entered_opportunity', operator: 'GTE', value: String(startMs) },
      { propertyName: 'hs_v2_date_entered_opportunity', operator: 'LT', value: String(endMs) },
    ] }], properties: CP, limit: 100 }
    if (after) body.after = after
    const d = await post('/crm/v3/objects/contacts/search', body)
    sqlCandidates.push(...(d.results || []))
    after = d.paging?.next?.after
    if (!after) break
  }
  const sqlMarketing = sqlCandidates.filter(c => isMarketingLead(c.properties || {}) && (c.properties?.lifecyclestage || '') !== '242934529')
  const fromCompany = new Set<string>()
  for (let i = 0; i < sqlMarketing.length; i += 50) {
    const d = await post('/crm/v3/objects/contacts/batch/read', { propertiesWithHistory: ['lifecyclestage'], properties: ['lifecyclestage'], inputs: sqlMarketing.slice(i, i + 50).map(c => ({ id: String(c.id) })) })
    for (const r of d.results || []) {
      const hit = (r.propertiesWithHistory?.lifecyclestage || []).find((e: any) => e.value === 'opportunity' && Date.parse(e.timestamp) >= startMs && Date.parse(e.timestamp) < endMs)
      if (hit?.sourceType === 'COMPANIES') fromCompany.add(String(r.id))
    }
  }
  const sqlRows = sqlMarketing.filter(c => !fromCompany.has(String(c.id)))
    .map(c => toRow(String(c.id), c.properties || {}, { at: c.properties?.hs_v2_date_entered_opportunity || null }))

  // ---- Opportunity: marketing-sourced Studio deals created in the period -> their marketing-form contacts
  const deals: any[] = []
  after = undefined
  while (true) {
    const body: any = { filterGroups: [{ filters: [
      { propertyName: 'createdate', operator: 'GTE', value: String(startMs) },
      { propertyName: 'createdate', operator: 'LT', value: String(endMs) },
      { propertyName: 'pipeline', operator: 'EQ', value: STUDIO_DEALS_PIPELINE_ID },
      { propertyName: 'deal_source', operator: 'IN', values: Array.from(MARKETING_DEAL_SOURCES) },
    ] }], properties: ['dealname', 'amount', 'dealstage', 'deal_source', 'createdate'], limit: 100 }
    if (after) body.after = after
    const d = await post('/crm/v3/objects/deals/search', body)
    deals.push(...(d.results || []))
    after = d.paging?.next?.after
    if (!after) break
  }
  const oppRows: any[] = []
  let dealCount = 0, dealValue = 0
  if (deals.length) {
    const contactsOfDeal = new Map<string, string[]>()
    for (let i = 0; i < deals.length; i += 100) {
      const d = await post('/crm/v4/associations/deals/contacts/batch/read', { inputs: deals.slice(i, i + 100).map(x => ({ id: String(x.id) })) })
      for (const r of d.results || []) contactsOfDeal.set(String(r.from.id), (r.to || []).map((t: any) => String(t.toObjectId)))
    }
    const cids = Array.from(new Set(Array.from(contactsOfDeal.values()).flat()))
    const contacts = new Map<string, any>()
    for (let i = 0; i < cids.length; i += 100) {
      const d = await post('/crm/v3/objects/contacts/batch/read', { properties: CP, inputs: cids.slice(i, i + 100).map(id => ({ id })) })
      for (const c of d.results || []) if (isMarketingLead(c.properties || {})) contacts.set(String(c.id), c.properties || {})
    }
    const best = new Map<string, any>() // contact -> its largest qualifying deal
    for (const dl of deals) {
      const amt = parseFloat(dl.properties?.amount || '0') || 0
      let counted = false
      for (const cid of contactsOfDeal.get(String(dl.id)) || []) {
        if (!contacts.has(cid)) continue
        counted = true
        const cur = best.get(cid)
        if (!cur || amt > cur.amt) best.set(cid, { dl, amt })
      }
      if (counted) { dealCount++; dealValue += amt }
    }
    best.forEach(({ dl, amt }, cid) => {
      oppRows.push(toRow(cid, contacts.get(cid), {
        at: dl.properties?.createdate || null, dealName: dl.properties?.dealname || '', dealAmount: amt,
        dealStage: STAGE_INFO[String(dl.properties?.dealstage)]?.label || '', dealSource: dl.properties?.deal_source || '',
      }))
    })
  }
  // A lead that moved on to Opportunity (marketing-sourced deal created in the period) is also an SQL for that period -
  // it passed through (or skipped) the SQL stage, so SQL = entered the SQL stage OR got an Opportunity in the period.
  const sqlById = new Map<string, any>(sqlRows.map(r => [r.id, r]))
  for (const o of oppRows) if (!sqlById.has(o.id)) sqlById.set(o.id, { ...o, via: 'opportunity' })
  const sqlAll = Array.from(sqlById.values())
  return {
    sql: { count: sqlAll.length, entered_sql_stage: sqlRows.length, via_opportunity: sqlAll.length - sqlRows.length, details: sqlAll },
    opportunity: { count: oppRows.length, deals: dealCount, value: dealValue, details: oppRows },
  }
}

async function computeGET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  if (!start || !end) {
    return NextResponse.json({ error: 'start and end params required' }, { status: 400 })
  }

  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'HUBSPOT_API_KEY not configured' }, { status: 500 })
  }

  try {
    const mode = searchParams.get('mode') // 'all' = all leads (no form type filter), default = MQLs only
    const noCache = searchParams.get('nocache') === '1'
    const includePipeline = searchParams.get('includePipeline') === '1' // opt-in: adds pipeline $ per source (expensive N+1 deal lookups)
    const includeClosedWon = searchParams.get('includeClosedWon') === '1' // opt-in: which Opportunity+ contacts have an associated Closed Won deal

    // Cache key must vary by includePipeline/includeClosedWon — otherwise a cached response
    // from one flag combination could be served for a request that explicitly asked for the other.
    const cacheKeyPrefix = `${mode === 'all' ? 'v20_all' : 'v20'}${includePipeline ? '_pipeline' : ''}${includeClosedWon ? '_closedwon' : ''}`

    // Check cache first (skip if nocache=1)

    const startMs = new Date(start + 'T00:00:00.000Z').getTime()
    const endMs = new Date(end + 'T00:00:00.000Z').getTime()

    const dateFilters = [
      { propertyName: 'createdate', operator: 'GTE', value: startMs.toString() },
      { propertyName: 'createdate', operator: 'LT', value: endMs.toString() },
      { propertyName: 'email', operator: 'NOT_CONTAINS_TOKEN', value: 'lyzr.ai' },
    ]

    // Fetch all properties needed for both MQL counts and funnel
    const CONTACT_PROPERTIES = [
      'lyzr_lead_score_category',
      'lyzr_lead_score',
      'lead_form_type',
      'lead_source_category',
      'email',
      'firstname',
      'lastname',
      'company',
      'jobtitle',
      'hs_lead_status',
      'hs_latest_meeting_activity',
      'hubspot_owner_id',
      // Funnel stage properties — from lead-analytics-dashboard/lib/hubspot.ts
      'lifecyclestage',    // marketingqualifiedlead, salesqualifiedlead, opportunity, 249550600, customer
      // 'hs_lead_status' already above
      'lsa_booked_demo',   // "Yes" when meeting-booked webhook fires
      'num_associated_deals',
      'createdate',
      'lastmodifieddate',
      // "Why they came in" hover on the Priority Details table: the Book a Demo form's free-text
      // message, the products ticked on that form, and (LinkedIn lead-gen) the campaign name.
      'message',
      'platform_tools',
      'which_platforms_or_tools_are_you_currently_using_or_evaluating', // LinkedIn lead-form question; empty today (nothing syncs it into HubSpot)
      'lead_campaign_name',
      'lead_source',
      // Webinar qualification (Luma in-person events are excluded): which Luma event, if any, a
      // registration came from.
      'lsa_lead_source',
      'lead_first_touch_page',
      // Interaction history for the lead hover (Book a Demo leads only are populated below).
      'hs_analytics_first_url',
      'hs_analytics_last_url',
      'hs_analytics_num_page_views',
      'hs_analytics_num_visits',
      'hs_analytics_source',
      'notes_last_contacted',
      'num_notes',
    ]

    const bookDemoContacts = await searchAll(
      apiKey,
      mode === 'all'
        ? [{ filters: [...dateFilters, { propertyName: 'lead_form_type', operator: 'HAS_PROPERTY' }] }] // All leads with any form type
        : [{ filters: [...dateFilters, { propertyName: 'lead_form_type', operator: 'CONTAINS_TOKEN', value: 'Book a Demo' }] }],
      CONTACT_PROPERTIES,
    )

    // MQLs are strictly marketing-channel leads (lead_form_type = Book a Demo). Contacts
    // entered directly by SDRs/ops (offline imports, no lead_form_type) are intentionally
    // excluded here — they didn't come through a marketing form, so they aren't MQLs by this
    // dashboard's definition, regardless of how they're later qualified in HubSpot.
    const seen = new Set<string>()
    const contacts: any[] = []
    for (const c of bookDemoContacts) {
      if (!seen.has(c.id)) {
        seen.add(c.id)
        contacts.push(c)
      }
    }

    // Fetch all HubSpot owners once and build id→firstName+lastName map
    // Used to resolve hubspot_owner_id to a human-readable name in contactsByPriority
    const ownerMap: Record<string, string> = {}
    try {
      const ownersRes = await fetch(`${HUBSPOT_API_BASE}/crm/v3/owners?limit=100`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (ownersRes.ok) {
        const ownersData = await ownersRes.json()
        for (const o of (ownersData.results || [])) {
          const name = [o.firstName, o.lastName].filter(Boolean).join(' ') || o.email || String(o.id)
          ownerMap[String(o.id)] = name
        }
      }
    } catch { /* non-blocking — owner names will show as '—' if this fails */ }

    let high = 0, medium = 0, low = 0, unknown = 0
    const byFormType: Record<string, number> = {}
    let webinarQualified = 0 // Webinar-primary leads that pass the Luma in-person + score >= 50 rule
    const bySourceCategory: Record<string, number> = {}
    const formTypeBreakdown: Record<string, { working: number; ads: number; website: number }> = {}
    // "Contains" attribution for Partner Form only — per explicit user instruction 2026-09-21
    // ("these partner leads will be having 2 to 3 other lead form types as well like email or a
    // LinkedIn integrated form but that should be counted under partner leads"). byFormType above
    // stays exact-primary-only (formType.split(';')[0]) since MQL/Book-a-Demo counting elsewhere
    // in this dashboard is load-bearing on that exact definition (see CLAUDE.md) — this is a
    // separate, additive counter that credits a contact to 'Partner Form' whenever it appears
    // ANYWHERE in their semicolon-separated lead_form_type, not just when it's first. Scoped to
    // just Partner Form (not e.g. AWS Partner Form) since that's specifically what was reported.
    const CONTAINS_ATTRIBUTED_FORMS = new Set(['Partner Form'])
    const byFormTypeContains: Record<string, number> = {}

    // contacts_by_priority — populated as we loop, returned for click-through drill-down
    const contactsByPriority: Record<string, Array<{
      id: string; name: string; email: string; company: string; jobTitle: string;
      score: number; formType: string; source: string; status: string; owner: string;
    }>> = { high: [], medium: [], low: [], unknown: [] }

    // Funnel — exact same logic as lead-analytics-dashboard/lib/hubspot.ts computeFunnel()
    // lifecyclestage values: marketingqualifiedlead, salesqualifiedlead, opportunity, 249550600 (Opportunity custom), customer
    // hs_lead_status values: Demo Booked, Demo Completed, Demo Completed - PLG, Demo Completed - Disqualified,
    //                        Demo no show, Demo Cancelled by Client, Demo Completed - Ghosting
    let demoBooked = 0
    let demoCompleted = 0
    let demoNoShow = 0
    let sql = 0        // salesqualifiedlead | opportunity | 249550600 | customer
    let opportunity = 0 // 249550600 | customer
    let customer = 0
    let meetingBooked = 0 // contacts with hs_latest_meeting_activity set (actual meeting exists)
    const meetingContactDetails: any[] = []
    let paidMqls = 0 // contacts from paid campaigns (Paid Campaigns or Paid Search / Paid Social)
    let qualifiedMqls = 0 // contacts with lyzr_lead_score > 40
    let workingMqls = 0 // contacts with hs_lead_status = "Working"
    let bookDemoLinkedInAds = 0 // Book a Demo + Email Form leads from Paid Campaigns
    let bookDemoWebsite = 0 // Book a Demo + Email Form leads from non-paid sources
    let mqlStatusNew = 0
    let mqlStatusWorking = 0
    let mqlStatusDemoBooked = 0
    let mqlStatusDemoCompleted = 0
    let mqlStatusSql = 0
    let mqlStatusJunk = 0
    // Per-stage breakdown: working, linkedin ads, website for each funnel stage
    const stageBreakdown: Record<string, { working: number; linkedinAds: number; website: number; total: number }> = {
      mqls: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      new: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      working: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      demo_booked: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      demo_completed: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      sql: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      junk: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      qualified: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      opportunity: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      customer: { working: 0, linkedinAds: 0, website: 0, total: 0 },
    }

    // Pure single-dimension breakdowns -- added 2026-09-07 so the "MQL Qualification Funnel"
    // can be split into two independent tables instead of one merged one. The original
    // mqlStatus*/stageBreakdown bucketing above checks lifecyclestage FIRST (SQL_STAGES_
    // CUMULATIVE) before falling back to hs_lead_status, so a contact who has progressed to
    // SQL but still has a stale hs_lead_status of "Demo Completed" gets silently counted under
    // SQL only -- correct for a single merged funnel, but confusing when someone expects to
    // see every contact whose hs_lead_status literally says "Demo Completed" reflected
    // somewhere. These two breakdowns never cross-check the other property, so each is a
    // complete, honest picture of its own dimension alone -- every MQL appears in exactly one
    // bucket of EACH breakdown, independently.
    let leadStatusNew = 0
    let leadStatusWorking = 0
    let leadStatusDemoBooked = 0
    let leadStatusDemoCompleted = 0
    let leadStatusJunk = 0
    const leadStatusStageBreakdown: Record<string, { working: number; linkedinAds: number; website: number; total: number }> = {
      new: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      working: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      demo_booked: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      demo_completed: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      junk: { working: 0, linkedinAds: 0, website: 0, total: 0 },
    }

    let exactLifecycleMql = 0 // hasn't reached SQL/Opportunity/Customer yet on lifecyclestage
    let exactLifecycleSql = 0
    let exactLifecycleOpportunity = 0
    let exactLifecycleCustomer = 0
    const lifecycleStageBreakdown: Record<string, { working: number; linkedinAds: number; website: number; total: number }> = {
      mql: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      sql: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      opportunity: { working: 0, linkedinAds: 0, website: 0, total: 0 },
      customer: { working: 0, linkedinAds: 0, website: 0, total: 0 },
    }

    // "Intro Call ___" is this portal's current name for the exact same demo-call process as
    // "Demo ___" -- confirmed directly with the user on 2026-09-15 after a real discrepancy
    // (Meetings Booked: 15, Demo Completed/No Show: both 0 for the same week) traced back to
    // the team having switched to this vocabulary without the dashboard's status sets being
    // updated to match. Recognized as synonyms throughout so nothing tracked under the newer
    // names goes uncounted. Mapping follows the existing Demo-family precedent: "Intro
    // Disqualified" sits in DEMO_BOOKED_STATUSES only (a call that happened, tracked as a
    // bad-fit outcome) -- same treatment as "Demo Completed - Disqualified", which is already
    // in DEMO_BOOKED_STATUSES but deliberately excluded from DEMO_COMPLETED_STATUSES.
    const DEMO_BOOKED_STATUSES = new Set([
      'Demo Booked', 'Demo Completed', 'Demo Completed - PLG',
      'Demo Completed - Disqualified', 'Demo no show',
      'Demo Cancelled by Client', 'Demo Completed - Ghosting',
      'Intro Call Booked', 'Intro Call Completed', 'Intro Call No-Show',
      'Intro Qualified', 'Intro Disqualified',
    ])
    const DEMO_COMPLETED_STATUSES = new Set(['Demo Completed', 'Demo Completed - PLG', 'Intro Call Completed', 'Intro Qualified'])
    const DEMO_NO_SHOW_STATUSES = new Set(['Demo no show', 'Intro Call No-Show'])
    // In THIS portal, lifecyclestage's internal values map to custom display labels that don't
    // match the internal names — confirmed directly against the portal's property definition:
    //   lead                    -> "Lead"
    //   marketingqualifiedlead  -> "MQL (Marketing Qualified Lead)"
    //   opportunity             -> "SQL (Sales Qualified Lead)"   <- the literal "SQL" stage
    //   249550600               -> "Opportunity"                  <- the literal "Opportunity" stage
    //   242934529               -> "Discarded" (not a funnel stage at all)
    //   customer                -> "Customer"
    // SQL_EXACT/OPP_EXACT match only the contact's CURRENT stage (what the HubSpot UI's own
    // "Lifecycle stage is [X]" filter does) -- a contact that has since progressed to
    // Opportunity or Customer no longer counts as SQL here. This was deliberately chosen over
    // a cumulative "SQL or beyond" count after a direct user comparison against HubSpot's UI
    // (57 exact vs 75 cumulative for one month) -- see CLAUDE.md/context-handoff.md if either
    // of those numbers looks off again, and confirm which definition is wanted before changing.
    const SQL_EXACT = new Set(['opportunity'])
    const OPP_EXACT = new Set(['249550600'])
    // Cumulative "reached at least this stage" sets -- kept only for the lifecycle_stage_funnel
    // leakage breakdown below (explicitly named "_plus"), where cumulative is the intended,
    // correct semantics for a leakage/waterfall view. Do not use these for the primary
    // funnel.sql/funnel.opportunity counts -- that was the bug that prompted this comment.
    const SQL_STAGES_CUMULATIVE = new Set(['opportunity', '249550600', 'customer'])
    const OPP_STAGES_CUMULATIVE = new Set(['249550600', 'customer'])
    // Any lifecyclestage beyond blank/lead — used for the pure lifecycle-stage leakage funnel
    const MQL_PLUS_STAGES = new Set(['marketingqualifiedlead', 'opportunity', '249550600', 'customer'])
    // hs_lead_status progression for the lead-status leakage funnel (separate from lifecyclestage)
    // "Working or beyond" excludes fresh OPEN and disqualification exits (Junk Lead, UNQUALIFIED)
    const WORKING_OR_BEYOND_STATUSES = new Set([
      'Working', 'Stalled', 'Demo Booked', 'Demo Completed', 'Demo Completed - PLG',
      'Demo Completed - Disqualified', 'Demo no show', 'Demo Cancelled by Client',
      'Demo Completed - Ghosting', 'Associated with a deal',
    ])
    const ASSOCIATED_WITH_DEAL_STATUSES = new Set(['Associated with a deal'])
    // MQL form types that count as "Book a Demo" for the split
    const BOOK_DEMO_FORMS = new Set(['Book a Demo', 'Email Form', 'Pre-Built Agents'])

    // Raw (non-cumulative) distributions — current value counts, for breakdown tables
    const byLifecycleStageRaw: Record<string, number> = {}
    const byLeadStatusRaw: Record<string, number> = {}

    // Lifecycle-stage leakage funnel (pure lifecyclestage property, cumulative/subset)
    let lifecycleMqlPlus = 0
    let exactLifecycleSqlPlus = 0
    let lifecycleOppPlus = 0
    let lifecycleCustomer = 0

    // Lead-status leakage funnel (pure hs_lead_status property, cumulative/subset)
    let statusWorkingPlus = 0
    let statusDemoBookedPlus = 0
    let statusDemoCompletedPlus = 0
    let statusAssociatedWithDeal = 0

    await applyPriorityMemory(contacts)
    const autoLifecycleIds = await flagAutoLifecycle(apiKey, contacts)

    for (const c of contacts) {
      const props = c.properties || {}
      const cat = props.lyzr_lead_score_category || ''
      const formType = props.lead_form_type || 'Other'
      const sourceCat = props.lead_source_category || 'Other'
      const stage = props.lifecyclestage || ''
      const status = props.hs_lead_status || ''
      const hasMeeting = !!props.hs_latest_meeting_activity
      const leadScore = parseFloat(props.lyzr_lead_score || '0')

      if (cat === 'high_priority') high++
      else if (cat === 'medium_priority') medium++
      else if (cat === 'low_priority') low++
      else unknown++

      // Build contact detail record for click-through drill-down
      const contactDetail = {
        id: c.id,
        name: [props.firstname, props.lastname].filter(Boolean).join(' ') || '—',
        email: props.email || '—',
        company: props.company || '—',
        jobTitle: props.jobtitle || '—',
        score: parseFloat(props.lyzr_lead_score || '0'),
        formType: (props.lead_form_type?.split(';')[0] || 'Other').trim(),
        formTypes: (props.lead_form_type || '').split(';').map((s: string) => s.trim()).filter(Boolean),
        source: props.lead_source_category || 'Other',
        status: props.hs_lead_status || '—',
        lifecycleStage: props.lifecyclestage || '—',
        owner: ownerMap[props.hubspot_owner_id] || '—',
        createdate: props.createdate || null,
        lastmodifieddate: props.lastmodifieddate || null,
        demoBooked: DEMO_BOOKED_STATUSES.has(props.hs_lead_status || ''),
        demoCompleted: DEMO_COMPLETED_STATUSES.has(props.hs_lead_status || ''),
        demoNoShow: DEMO_NO_SHOW_STATUSES.has(props.hs_lead_status || ''),
        message: (props.message || '').trim().slice(0, 600),
        platformTools: (props.platform_tools || props.which_platforms_or_tools_are_you_currently_using_or_evaluating || '').trim(),
        campaign: (props.lead_campaign_name || '').trim(),
        webinarExcluded: false as boolean,
        autoLifecycle: autoLifecycleIds.has(String(c.id)),
        leadSource: (props.lead_source || '').trim(),
        // Interaction summary for the Priority Details hover - Book a Demo leads only, to keep the Leads page payload small.
        interaction: (props.lead_form_type || '').includes('Book a Demo') ? {
          originalSource: props.hs_analytics_source || '',
          firstPage: props.hs_analytics_first_url || '',
          lastPage: props.hs_analytics_last_url || '',
          pageViews: parseInt(props.hs_analytics_num_page_views || '0', 10) || 0,
          visits: parseInt(props.hs_analytics_num_visits || '0', 10) || 0,
          lastContacted: props.notes_last_contacted || null,
          salesActivities: parseInt(props.num_notes || '0', 10) || 0,
          latestMeeting: props.hs_latest_meeting_activity || null,
        } : null,
      }
      if (cat === 'high_priority') contactsByPriority.high.push(contactDetail)
      else if (cat === 'medium_priority') contactsByPriority.medium.push(contactDetail)
      else if (cat === 'low_priority') contactsByPriority.low.push(contactDetail)
      else contactsByPriority.unknown.push(contactDetail)

      const primaryForm = (formType.split(';')[0] || 'Other').trim()
      // Merge Pre-Built Agents into Book a Demo
      const normalizedForm = primaryForm === 'Pre-Built Agents' ? 'Book a Demo' : primaryForm
      byFormType[normalizedForm] = (byFormType[normalizedForm] || 0) + 1
      if (normalizedForm === 'Webinar') {
        const inPersonLuma = /^luma registration:/i.test(props.lsa_lead_source || '') && IN_PERSON_LUMA_EVENT.test(props.lsa_lead_source || '')
        if (contactDetail.score >= WEBINAR_MIN_SCORE && !inPersonLuma) webinarQualified++
        else contactDetail.webinarExcluded = true
      }
      bySourceCategory[sourceCat] = (bySourceCategory[sourceCat] || 0) + 1

      // See CONTAINS_ATTRIBUTED_FORMS comment above — credits Partner Form even when it's not
      // the first token in a multi-value lead_form_type (e.g. "Book a Demo;Partner Form").
      for (const key of CONTAINS_ATTRIBUTED_FORMS) {
        if (contactDetail.formTypes.includes(key)) {
          byFormTypeContains[key] = (byFormTypeContains[key] || 0) + 1
        }
      }

      // Per-form-type breakdown: working / ads / website
      if (!formTypeBreakdown[normalizedForm]) formTypeBreakdown[normalizedForm] = { working: 0, ads: 0, website: 0 }
      if (status === 'Working') formTypeBreakdown[normalizedForm].working++
      if (sourceCat === 'Paid Campaigns' || sourceCat === 'Paid Search / Paid Social') formTypeBreakdown[normalizedForm].ads++
      else formTypeBreakdown[normalizedForm].website++

      if (DEMO_BOOKED_STATUSES.has(status)) demoBooked++
      if (DEMO_COMPLETED_STATUSES.has(status)) demoCompleted++
      if (DEMO_NO_SHOW_STATUSES.has(status)) demoNoShow++
      if (SQL_EXACT.has(stage)) sql++
      if (OPP_EXACT.has(stage)) opportunity++
      if (stage === 'customer') customer++
      if (hasMeeting) { meetingBooked++; meetingContactDetails.push(contactDetail) }

      // Raw distributions
      const stageKey = stage || '(blank)'
      const statusKey = status || '(blank)'
      byLifecycleStageRaw[stageKey] = (byLifecycleStageRaw[stageKey] || 0) + 1
      byLeadStatusRaw[statusKey] = (byLeadStatusRaw[statusKey] || 0) + 1

      // Lifecycle-stage leakage funnel (pure lifecyclestage, independent of hs_lead_status)
      if (MQL_PLUS_STAGES.has(stage)) lifecycleMqlPlus++
      if (SQL_STAGES_CUMULATIVE.has(stage)) exactLifecycleSqlPlus++
      if (OPP_STAGES_CUMULATIVE.has(stage)) lifecycleOppPlus++
      if (stage === 'customer') lifecycleCustomer++

      // Lead-status leakage funnel (pure hs_lead_status, independent of lifecyclestage)
      if (WORKING_OR_BEYOND_STATUSES.has(status)) statusWorkingPlus++
      if (DEMO_BOOKED_STATUSES.has(status)) statusDemoBookedPlus++
      if (DEMO_COMPLETED_STATUSES.has(status)) statusDemoCompletedPlus++
      if (ASSOCIATED_WITH_DEAL_STATUSES.has(status)) statusAssociatedWithDeal++
      if (sourceCat === 'Paid Campaigns' || sourceCat === 'Paid Search / Paid Social') paidMqls++
      if (leadScore > 40) qualifiedMqls++
      if (status === 'Working') workingMqls++

      // Book a Demo split: LinkedIn Ads (Paid) vs Website (organic/other)
      // Includes Book a Demo + Email Form + Pre-Built Agents form types
      const isBookDemo = BOOK_DEMO_FORMS.has(primaryForm) || normalizedForm === 'Book a Demo'
      const isPaid = sourceCat === 'Paid Campaigns' || sourceCat === 'Paid Search / Paid Social'
      const isWorking = status === 'Working'
      if (isBookDemo) {
        if (isPaid) bookDemoLinkedInAds++
        else bookDemoWebsite++
      }

      // Determine the single mutually-exclusive bucket for this contact. Deliberately still
      // cumulative here (not SQL_EXACT) -- this table has no separate Opportunity/Customer
      // bucket, so an exact-match would misclassify an already-progressed contact as "New"
      // instead of acknowledging they're qualified at least as far as SQL.
      let bucketKey = 'new'
      if (SQL_STAGES_CUMULATIVE.has(stage)) {
        bucketKey = 'sql'
      } else if (status === 'Junk Lead' || status === 'Unqualified' || status === 'UNQUALIFIED') {
        bucketKey = 'junk'
      } else if (DEMO_COMPLETED_STATUSES.has(status)) {
        bucketKey = 'demo_completed'
      } else if (DEMO_BOOKED_STATUSES.has(status)) {
        bucketKey = 'demo_booked'
      } else if (status === 'Working' || status === 'CONNECTED' || status === 'No reply' || status === 'Associated with a deal') {
        bucketKey = 'working'
      } else {
        bucketKey = 'new'
      }

      // Increment counters
      if (bucketKey === 'sql') mqlStatusSql++
      else if (bucketKey === 'junk') mqlStatusJunk++
      else if (bucketKey === 'demo_completed') mqlStatusDemoCompleted++
      else if (bucketKey === 'demo_booked') mqlStatusDemoBooked++
      else if (bucketKey === 'working') mqlStatusWorking++
      else mqlStatusNew++

      // Increment stage breakdown for this specific bucket
      stageBreakdown[bucketKey].total++
      if (isWorking) stageBreakdown[bucketKey].working++
      if (isPaid) stageBreakdown[bucketKey].linkedinAds++
      else stageBreakdown[bucketKey].website++

      // Increment MQL (total) breakdown as well
      stageBreakdown['mqls'].total++
      if (isWorking) stageBreakdown['mqls'].working++
      if (isPaid) stageBreakdown['mqls'].linkedinAds++
      else stageBreakdown['mqls'].website++

      // Pure hs_lead_status bucket -- lifecyclestage is never consulted here, so a stale
      // lead-status label always shows up honestly, even for a contact who has separately
      // progressed further on lifecyclestage.
      let leadStatusBucketKey: 'new' | 'working' | 'demo_booked' | 'demo_completed' | 'junk' = 'new'
      if (status === 'Junk Lead' || status === 'Unqualified' || status === 'UNQUALIFIED') {
        leadStatusBucketKey = 'junk'
      } else if (DEMO_COMPLETED_STATUSES.has(status)) {
        leadStatusBucketKey = 'demo_completed'
      } else if (DEMO_BOOKED_STATUSES.has(status)) {
        leadStatusBucketKey = 'demo_booked'
      } else if (status === 'Working' || status === 'CONNECTED' || status === 'No reply' || status === 'Associated with a deal') {
        leadStatusBucketKey = 'working'
      }
      if (leadStatusBucketKey === 'junk') leadStatusJunk++
      else if (leadStatusBucketKey === 'demo_completed') leadStatusDemoCompleted++
      else if (leadStatusBucketKey === 'demo_booked') leadStatusDemoBooked++
      else if (leadStatusBucketKey === 'working') leadStatusWorking++
      else leadStatusNew++
      leadStatusStageBreakdown[leadStatusBucketKey].total++
      if (isWorking) leadStatusStageBreakdown[leadStatusBucketKey].working++
      if (isPaid) leadStatusStageBreakdown[leadStatusBucketKey].linkedinAds++
      else leadStatusStageBreakdown[leadStatusBucketKey].website++

      // Pure lifecyclestage bucket -- hs_lead_status is never consulted here. Uses the same
      // SQL_EXACT/OPP_EXACT (current-stage-only) sets as the rest of the dashboard's SQL/
      // Opportunity scorecards, per the portal's confirmed lifecyclestage label mapping.
      let lifecycleBucketKey: 'mql' | 'sql' | 'opportunity' | 'customer' = 'mql'
      if (stage === 'customer') lifecycleBucketKey = 'customer'
      else if (OPP_EXACT.has(stage)) lifecycleBucketKey = 'opportunity'
      else if (SQL_EXACT.has(stage)) lifecycleBucketKey = 'sql'
      if (lifecycleBucketKey === 'customer') exactLifecycleCustomer++
      else if (lifecycleBucketKey === 'opportunity') exactLifecycleOpportunity++
      else if (lifecycleBucketKey === 'sql') exactLifecycleSql++
      else exactLifecycleMql++
      lifecycleStageBreakdown[lifecycleBucketKey].total++
      if (isWorking) lifecycleStageBreakdown[lifecycleBucketKey].working++
      if (isPaid) lifecycleStageBreakdown[lifecycleBucketKey].linkedinAds++
      else lifecycleStageBreakdown[lifecycleBucketKey].website++
    }

    const total = contacts.length
    const qualified = high + medium

    // Build per-source MQL/SQL/Opportunity/Customer breakdown
    // We loop contacts again to track stage per source
    const bySourceFunnel: Record<string, { total: number; mql: number; sql: number; opportunity: number; customer: number; working: number; pipelineValue: number }> = {}
    const sqlPlusContactIds: string[] = [] // for pipeline $ lookup — scoped to SQL+ only to keep deal-association calls light
    for (const c of contacts) {
      const props = c.properties || {}
      const src = props.lead_source_category || 'Direct'
      const stage = props.lifecyclestage || ''
      const status = props.hs_lead_status || ''
      if (!bySourceFunnel[src]) bySourceFunnel[src] = { total: 0, mql: 0, sql: 0, opportunity: 0, customer: 0, working: 0, pipelineValue: 0 }
      bySourceFunnel[src].total++
      if (['marketingqualifiedlead','opportunity','249550600','customer'].includes(stage)) bySourceFunnel[src].mql++
      // Exact-stage counts per column (currently AT sql / AT opportunity / AT customer, not
      // cumulative) so the three columns partition the qualified contacts rather than overlap.
      if (SQL_EXACT.has(stage)) bySourceFunnel[src].sql++
      if (OPP_EXACT.has(stage)) bySourceFunnel[src].opportunity++
      if (stage === 'customer') bySourceFunnel[src].customer++
      // Pipeline $ lookup stays scoped by the CUMULATIVE "SQL or beyond" set deliberately --
      // an Opportunity/Customer-stage contact still has real pipeline value worth showing,
      // narrowing this to exact-SQL-only would silently drop their deal value from the table.
      if (SQL_STAGES_CUMULATIVE.has(stage)) {
        sqlPlusContactIds.push(c.id)
      }
      if (status === 'Working') bySourceFunnel[src].working++
    }

    // Pipeline $ per source — only for SQL+ contacts, batched to avoid rate limits.
    // GATED behind ?includePipeline=1 — this endpoint is called many times per page load
    // (WoW/MTD charts, comparison cards) and deal-association lookups are expensive at scale.
    // Only the Source Performance table on the MQL page requests this explicitly.
    if (includePipeline) {
      const contactSourceMap = new Map<string, string>()
      for (const c of contacts) {
        if (sqlPlusContactIds.includes(c.id)) {
          contactSourceMap.set(c.id, c.properties?.lead_source_category || 'Direct')
        }
      }
      const BATCH = 8
      for (let i = 0; i < sqlPlusContactIds.length; i += BATCH) {
        const batch = sqlPlusContactIds.slice(i, i + BATCH)
        const results = await Promise.all(batch.map(async (contactId) => {
          try {
            const assocRes = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}/associations/deals?limit=5`, {
              headers: { Authorization: `Bearer ${apiKey}` },
            })
            if (!assocRes.ok) return 0
            const assocData = await assocRes.json()
            const dealIds = (assocData.results || []).map((r: any) => r.id)
            if (dealIds.length === 0) return 0
            let sum = 0
            for (const dealId of dealIds) {
              const dealRes = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/deals/${dealId}?properties=amount`, {
                headers: { Authorization: `Bearer ${apiKey}` },
              })
              if (dealRes.ok) {
                const dealData = await dealRes.json()
                sum += parseFloat(dealData.properties?.amount || '0') || 0
              }
            }
            return sum
          } catch { return 0 }
        }))
        results.forEach((amount, idx) => {
          const contactId = batch[idx]
          const src = contactSourceMap.get(contactId) || 'Direct'
          if (bySourceFunnel[src]) bySourceFunnel[src].pipelineValue += amount
        })
        if (i + BATCH < sqlPlusContactIds.length) await new Promise(r => setTimeout(r, 150))
      }
    }

    // Which Opportunity+ contacts (lifecyclestage 249550600 or customer) have at least one
    // associated deal that reached Closed Won in the Studio Deals pipeline. GATED behind
    // ?includeClosedWon=1 — scoped to Opportunity+ only (typically a handful of contacts)
    // to keep the N+1 deal-association lookups cheap.
    const closedWonContactIds: string[] = []
    if (includeClosedWon) {
      const CLOSED_WON_STAGE_ID = '982194449'
      const oppPlusContactIds = contacts
        .filter(c => OPP_STAGES_CUMULATIVE.has(c.properties?.lifecyclestage || ''))
        .map(c => c.id)
      const BATCH2 = 8
      for (let i = 0; i < oppPlusContactIds.length; i += BATCH2) {
        const batch = oppPlusContactIds.slice(i, i + BATCH2)
        const results = await Promise.all(batch.map(async (contactId) => {
          try {
            const assocRes = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}/associations/deals?limit=5`, {
              headers: { Authorization: `Bearer ${apiKey}` },
            })
            if (!assocRes.ok) return false
            const assocData = await assocRes.json()
            const dealIds = (assocData.results || []).map((r: any) => r.id)
            if (dealIds.length === 0) return false
            for (const dealId of dealIds) {
              const dealRes = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/deals/${dealId}?properties=dealstage`, {
                headers: { Authorization: `Bearer ${apiKey}` },
              })
              if (dealRes.ok) {
                const dealData = await dealRes.json()
                if (dealData.properties?.dealstage === CLOSED_WON_STAGE_ID) return true
              }
            }
            return false
          } catch { return false }
        }))
        results.forEach((isClosedWon, idx) => {
          if (isClosedWon) closedWonContactIds.push(batch[idx])
        })
        if (i + BATCH2 < oppPlusContactIds.length) await new Promise(r => setTimeout(r, 150))
      }
    }

    // Activity-based SQL / Opportunity for the period (MQL page only)
    let pipelineActivity: any = null
    if (mode !== 'all') {
      try { pipelineActivity = await fetchPipelineActivity(apiKey, startMs, endMs) }
      catch (e) { console.warn('[mqls] pipeline activity skipped:', (e as Error).message) }
    }

    // Activity-based meetings for the period (MQL page only)
    let meetingsActivity: any = null
    if (mode !== 'all') {
      try { meetingsActivity = await fetchMeetingActivity(apiKey, startMs, endMs, ownerMap) }
      catch (e) { console.warn('[mqls] meeting activity skipped:', (e as Error).message) }
    }

    // Meetings-based Demo Booked / Demo Completed (MQL page only; skipped for the all-leads view)
    let meetingsFunnel: any = null
    if (mode !== 'all' && meetingContactDetails.length) {
      try {
        const md = await fetchMeetingDetails(apiKey, meetingContactDetails.map(c => String(c.id)), ownerMap)
        const details = meetingContactDetails.map(c => {
          const m = md.get(String(c.id))
          return {
            id: c.id, name: c.name, company: c.company, jobTitle: c.jobTitle, message: c.message, platformTools: c.platformTools, owner: c.owner,
            ads: c.source === 'Paid Campaigns' || c.source === 'Paid Search / Paid Social',
            status: m?.status || 'held', meetingAt: m?.meetingAt || null, title: m?.title || '', notes: m?.notes || '', noteBy: m?.noteBy || '', noteAt: m?.noteAt || null, outcome: m?.outcome || '', meetingCount: m?.meetingCount || 0,
          }
        })
        const isDone = (st: string) => st === 'completed' || st === 'held'
        meetingsFunnel = {
          booked: details.length,
          completed: details.filter(d => isDone(d.status)).length,        // demo took place (confirmed OR held)
          completed_confirmed: details.filter(d => d.status === 'completed').length,
          held_unconfirmed: details.filter(d => d.status === 'held').length,
          no_show: details.filter(d => d.status === 'no_show').length,
          upcoming: details.filter(d => d.status === 'upcoming').length,
          canceled_only: details.filter(d => d.status === 'canceled').length,
          details,
        }
      } catch (e) { console.warn('[mqls] meetings funnel skipped:', (e as Error).message) }
    }

    // Older contacts newly tagged Partner Form inside this window (mode=all / Leads page only)
    const partnerRetagged = mode === 'all' ? await findNewlyTaggedPartnerLeads(apiKey, startMs, endMs) : []
    if (partnerRetagged.length) byFormTypeContains['Partner Form'] = (byFormTypeContains['Partner Form'] || 0) + partnerRetagged.length

    const result = {
      total,
      mql_status_breakdown: {
        new: mqlStatusNew,
        working: mqlStatusWorking,
        demo_booked: mqlStatusDemoBooked,
        demo_completed: mqlStatusDemoCompleted,
        sql: mqlStatusSql,
        junk: mqlStatusJunk,
      },
      // Pure single-dimension breakdowns (added 2026-09-07) -- each is a complete, honest
      // picture of ONE property alone, never cross-checking the other. Feeds the two separate
      // "MQL — Lead Status" / "MQL — Lifecycle Status" funnel tables on the MQL page.
      lead_status_breakdown: {
        new: leadStatusNew,
        working: leadStatusWorking,
        demo_booked: leadStatusDemoBooked,
        demo_completed: leadStatusDemoCompleted,
        junk: leadStatusJunk,
      },
      lead_status_stage_breakdown: leadStatusStageBreakdown,
      lifecycle_status_breakdown: {
        mql: exactLifecycleMql,
        sql: exactLifecycleSql,
        opportunity: exactLifecycleOpportunity,
        customer: exactLifecycleCustomer,
      },
      lifecycle_status_stage_breakdown: lifecycleStageBreakdown,
      qualified,
      qualified_mqls: qualifiedMqls,
      high_priority: high,
      medium_priority: medium,
      low_priority: low,
      unknown_priority: unknown,
      paid_mqls: paidMqls,
      working_mqls: workingMqls,
      book_demo_linkedin_ads: bookDemoLinkedInAds,
      book_demo_website: bookDemoWebsite,
      stage_breakdown: stageBreakdown,
      by_form_type: byFormType,
      webinar_qualified: webinarQualified,
      by_form_type_contains: byFormTypeContains,
      partner_retagged: partnerRetagged,
      meetings_funnel: meetingsFunnel,
      meetings_activity: meetingsActivity,
      pipeline_activity: pipelineActivity,
      form_type_breakdown: formTypeBreakdown,
      by_source_category: bySourceCategory,
      by_source_funnel: bySourceFunnel,
      funnel: {
        mqls: total,
        meeting_booked: meetingBooked,
        demo_booked: demoBooked,
        demo_completed: demoCompleted,
        demo_no_show: demoNoShow,
        sql,
        opportunity,
        customer,
        // Deal-verified Closed Won count, only populated when ?includeClosedWon=1 was passed
        // (see closedWonContactIds above) — checks the contact's actual associated deal(s) in
        // the Studio Deals pipeline for dealstage === Closed Won, rather than trusting the
        // contact's own lifecyclestage label. Per the documented gotcha in CLAUDE.md,
        // lifecyclestage='customer' does not reliably mean a real Closed Won deal exists.
        closed_won_count: includeClosedWon ? closedWonContactIds.length : undefined,
      },
      // Pure lifecyclestage-based funnel (independent of hs_lead_status) — for the
      // "Lifecycle Stage Leakage" analysis
      lifecycle_stage_funnel: {
        total,
        mql_plus: lifecycleMqlPlus,
        sql_plus: exactLifecycleSqlPlus,
        opportunity_plus: lifecycleOppPlus,
        customer: lifecycleCustomer,
      },
      // Pure hs_lead_status-based funnel (independent of lifecyclestage) — for the
      // "Lead Status Leakage" analysis
      lead_status_funnel: {
        total,
        working_plus: statusWorkingPlus,
        demo_booked_plus: statusDemoBookedPlus,
        demo_completed_plus: statusDemoCompletedPlus,
        associated_with_deal: statusAssociatedWithDeal,
      },
      by_lifecycle_stage_raw: byLifecycleStageRaw,
      by_lead_status_raw: byLeadStatusRaw,
      date_range: { start, end },
      contacts_by_priority: contactsByPriority,
      closed_won_contact_ids: closedWonContactIds,
    }

    // Cache the result (v2 prefix to invalidate old stale entries)
    // Don't cache a result whose meetings / pipeline activity failed to load (would pin a wrong zero for up to 7 days).
    const activityMissing = mode !== 'all' && (meetingsActivity === null || pipelineActivity === null)
    if (!activityMissing) await setCache(`${cacheKeyPrefix}_${start}`, end, result)

    return NextResponse.json(result)
  } catch (err: any) {
    console.error('[hubspot/mqls]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Cache layer around computeGET:
//   fresh (past range <7d, current range <1h) -> instant
//   stale current-period entry (<24h)          -> served instantly, recomputed in the background via after()
//   miss                                       -> compute once; identical concurrent requests share one HubSpot run
// `slim=1` drops contacts_by_priority (3MB for a month) for callers that only need counts (trend charts).
const inflight = new Map<string, Promise<any>>()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')
  if (!start || !end) return computeGET(req)
  const mode = searchParams.get('mode')
  const noCache = searchParams.get('nocache') === '1'
  const slim = searchParams.get('slim') === '1'
  const includePipeline = searchParams.get('includePipeline') === '1'
  const includeClosedWon = searchParams.get('includeClosedWon') === '1'
  const prefix = `${mode === 'all' ? 'v20_all' : 'v20'}${includePipeline ? '_pipeline' : ''}${includeClosedWon ? '_closedwon' : ''}`
  const out = (r: any) => {
    if (!slim) return NextResponse.json(r)
    const { contacts_by_priority, ...rest } = r
    return NextResponse.json(rest)
  }
  const run = async (): Promise<any> => {
    const res = await computeGET(req)
    return res.ok ? await res.json() : { __error: await res.text(), __status: res.status }
  }

  if (!noCache) {
    const hit = await getCachedEntry(`${prefix}_${start}`, end)
    if (hit) {
      if (hit.past ? hit.ageMs < 604800000 : hit.ageMs < 3600000) return out(hit.result)
      if (!hit.past && hit.ageMs < STALE_MAX_MS) {
        const key = `${prefix}_${start}_${end}`
        if (!inflight.has(key)) {
          const p = run().finally(() => inflight.delete(key))
          inflight.set(key, p)
          after(async () => { await p })
        }
        return out(hit.result)
      }
    }
  }

  const key = `${prefix}_${start}_${end}${noCache ? '_nc' : ''}`
  let p = inflight.get(key)
  if (!p) { p = run().finally(() => inflight.delete(key)); inflight.set(key, p) }
  const r = await p
  if (r.__error !== undefined) return new NextResponse(r.__error, { status: r.__status, headers: { 'content-type': 'application/json' } })
  return out(r)
}
