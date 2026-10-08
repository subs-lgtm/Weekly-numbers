/**
 * POST /api/auth/logout — clears the wnd_session cookie minted by
 * /api/auth/session, so the global proxy gate stops treating this
 * browser as logged in once Firebase sign-out fires.
 */
import { NextResponse } from 'next/server'
import { clearedSessionCookieHeader } from '@/lib/session-cookie'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.headers.set('Set-Cookie', clearedSessionCookieHeader(process.env.NODE_ENV === 'production'))
  return res
}
