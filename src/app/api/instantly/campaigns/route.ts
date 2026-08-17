import { NextRequest, NextResponse } from 'next/server'

const INSTANTLY_API_KEY = 'NDMyMDI3MWUtNDQ4OS00OTBhLWFlMTEtYjcwY2EwMjNlMmE0OkVZUlNzVHZya3BYTg=='
const BASE = 'https://api.instantly.ai/api/v2'

async function instantlyGet<T>(path: string): Promise<T | null> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${INSTANTLY_API_KEY}` },
    next: { revalidate: 300 },
  })
  if (!res.ok) return null
  return res.json()
}

interface Campaign { id: string; name: string; status: number }

type Category = 'LyzrGPT' | 'Architect' | 'Prebuilt Agents' | 'Partners' | 'Hyperscalers' | 'GSI/SI' | 'Other'

const ALL_CATEGORIES: Category[] = ['LyzrGPT', 'Architect', 'Prebuilt Agents', 'Partners', 'Hyperscalers', 'GSI/SI', 'Other']

function categorize(name: string): Category {
  const n = name.toLowerCase()
  if (n.includes('lyzrgpt') || n.includes('lgpt') || n.includes('lyzr gpt') || n.includes('lyzr-gpt')) return 'LyzrGPT'
  if (n.includes('architect')) return 'Architect'
  if (n.includes('gsi') || n.includes('accenture') || n.includes('firstsource') || n.includes('jpmc') ||
      n.includes('6sigma') || n.includes('sixsigma') || n.includes('si -') || n.includes('si/')) return 'GSI/SI'
  if (n.includes('aws') || n.includes('nvidia') || n.includes('ibm') || n.includes('google next') ||
      n.includes('gtc') || n.includes('reinvent') || n.includes('re:invent')) return 'Hyperscalers'
  if (n.includes('partner') || n.includes('epp')) return 'Partners'
  if (n.includes('hr') || n.includes('chro') || n.includes('sales') || n.includes('marketing') ||
      n.includes('customer support') || n.includes('procurement') || n.includes('banking') ||
      n.includes('insurance') || n.includes('financial') || n.includes('finance') || n.includes('cfo') ||
      n.includes('private equity') || n.includes('real estate') || n.includes('retail') ||
      n.includes('healthcare') || n.includes('legal') || n.includes('cto') || n.includes('cio') ||
      n.includes('cxo') || n.includes('manufacturing') || n.includes('abm-') || n.includes('abm ')) return 'Prebuilt Agents'
  return 'Other'
}

interface CategoryStats {
  sent: number; newLeadsContacted: number; uniqueOpened: number
  uniqueReplies: number; uniqueClicks: number; opportunities: number
  campaigns: string[]
}

function emptyStats(): CategoryStats {
  return { sent: 0, newLeadsContacted: 0, uniqueOpened: 0, uniqueReplies: 0, uniqueClicks: 0, opportunities: 0, campaigns: [] }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const startDate = searchParams.get('start')
    const endDate = searchParams.get('end')

    // Fetch all campaigns
    const allCampaigns: Campaign[] = []
    let cursor: string | null = null
    do {
      const qs: string = cursor ? `?limit=100&starting_after=${cursor}` : '?limit=100'
      const data = await instantlyGet<{ items: Campaign[]; next_starting_after?: string }>(`/campaigns${qs}`)
      if (!data) break
      allCampaigns.push(...(data.items || []))
      cursor = data.next_starting_after || null
    } while (cursor)

    const relevant = allCampaigns.filter(c => [1, 2, 3].includes(c.status))

    // Initialize category buckets
    const cats: Record<Category, CategoryStats> = {} as any
    for (const cat of ALL_CATEGORIES) cats[cat] = emptyStats()

    // Fetch daily analytics for the date range (if provided) or use campaign-level analytics
    if (startDate && endDate) {
      // Fetch daily data per campaign for the date range
      for (let i = 0; i < relevant.length; i += 10) {
        const batch = relevant.slice(i, i + 10)
        const results = await Promise.all(
          batch.map(c => instantlyGet<any[]>(
            `/campaigns/analytics/daily?campaign_id=${c.id}&start_date=${startDate}&end_date=${endDate}`
          ).then(data => ({ name: c.name, data })))
        )
        for (const { name, data } of results) {
          if (!data || data.length === 0) continue
          const cat = categorize(name)
          // Sum across all days in range
          for (const day of data) {
            cats[cat].sent += day.sent || 0
            cats[cat].newLeadsContacted += day.new_leads_contacted || 0
            cats[cat].uniqueOpened += day.unique_opened || 0
            cats[cat].uniqueReplies += day.unique_replies || 0
            cats[cat].uniqueClicks += day.unique_clicks || 0
            cats[cat].opportunities += day.opportunities || 0
          }
          if (!cats[cat].campaigns.includes(name)) cats[cat].campaigns.push(name)
        }
      }
    } else {
      // Use campaign-level analytics (lifetime)
      for (let i = 0; i < relevant.length; i += 10) {
        const batch = relevant.slice(i, i + 10)
        const idsParam = batch.map(c => `id=${c.id}`).join('&')
        const data = await instantlyGet<any[]>(`/campaigns/analytics?${idsParam}`)
        if (!data) continue
        const items = Array.isArray(data) ? data : (data as any).items || []
        for (const item of items) {
          const name = item.campaign_name || relevant.find(r => r.id === item.campaign_id)?.name || ''
          const cat = categorize(name)
          cats[cat].sent += item.emails_sent_count || 0
          cats[cat].newLeadsContacted += item.contacted_count || 0
          cats[cat].uniqueOpened += item.open_count_unique || 0
          cats[cat].uniqueReplies += item.reply_count_unique || 0
          cats[cat].uniqueClicks += item.link_click_count_unique || 0
          cats[cat].opportunities += item.total_opportunities || 0
          if (name && !cats[cat].campaigns.includes(name)) cats[cat].campaigns.push(name)
        }
      }
    }

    // Compute totals
    const total = emptyStats()
    for (const cat of ALL_CATEGORIES) {
      total.sent += cats[cat].sent
      total.newLeadsContacted += cats[cat].newLeadsContacted
      total.uniqueOpened += cats[cat].uniqueOpened
      total.uniqueReplies += cats[cat].uniqueReplies
      total.uniqueClicks += cats[cat].uniqueClicks
      total.opportunities += cats[cat].opportunities
    }

    // Build response — only include categories with data
    const categoryData = ALL_CATEGORIES.map(cat => ({
      category: cat,
      ...cats[cat],
      openRate: cats[cat].sent > 0 ? ((cats[cat].uniqueOpened / cats[cat].sent) * 100).toFixed(1) : '0',
      replyRate: cats[cat].sent > 0 ? ((cats[cat].uniqueReplies / cats[cat].sent) * 100).toFixed(1) : '0',
    })).filter(c => c.sent > 0 || c.campaigns.length > 0)

    return NextResponse.json({ categories: categoryData, total, totalCampaigns: relevant.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
