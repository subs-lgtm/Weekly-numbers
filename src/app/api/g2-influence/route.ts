import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/scorecard-admin'

/**
 * GET /api/g2-influence
 * Returns the G2 Performance Analytics influence snapshot (Firestore g2_influence/current), written by
 * scripts/seed-g2-influence.mjs from the G2 connector. Read server-side with the admin SDK so it does not
 * depend on client Firestore rules. Behind the proxy session gate like every other /api route.
 */
export async function GET() {
  try {
    const snap = await getAdminDb().doc('g2_influence/current').get()
    if (!snap.exists) return NextResponse.json({ data: null })
    return NextResponse.json({ data: snap.data() })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 })
  }
}
