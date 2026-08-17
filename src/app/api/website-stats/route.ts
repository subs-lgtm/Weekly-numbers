import { NextResponse } from "next/server"

const WP_BASE = "https://www.lyzr.ai/wp-json/wp/v2"
const WP_AUTH = process.env.WORDPRESS_AUTH_HEADER || ""

// In-memory cache: keyed by weekStart string, stores result + timestamp
const cache = new Map<string, { data: any; ts: number }>()
const CACHE_TTL_CURRENT = 30 * 60 * 1000  // 30 min for current week (data still changing)
const CACHE_TTL_PAST = 24 * 60 * 60 * 1000 // 24h for past weeks (data won't change)

// Post types to skip (not real content pages)
const SKIP_TYPES = new Set([
  "attachment", "nav_menu_item", "wp_block", "wp_template",
  "wp_template_part", "wp_navigation", "wp_font_family",
  "wp_font_face", "wp_global_styles", "elementor_library",
  "e-floating-buttons", "e-landing-page",
])

interface CmsTypeInfo {
  name: string
  slug: string
  rest_base: string
  count: number
}

async function fetchTotalCount(restBase: string): Promise<number> {
  try {
    const res = await fetch(`${WP_BASE}/${restBase}?per_page=1&status=publish`, {
      headers: { Authorization: WP_AUTH },
    })
    if (!res.ok) return 0
    return parseInt(res.headers.get("x-wp-total") || "0")
  } catch {
    return 0
  }
}

async function fetchPublishedThisWeek(restBase: string, after: string, before: string): Promise<number> {
  try {
    const res = await fetch(
      `${WP_BASE}/${restBase}?per_page=1&status=publish&after=${after}&before=${before}&orderby=date&order=desc`,
      { headers: { Authorization: WP_AUTH } }
    )
    if (!res.ok) return 0
    return parseInt(res.headers.get("x-wp-total") || "0")
  } catch {
    return 0
  }
}

async function fetchModifiedThisWeek(restBase: string, after: string, before: string): Promise<number> {
  let count = 0
  let page = 1
  const afterDate = new Date(after)
  const beforeDate = new Date(before)

  while (true) {
    try {
      const res = await fetch(
        `${WP_BASE}/${restBase}?per_page=100&page=${page}&status=publish&orderby=modified&order=desc&_fields=id,date,modified`,
        { headers: { Authorization: WP_AUTH } }
      )
      if (!res.ok) break
      const items = await res.json()
      if (!Array.isArray(items) || items.length === 0) break

      let anyInRange = false
      for (const item of items) {
        const mod = new Date(item.modified)
        if (mod >= afterDate && mod < beforeDate) {
          anyInRange = true
          if (new Date(item.date) < afterDate) {
            count++
          }
        } else if (mod < afterDate) {
          break
        }
      }
      if (!anyInRange) break

      const totalPages = parseInt(res.headers.get("x-wp-totalpages") || "1")
      if (page >= totalPages) break
      page++
    } catch {
      break
    }
  }
  return count
}

function isCurrentWeek(weekStartStr: string): boolean {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const currentMonday = new Date(now)
  currentMonday.setDate(now.getDate() + mondayOffset)
  currentMonday.setHours(0, 0, 0, 0)
  return weekStartStr === currentMonday.toISOString().split("T")[0]
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const weekStartParam = searchParams.get('weekStart')

    let weekStart: Date
    if (weekStartParam) {
      weekStart = new Date(weekStartParam + 'T00:00:00.000Z')
    } else {
      const now = new Date()
      const dayOfWeek = now.getDay()
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      weekStart = new Date(now)
      weekStart.setDate(now.getDate() + mondayOffset)
      weekStart.setHours(0, 0, 0, 0)
    }

    const weekStartStr = weekStart.toISOString().split("T")[0]
    const isCurrent = isCurrentWeek(weekStartStr)
    const ttl = isCurrent ? CACHE_TTL_CURRENT : CACHE_TTL_PAST

    // Check cache
    const cached = cache.get(weekStartStr)
    if (cached && (Date.now() - cached.ts) < ttl) {
      return NextResponse.json(cached.data, {
        headers: { "X-Cache": "HIT", "X-Cache-Age": `${Math.round((Date.now() - cached.ts) / 1000)}s` },
      })
    }

    // Week end = weekStart + 7 days (exclusive)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const afterISO = weekStart.toISOString()
    const beforeISO = weekEnd.toISOString()

    // Discover all CMS types
    const typesRes = await fetch(`${WP_BASE}/types`, { headers: { Authorization: WP_AUTH } })
    if (!typesRes.ok) {
      return NextResponse.json({ error: `WordPress API error: ${typesRes.status}` }, { status: 500 })
    }
    const types = await typesRes.json()

    const cmsTypes: CmsTypeInfo[] = []
    let totalPages = 0
    let totalPublished = 0
    let totalUpdated = 0

    for (const [slug, info] of Object.entries(types) as [string, any][]) {
      if (SKIP_TYPES.has(slug)) continue

      const restBase = info.rest_base || slug
      const count = await fetchTotalCount(restBase)
      if (count === 0) continue

      cmsTypes.push({ name: info.name || slug, slug, rest_base: restBase, count })
      totalPages += count
    }

    // Get published and updated counts for main content types
    const mainTypes = cmsTypes.filter(t => t.count > 5)
    for (const t of mainTypes) {
      const published = await fetchPublishedThisWeek(t.rest_base, afterISO, beforeISO)
      const updated = await fetchModifiedThisWeek(t.rest_base, afterISO, beforeISO)
      totalPublished += published
      totalUpdated += updated
    }

    const result = {
      totalPages,
      totalPublished,
      totalUpdated,
      weekStart: weekStartStr,
      cmsTypes: cmsTypes.sort((a, b) => b.count - a.count),
    }

    // Store in cache
    cache.set(weekStartStr, { data: result, ts: Date.now() })

    return NextResponse.json(result, {
      headers: { "X-Cache": "MISS" },
    })
  } catch (err: any) {
    console.error("[website-stats] Error:", err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
