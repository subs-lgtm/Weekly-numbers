/**
 * Lightweight Firebase ID token verification — signature/issuer/audience
 * only, no DB lookup. Used by src/proxy.ts (the global API auth gate) to
 * decide "is this a logged-in dashboard user" without a per-request round
 * trip. Same jose-against-Google's-public-JWKS pattern used in the
 * sibling Skott (codebase/) repo's lib/agentic-drive/auth.ts.
 */
import { jwtVerify, createRemoteJWKSet } from 'jose'

const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'abm-agent'
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null
function jwks() {
  if (!_jwks) _jwks = createRemoteJWKSet(new URL(JWKS_URL))
  return _jwks
}

export async function verifyFirebaseIdToken(token: string): Promise<{ uid: string; email: string }> {
  const { payload } = await jwtVerify(token, jwks(), {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  })
  const uid = String(payload.sub || payload.user_id || '')
  if (!uid) throw new Error('Token missing subject claim.')
  return { uid, email: String(payload.email || '') }
}
