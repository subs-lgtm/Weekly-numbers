import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore'

export const maxDuration = 120

const SA_EMAIL = process.env.SA_CLIENT_EMAIL || ''
const SA_KEY = (process.env.SA_PRIVATE_KEY || '').replace(/\\n/g, '\n')
const PROJECT_ID = process.env.GCP_PROJECT_ID || 'abm-agent'
const MODEL = 'gemini-2.5-flash'

function getAdminDb() {
  if (getApps().length === 0) {
    initializeApp({ credential: cert({ projectId: PROJECT_ID, clientEmail: SA_EMAIL, privateKey: SA_KEY }) })
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

async function fetchAllMetrics(weekStart: string): Promise<string> {
  const db = getAdminDb()
  const prevMonday = new Date(weekStart + 'T00:00:00')
  prevMonday.setDate(prevMonday.getDate() - 7)
  const prevWeek = prevMonday.toISOString().split('T')[0]

  const sections = [
    'ads', 'seo', 'email', 'events', 'mqls', 'leads', 'content',
    'studio-signups', 'architect', 'lyzr-gpt',
    'partners-emerging', 'partners-aws', 'partners-gsi', 'pages',
    'git-agent', 'social-influencers', 'webinars', 'playbooks',
  ]

  const lines: string[] = [`WEEK: ${weekStart}`, `PREVIOUS WEEK: ${prevWeek}`, '']

  for (const section of sections) {
    const thisSnap = await db.collection('weekly_metrics').doc(weekStart)
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

  // Also fetch goals from admin config if stored separately
  try {
    const goalsSnap = await db.collection('goals').doc('current').get()
    if (goalsSnap.exists) {
      lines.push('## GOALS (Admin-configured)')
      const goals = goalsSnap.data() || {}
      for (const [k, v] of Object.entries(goals)) {
        lines.push(`  ${k}: ${v}`)
      }
      lines.push('')
    }
  } catch {}

  return lines.join('\n')
}

const SYSTEM_PROMPT = `You are the Lyzr Marketing Analytics Agent. Generate a comprehensive weekly marketing summary.

INSTRUCTIONS:
- Analyze ALL the metrics data provided below
- Generate a summary for EACH of these channels (even if data is sparse, note what's missing):
  1. Email Marketing
  2. Events
  3. Webinars
  4. SEO
  5. Ads
  6. Content
  7. Website
  8. Social

- For each channel, provide:
  • A 1-2 sentence performance summary
  • Key metrics with WoW change (↑ or ↓ with %)
  • Goal vs Actual comparison where goals exist
  • One actionable insight or flag

- After all channels, add:
  • "Overall Summary" — 3-4 sentences on the week's marketing performance
  • "Key Considerations" — 2-3 bullet points on what needs attention

FORMAT:
Use markdown with ## headers for each channel (e.g. ## Email Marketing, ## Events, ## SEO, etc).
Use ## Overall Summary and ## Key Considerations for the final sections.
Do NOT use ### — only ## for section headers.
Keep it concise but data-rich. Use actual numbers from the data — never make up numbers.
If a section has no data, say "No data reported this week" and suggest what should be tracked.

TONE: Professional, analytical, direct. Like a VP of Marketing reviewing the week.`

export async function POST(req: NextRequest) {
  try {
    const { weekStart } = await req.json()
    if (!weekStart) {
      return NextResponse.json({ error: 'weekStart required' }, { status: 400 })
    }

    const [token, metricsData] = await Promise.all([getToken(), fetchAllMetrics(weekStart)])

    const userPrompt = `Generate the weekly marketing summary for the week of ${weekStart}.\n\n--- DASHBOARD DATA ---\n${metricsData}\n--- END DATA ---`

    const res = await fetch(
      `https://us-central1-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/us-central1/publishers/google/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 65536 },
        }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      console.error('[generate-summary] Gemini error:', res.status, err.substring(0, 300))
      return NextResponse.json({ error: `Gemini ${res.status}` }, { status: 500 })
    }

    const data = await res.json()
    const summary = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Failed to generate summary.'

    // Optionally save to Firestore for caching
    try {
      const db = getAdminDb()
      await db.collection('weekly_summaries').doc(weekStart).set({
        summary,
        generatedAt: new Date(),
        model: MODEL,
      })
    } catch {}

    return NextResponse.json({ summary, weekStart })
  } catch (err: any) {
    console.error('[generate-summary]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// GET — retrieve cached summary
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const weekStart = url.searchParams.get('week')
    if (!weekStart) return NextResponse.json({ error: 'week param required' }, { status: 400 })

    const db = getAdminDb()
    const doc = await db.collection('weekly_summaries').doc(weekStart).get()
    if (!doc.exists) return NextResponse.json({ summary: null })

    const data = doc.data()
    return NextResponse.json({ summary: data?.summary, generatedAt: data?.generatedAt?.toDate?.() })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
