/**
 * POST /api/auth/session — mints the signed wnd_session cookie that the
 * global proxy auth gate (src/proxy.ts) checks on every request. Called
 * once by the client right after Firebase sign-in (src/lib/auth-context.tsx)
 * with a real Firebase ID token in the Authorization header.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyFirebaseIdToken } from '@/lib/firebase-token'
import { sessionSecret, signSession, sessionCookieHeader } from '@/lib/session-cookie'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    return NextResponse.json({ error: 'Missing Authorization header.' }, { status: 401 })
  }

  const secret = sessionSecret()
  if (!secret) {
    return NextResponse.json({ error: 'Session signing not configured.' }, { status: 503 })
  }

  try {
    const { uid, email } = await verifyFirebaseIdToken(match[1].trim())
    const token = await signSession(uid, email, secret)
    const res = NextResponse.json({ ok: true })
    res.headers.set('Set-Cookie', sessionCookieHeader(token, process.env.NODE_ENV === 'production'))
    return res
  } catch (err) {
    console.error('[auth/session] Token verification failed:', (err as Error)?.message)
    return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 })
  }
}
