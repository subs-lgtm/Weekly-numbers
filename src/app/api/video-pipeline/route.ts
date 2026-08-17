import { NextRequest, NextResponse } from 'next/server'
import { GoogleAuth } from 'google-auth-library'

export const maxDuration = 30
export const revalidate = 300 // cache 5 min

const SHEET_ID = '1J8SPFeRdiVGkUx5yO6TZ5ZjfR0rjIt7hVQa8dUmz4Ps'
const SA_EMAIL = process.env.SA_CLIENT_EMAIL || ''
const SA_KEY = (process.env.SA_PRIVATE_KEY || '').replace(/\\n/g, '\n')

const IG_TABS = [
  { tab: 'IG · Unfiltered Founder', channel: 'Unfiltered Founder' },
  { tab: 'IG · One Less Click', channel: 'One Less Click' },
  { tab: 'IG · In the Loop', channel: 'In the Loop' },
  { tab: 'IG · Patch Notes', channel: 'Patch Notes' },
]

async function getToken(): Promise<string> {
  const auth = new GoogleAuth({
    credentials: { type: 'service_account', client_email: SA_EMAIL, private_key: SA_KEY },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
  const client = await auth.getClient()
  const { token } = await client.getAccessToken()
  return token!
}

async function fetchTab(token: string, tabName: string): Promise<string[][]> {
  const range = encodeURIComponent(`'${tabName}'!A1:Z200`)
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) return []
  const data = await res.json()
  return data.values || []
}

export async function GET(req: NextRequest) {
  const tab = req.nextUrl.searchParams.get('tab') || 'pipeline'

  try {
    const token = await getToken()

    if (tab === 'pipeline') {
      const rows = await fetchTab(token, 'Content Engine Pipeline')
      if (rows.length < 3) return NextResponse.json({ videos: [] })

      // Row 1 is title, Row 2 is headers
      const headers = rows[1].map((h: string) => h.trim().toLowerCase())
      const titleIdx = headers.indexOf('title')
      const categoryIdx = headers.indexOf('category')
      const statusIdx = headers.indexOf('status')
      const platformIdx = headers.indexOf('platform')
      const publishDateIdx = headers.indexOf('publish date')
      const scriptIdx = headers.indexOf('script')
      const editorIdx = headers.indexOf('editor')
      const linkIdx = headers.indexOf('video link')

      const videos = rows.slice(2)
        .filter((r: string[]) => r[titleIdx]?.trim())
        .map((r: string[], i: number) => ({
          id: String(i + 1),
          title: r[titleIdx] || '',
          category: r[categoryIdx] || '',
          status: r[statusIdx] || '',
          platform: r[platformIdx] || '',
          publishDate: r[publishDateIdx] || '',
          script: r[scriptIdx] || '',
          editor: r[editorIdx] || '',
          videoLink: r[linkIdx] || '',
        }))

      return NextResponse.json({ videos, total: videos.length })
    }

    if (tab === 'instagram') {
      // Fetch all IG tabs in parallel
      const results = await Promise.all(
        IG_TABS.map(async ({ tab: tabName, channel }) => {
          const rows = await fetchTab(token, tabName)
          if (rows.length < 4) return { channel, followers: 0, posts: [] }

          // Row 1: title, Row 2: FOLLOWERS | count, Row 3: headers, Row 4+: data
          const followers = parseInt(rows[1]?.[1] || '0', 10)
          const headers = (rows[2] || []).map((h: string) => h.trim().toLowerCase())

          const dateIdx = headers.indexOf('date posted')
          const viewsIdx = headers.indexOf('views in 48 hrs')
          const likesIdx = headers.indexOf('likes')
          const commentsIdx = headers.indexOf('comments')
          const resharesIdx = headers.indexOf('reshares')
          const sharesIdx = headers.indexOf('shares')
          const savesIdx = headers.indexOf('saves')
          const profileVisitsIdx = headers.indexOf('profile visits')
          const followsIdx = headers.indexOf('follows')
          const skipRateIdx = headers.indexOf('skip rate (%)')

          const posts = rows.slice(3)
            .filter((r: string[]) => r[dateIdx]?.trim())
            .map((r: string[]) => ({
              date: r[dateIdx] || '',
              views: parseInt(r[viewsIdx] || '0', 10) || 0,
              likes: parseInt(r[likesIdx] || '0', 10) || 0,
              comments: parseInt(r[commentsIdx] || '0', 10) || 0,
              reshares: parseInt(r[resharesIdx] || '0', 10) || 0,
              shares: parseInt(r[sharesIdx] || '0', 10) || 0,
              saves: parseInt(r[savesIdx] || '0', 10) || 0,
              profileVisits: parseInt(r[profileVisitsIdx] || '0', 10) || 0,
              follows: parseInt(r[followsIdx] || '0', 10) || 0,
              skipRate: r[skipRateIdx] || '',
            }))

          // Aggregate totals
          const totalViews = posts.reduce((s, p) => s + p.views, 0)
          const totalLikes = posts.reduce((s, p) => s + p.likes, 0)
          const totalComments = posts.reduce((s, p) => s + p.comments, 0)
          const totalShares = posts.reduce((s, p) => s + p.shares + p.reshares, 0)
          const totalSaves = posts.reduce((s, p) => s + p.saves, 0)
          const totalFollows = posts.reduce((s, p) => s + p.follows, 0)
          const avgSkipRate = posts.length > 0
            ? (posts.reduce((s, p) => s + (parseFloat(p.skipRate) || 0), 0) / posts.length).toFixed(1)
            : '0'

          return {
            channel,
            followers,
            totalPosts: posts.length,
            totalViews,
            totalLikes,
            totalComments,
            totalShares,
            totalSaves,
            totalFollows,
            avgSkipRate,
            posts,
          }
        })
      )

      return NextResponse.json({ channels: results })
    }

    if (tab === 'tracking') {
      const rows = await fetchTab(token, 'Tracking')
      if (rows.length < 2) return NextResponse.json({ weeks: [] })

      // Row 1: headers (Week, Goal, Actuals: TUF, Actuals: OLC, Actuals: ITL, Actuals: PN)
      const weeks = rows.slice(1)
        .filter((r: string[]) => r[0]?.trim())
        .map((r: string[]) => ({
          week: r[0] || '',
          goal: parseInt(r[1] || '0', 10) || 0,
          tuf: parseInt(r[2] || '0', 10) || 0,
          olc: parseInt(r[3] || '0', 10) || 0,
          itl: parseInt(r[4] || '0', 10) || 0,
          pn: parseInt(r[5] || '0', 10) || 0,
          total: (parseInt(r[2] || '0', 10) || 0) + (parseInt(r[3] || '0', 10) || 0) + (parseInt(r[4] || '0', 10) || 0) + (parseInt(r[5] || '0', 10) || 0),
        }))

      return NextResponse.json({ weeks })
    }

    if (tab === 'video-all') {
      const rows = await fetchTab(token, 'Video Pipeline - All')
      if (rows.length < 3) return NextResponse.json({ videos: [] })

      // Row 1 is title, Row 2 is headers
      const headers = rows[1].map((h: string) => h.trim().toLowerCase())
      const titleIdx = headers.indexOf('title')
      const categoryIdx = headers.indexOf('category')
      const statusIdx = headers.indexOf('status')
      const platformIdx = headers.indexOf('platform')
      const publishDateIdx = headers.indexOf('publish date')
      const scriptIdx = headers.indexOf('script')
      const editorIdx = headers.indexOf('editor')
      const noteIdx = headers.indexOf('note')

      const videos = rows.slice(2)
        .filter((r: string[]) => r[titleIdx]?.trim())
        .map((r: string[], i: number) => ({
          id: String(i + 1),
          title: r[titleIdx] || '',
          category: r[categoryIdx] || '',
          status: r[statusIdx] || '',
          platform: r[platformIdx] || '',
          publishDate: r[publishDateIdx] || '',
          script: r[scriptIdx] || '',
          editor: r[editorIdx] || '',
          note: r[noteIdx] || '',
        }))

      return NextResponse.json({ videos, total: videos.length })
    }

    if (tab === 'instructions') {
      const rows = await fetchTab(token, 'Instructions')
      // Return raw rows as text lines
      const lines = rows.map((r: string[]) => r.join(' — ')).filter(Boolean)
      return NextResponse.json({ lines })
    }

    return NextResponse.json({ error: 'Invalid tab parameter. Use ?tab=pipeline, ?tab=instagram, ?tab=tracking, or ?tab=instructions' }, { status: 400 })
  } catch (err: any) {
    console.error('[video-pipeline] Error:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
