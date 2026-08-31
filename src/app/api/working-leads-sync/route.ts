import { NextRequest, NextResponse } from 'next/server'
import { createSign } from 'crypto'

/**
 * GET /api/working-leads-sync
 *
 * Pulls "Working MQLs" (Book a Demo contacts, created June/July/August 2026, CURRENTLY at the
 * exact MQL lifecycle stage — same "Working" definition already established for the Predictive
 * Funnel table on the Executive Dashboard) and writes them into the "Working lead status" Google
 * Sheet (https://docs.google.com/spreadsheets/d/1WuUzeCGRFsy44bH_OEerBzFkifJoR0Lw8ZHGRg0v4lM),
 * for the sales team to work from on calls.
 *
 * This does a full clear-and-rewrite of the sheet every run, rather than diffing/appending —
 * that's what makes it correctly reflect "whenever a lead's status changes in HubSpot" with no
 * extra bookkeeping: a contact that's no longer exactly at MQL (progressed to SQL, or was
 * Discarded/Disqualified) simply won't appear in the next write. Simpler and more robust than
 * tracking row-level diffs, at the cost of not preserving any manual edits/notes a rep might add
 * directly in the sheet — if that becomes a problem, this needs a redesign (e.g. a separate
 * "notes" column merged back in, or an upsert-by-email keyed diff instead of clear+rewrite).
 *
 * Auth: same self-signed JWT pattern as src/app/api/sdr-sql-tracker/route.ts, but with the
 * read-write `spreadsheets` scope (not `spreadsheets.readonly`) since this writes.
 *
 * Intended to be re-run on a schedule (hourly) — see the scheduled task set up alongside this
 * route. Each run is idempotent: re-running with no HubSpot changes produces the same sheet.
 */

const HUBSPOT_API_BASE = 'https://api.hubapi.com'
const SHEET_ID = '1WuUzeCGRFsy44bH_OEerBzFkifJoR0Lw8ZHGRg0v4lM'
const TAB_NAME = 'Sheet1'
const SA_EMAIL = process.env.VERTEX_SA_EMAIL || 'automation@abm-agent.iam.gserviceaccount.com'

function getSAKey(): string {
  return (process.env.VERTEX_SA_KEY || '').replace(/\\n/g, '\n')
}

async function getGoogleAccessToken(scope: string): Promise<string> {
  const key = getSAKey()
  if (!key) throw new Error('VERTEX_SA_KEY not configured')
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({
    iss: SA_EMAIL, scope, aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now,
  })).toString('base64url')
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(key, 'base64url')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${header}.${payload}.${signature}`,
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Google auth failed: ' + JSON.stringify(data))
  return data.access_token
}

// Portal-specific: current stage EXACTLY 'marketingqualifiedlead' = "Working MQLs" — same
// definition already established for the Predictive Funnel (excludes anyone who's progressed to
// SQL/Opportunity/Customer, and excludes Discarded/Disqualified/Junk since those are different
// current-stage values entirely). See CLAUDE.md / executive-cohorts/route.ts.
const WORKING_MQL_MONTHS_UTC_2026 = [
  { label: 'June 2026', startMs: Date.UTC(2026, 5, 1), endMs: Date.UTC(2026, 6, 1) },
  { label: 'July 2026', startMs: Date.UTC(2026, 6, 1), endMs: Date.UTC(2026, 7, 1) },
  { label: 'August 2026', startMs: Date.UTC(2026, 7, 1), endMs: Date.UTC(2026, 8, 1) },
]

const CONTACT_PROPERTIES = [
  'createdate', 'firstname', 'lastname', 'email', 'company',
  'what_is_your_company_size_', 'lead_source_category', 'lyzr_lead_score_category',
  'inbound_owner', 'hubspot_owner_id', 'lifecyclestage',
]

async function searchContacts(apiKey: string, filters: any[]): Promise<any[]> {
  const results: any[] = []
  let after: string | undefined
  while (true) {
    const body: any = { filterGroups: [{ filters }], properties: CONTACT_PROPERTIES, limit: 100 }
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
    if (!data.paging?.next?.after || data.results?.length === 0) break
    after = data.paging.next.after
    await new Promise(r => setTimeout(r, 150))
  }
  return results
}

const PRIORITY_LABEL: Record<string, string> = {
  high_priority: 'High',
  medium_priority: 'Medium',
  low_priority: 'Low',
}

export const maxDuration = 120

export async function GET(req: NextRequest) {
  const apiKey = process.env.HUBSPOT_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'HUBSPOT_API_KEY not configured' }, { status: 500 })
  }

  try {
    // 1. Fetch owner id -> name map (same pattern as mqls/route.ts)
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
    } catch { /* non-blocking */ }

    // 2. Fetch Working MQLs for each of the 3 target months
    const rows: string[][] = []
    for (const month of WORKING_MQL_MONTHS_UTC_2026) {
      const contacts = await searchContacts(apiKey, [
        { propertyName: 'createdate', operator: 'GTE', value: month.startMs.toString() },
        { propertyName: 'createdate', operator: 'LT', value: month.endMs.toString() },
        { propertyName: 'email', operator: 'NOT_CONTAINS_TOKEN', value: 'lyzr.ai' },
        { propertyName: 'lead_form_type', operator: 'CONTAINS_TOKEN', value: 'Book a Demo' },
        { propertyName: 'lifecyclestage', operator: 'EQ', value: 'marketingqualifiedlead' },
      ])
      for (const c of contacts) {
        const p = c.properties || {}
        const name = [p.firstname, p.lastname].filter(Boolean).join(' ') || '—'
        rows.push([
          month.label,
          p.createdate ? p.createdate.slice(0, 10) : '',
          name,
          p.email || '',
          p.company || '',
          p.what_is_your_company_size_ || '',
          p.lead_source_category || '',
          PRIORITY_LABEL[p.lyzr_lead_score_category] || p.lyzr_lead_score_category || '',
          // inbound_owner stores a HubSpot owner ID (same as hubspot_owner_id), not a name —
          // resolve it through the same owner map, falling back to the raw value only if it
          // isn't a recognized owner ID (e.g. some other free-text convention).
          ownerMap[p.inbound_owner] || p.inbound_owner || '',
          ownerMap[p.hubspot_owner_id] || '',
        ])
      }
    }
    // Sort newest-created first within the combined list, for a call-prep-friendly order
    rows.sort((a, b) => (b[1] || '').localeCompare(a[1] || ''))

    // 3. Write to the sheet: clear existing content, then write header + fresh rows
    const token = await getGoogleAccessToken('https://www.googleapis.com/auth/spreadsheets')
    const header = ['Cohort Month', 'Date', 'Name', 'Email', 'Company Name', 'Company Size', 'Lead Source Category', 'Priority', 'Inbound Owner', 'Contact Owner']

    const clearRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(TAB_NAME)}!A1:Z2000:clear`,
      { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
    )
    if (!clearRes.ok) throw new Error(`Sheet clear failed: ${await clearRes.text()}`)

    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(TAB_NAME)}!A1?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [header, ...rows] }),
      }
    )
    if (!writeRes.ok) throw new Error(`Sheet write failed: ${await writeRes.text()}`)

    return NextResponse.json({
      ok: true,
      rowsWritten: rows.length,
      byMonth: WORKING_MQL_MONTHS_UTC_2026.map(m => ({
        month: m.label,
        count: rows.filter(r => r[0] === m.label).length,
      })),
      syncedAt: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('[working-leads-sync] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
