import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore'

export const maxDuration = 60

const SA_EMAIL = process.env.SA_CLIENT_EMAIL || ''
const SA_KEY = (process.env.SA_PRIVATE_KEY || '').replace(/\\n/g, '\n')
const PROJECT_ID = process.env.GCP_PROJECT_ID || 'abm-agent'
const MODEL = 'gemini-2.5-flash'

// Firebase Admin for server-side Firestore reads
function getAdminDb() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({ projectId: PROJECT_ID, clientEmail: SA_EMAIL, privateKey: SA_KEY }),
    })
  }
  return getAdminFirestore()
}

async function getToken(): Promise<string> {
  const { GoogleAuth } = await import('google-auth-library')
  const auth = new GoogleAuth({
    credentials: { type: 'service_account', client_email: SA_EMAIL, private_key: SA_KEY },
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  })
  const client = await auth.getClient()
  const { token } = await client.getAccessToken()
  return token!
}

// Fetch all metrics for current + previous week from Firestore
async function fetchDashboardContext(): Promise<string> {
  try {
    const db = getAdminDb()
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? 6 : day - 1
    const monday = new Date(now)
    monday.setDate(now.getDate() - diff)
    const thisWeek = monday.toISOString().split('T')[0]
    const prevMonday = new Date(monday)
    prevMonday.setDate(monday.getDate() - 7)
    const prevWeek = prevMonday.toISOString().split('T')[0]

    const sections = [
      'ads', 'seo', 'email', 'events', 'mqls', 'leads', 'content',
      'studio-signups', 'architect', 'lyzr-gpt',
      'partners-emerging', 'partners-aws', 'partners-gsi', 'pages', 'git-agent',
    ]

    const lines: string[] = [`CURRENT WEEK: ${thisWeek}`, `PREVIOUS WEEK: ${prevWeek}`, '']

    for (const section of sections) {
      const thisSnap = await db.collection('weekly_metrics').doc(thisWeek)
        .collection('sections').doc(section).collection('entries').get()
      const prevSnap = await db.collection('weekly_metrics').doc(prevWeek)
        .collection('sections').doc(section).collection('entries').get()

      const thisData: Record<string, string> = {}
      const prevData: Record<string, string> = {}
      thisSnap.forEach(d => { thisData[d.id] = d.data().value ?? '' })
      prevSnap.forEach(d => { prevData[d.id] = d.data().value ?? '' })

      if (Object.keys(thisData).length === 0 && Object.keys(prevData).length === 0) continue

      lines.push(`## ${section.toUpperCase()}`)
      const allKeys = new Set([...Object.keys(thisData), ...Object.keys(prevData)])
      for (const key of allKeys) {
        const curr = thisData[key] || '—'
        const prev = prevData[key] || '—'
        lines.push(`  ${key}: this_week=${curr}, prev_week=${prev}`)
      }
      lines.push('')
    }

    // Also fetch custom metrics
    for (const section of sections) {
      const customSnap = await db.collection('custom_metrics').doc(section).collection('items').get()
      if (customSnap.empty) continue
      lines.push(`## CUSTOM METRICS — ${section.toUpperCase()}`)
      customSnap.forEach(d => {
        const data = d.data()
        lines.push(`  ${data.label} (${data.unit}): key=${data.key}`)
      })
      lines.push('')
    }

    return lines.join('\n')
  } catch (err) {
    console.error('[chat] Failed to fetch dashboard context:', err)
    return 'Dashboard data unavailable — Firestore fetch failed.'
  }
}

const BASE_SYSTEM = `You are the Lyzr Marketing Dashboard AI Assistant. You help the marketing team at Lyzr.ai analyze their weekly numbers, spot trends, and make data-driven decisions.

You have REAL-TIME ACCESS to the actual dashboard data — it's injected below. Use these exact numbers when answering questions. Never make up numbers.

When answering:
- Be concise and data-focused — reference the actual numbers
- Calculate WoW changes when both weeks have data
- Highlight metrics that improved or declined significantly
- Suggest actionable next steps based on the data
- If a metric is missing (—), say the team hasn't entered it yet
- Use the Lyzr brand voice: professional, approachable, never robotic
- Format numbers nicely (e.g. 1,234 not 1234, $5.2k not $5200)`

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    if (!messages?.length) {
      return NextResponse.json({ error: 'messages required' }, { status: 400 })
    }

    // Fetch real dashboard data and inject into system prompt
    const [token, dashboardData] = await Promise.all([getToken(), fetchDashboardContext()])

    const systemPrompt = `${BASE_SYSTEM}

--- LIVE DASHBOARD DATA ---
${dashboardData}
--- END DASHBOARD DATA ---`

    // Convert chat messages to Gemini format
    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const res = await fetch(
      `https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/us-central1/publishers/google/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 60000 },
        }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      console.error('[chat] Gemini error:', res.status, err.substring(0, 300))
      return NextResponse.json({ error: `Gemini ${res.status}` }, { status: 500 })
    }

    const data = await res.json()
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.'

    return NextResponse.json({ reply })
  } catch (err: any) {
    console.error('[chat]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
