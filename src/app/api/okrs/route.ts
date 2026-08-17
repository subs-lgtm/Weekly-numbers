import { NextResponse } from 'next/server'
import { createSign } from 'crypto'

const SHEET_ID = '1Wm6BtmZcI1tTt1vEjEY2aRfH_vxJ8OxcWlhLz4-Ls9s'
const SA_EMAIL = 'automation@abm-agent.iam.gserviceaccount.com'

async function getToken(): Promise<string> {
  const key = (process.env.VERTEX_SA_KEY || '').replace(/\\n/g, '\n')
  const now  = Math.floor(Date.now() / 1000)
  const hdr  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const pay  = Buffer.from(JSON.stringify({
    iss: SA_EMAIL, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now,
  })).toString('base64url')
  const si   = `${hdr}.${pay}`
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

export type OKRRow = {
  person: string
  objective: string
  keyResults: string[]
  pipelineTarget: string
}

export const maxDuration = 30

export async function GET() {
  try {
    const token = await getToken()
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent("Sheet3!A1:D100")}`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const data = await res.json() as { values?: string[][] }
    const rows = (data.values || []).slice(2) // skip blank row 1 + header row 2

    const okrs: OKRRow[] = rows
      .filter(r => r[0]?.trim())
      .map(r => ({
        person:         (r[0] || '').trim(),
        objective:      (r[1] || '').trim(),
        keyResults:     (r[2] || '').split('\n').map(s => s.trim()).filter(Boolean),
        pipelineTarget: (r[3] || '').trim(),
      }))

    return NextResponse.json({ okrs, updatedAt: new Date().toISOString() })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
