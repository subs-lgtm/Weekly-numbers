import { NextResponse } from 'next/server'
import { createSign } from 'crypto'

// YouTube Followers — "Youtube Followers" tab (Month | Youtube Goals | Actual Followers).
// Same sheet as linkedin-followers, same env-var-based service-account JWT pattern as
// src/app/api/aws-partner-tracker/route.ts — see that route's/linkedin-followers's comments
// for why this isn't a hardcoded credentials object (an earlier "recovered" copy had one).
const SHEET_ID = '1Jt_Pkea9NpyOgcdAqdF-O8v6tOmAIQXkkSMeD3GLt-o'
const TAB = 'Youtube Followers'
const SA_EMAIL = 'automation@abm-agent.iam.gserviceaccount.com'
const RANGE = `'${TAB}'!A1:C50`

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

function parseNum(val: string | undefined): number | null {
  if (!val) return null
  const cleaned = val.replace(/,/g, '').trim()
  const n = parseInt(cleaned, 10)
  return isNaN(n) ? null : n
}

export const maxDuration = 30

export async function GET() {
  try {
    const token = await getToken()
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(RANGE)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const body = await res.json() as { values?: string[][]; error?: unknown }
    if (body.error) throw new Error(JSON.stringify(body.error))

    const rows = body.values || []
    if (rows.length <= 1) return NextResponse.json({ data: [] })

    // Skip header row, parse: Month | Youtube Goals | Actual Followers
    const data = rows.slice(1)
      .filter((row) => row[0])
      .map((row) => ({
        month: row[0],
        goal: parseNum(row[1]),
        actual: parseNum(row[2]),
      }))

    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('[youtube-followers] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
