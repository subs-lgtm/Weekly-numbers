import { NextRequest } from "next/server"

/**
 * Server-side Firestore admin + session verification for the Channel Scorecard API routes.
 *
 * NEW PATTERN for this app: every other Firestore write here (RAG log, Activity Summary owners)
 * goes straight from the client SDK with a client-supplied name/owner field, no server check —
 * fine for those, but the Scorecard spec explicitly requires `scored_by` to come "from the
 * session, never from the client." So the client sends its Firebase ID token in an `Authorization:
 * Bearer <token>` header (see ScorecardApiClient on the frontend), and every mutating route here
 * verifies it server-side via firebase-admin/auth before trusting who's writing.
 */

let adminApp: any = null
function getAdminApp() {
  if (adminApp) return adminApp
  const { initializeApp, getApps, cert } = require("firebase-admin/app")
  const SA_EMAIL = process.env.SA_CLIENT_EMAIL || ""
  const SA_KEY = (process.env.SA_PRIVATE_KEY || "").replace(/\\n/g, "\n")
  const PROJECT_ID = process.env.GCP_PROJECT_ID || "abm-agent"
  if (!SA_EMAIL || !SA_KEY) throw new Error("SA_CLIENT_EMAIL/SA_PRIVATE_KEY not configured")
  const appName = "channel-scorecard-admin"
  const existing = getApps().find((a: any) => a.name === appName)
  adminApp = existing || initializeApp({ credential: cert({ projectId: PROJECT_ID, clientEmail: SA_EMAIL, privateKey: SA_KEY }) }, appName)
  return adminApp
}

export function getAdminDb() {
  const { getFirestore } = require("firebase-admin/firestore")
  return getFirestore(getAdminApp())
}

export type SessionUser = { uid: string; email: string; name: string }

/**
 * Verifies the request's Firebase ID token server-side. Returns null (never throws) on a
 * missing/invalid/expired token so callers can uniformly respond 401 — the caller must check for
 * null, this never silently falls back to a client-supplied identity.
 */
export async function getSessionUser(req: NextRequest): Promise<SessionUser | null> {
  try {
    const authHeader = req.headers.get("authorization") || ""
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null
    if (!token) return null
    const { getAuth } = require("firebase-admin/auth")
    const decoded = await getAuth(getAdminApp()).verifyIdToken(token)
    if (!decoded.email) return null
    return { uid: decoded.uid, email: decoded.email, name: decoded.name || decoded.email }
  } catch {
    return null
  }
}
