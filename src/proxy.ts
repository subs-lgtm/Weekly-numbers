/**
 * Global API auth gate — added 7 Oct 2026 as part of the company-wide
 * security review (same fix already shipped in the sibling Skott repo,
 * codebase/middleware.ts — see that file's header for the full reasoning).
 * Previously NO route in this app verified a caller server-side; every
 * route trusted whatever the client sent, including direct Firestore
 * writes with real company metrics.
 *
 * Note the filename: this app is on Next.js 16, where `middleware.ts` was
 * renamed to `proxy.ts` (same NextRequest/NextResponse API, same
 * `config.matcher`) — see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
 *
 * Default: every /api/* request must present ONE of:
 *   1. The wnd_session cookie (lib/session-cookie.ts) — minted by
 *      POST /api/auth/session right after Firebase sign-in
 *      (lib/auth-context.tsx). Cookies ride along on every same-origin
 *      request automatically (fetch calls AND plain navigations), unlike
 *      a custom Authorization header, which is why this gate uses a
 *      cookie instead of requiring every call site in the app to be
 *      edited to attach a bearer header.
 *   2. A direct Firebase ID token in `Authorization: Bearer`.
 *   3. The CRON_SECRET bearer — Vercel's own cron job caller
 *      (/api/cron/warm-cache already checks this itself too; recognizing
 *      it here as well keeps the gate consistent).
 *
 * PUBLIC_PREFIXES is the explicit exception list: the cron route (it
 * checks CRON_SECRET itself) and the /api/auth/* bootstrap endpoints
 * (one of which, /api/auth/session, is literally how the cookie below
 * gets minted — gating it would be circular). This app has no external
 * webhook receivers today, unlike Skott.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { verifyFirebaseIdToken } from '@/lib/firebase-token'
import { sessionSecret, verifySession, SESSION_COOKIE } from '@/lib/session-cookie'

const PUBLIC_PREFIXES = [
  '/api/cron/', // each route checks CRON_SECRET itself
  '/api/auth/', // session bootstrap
]

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (!pathname.startsWith('/api/') || isPublic(pathname)) {
    return NextResponse.next()
  }

  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')

  if (bearer && process.env.CRON_SECRET && bearer === process.env.CRON_SECRET) {
    return NextResponse.next()
  }

  if (bearer) {
    try {
      await verifyFirebaseIdToken(bearer)
      return NextResponse.next()
    } catch {
      // Not a valid bearer token — fall through to the cookie check below.
    }
  }

  const secret = sessionSecret()
  const cookie = req.cookies.get(SESSION_COOKIE)?.value
  if (secret && (await verifySession(cookie, secret))) {
    return NextResponse.next()
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export const config = {
  matcher: ['/api/:path*'],
}
