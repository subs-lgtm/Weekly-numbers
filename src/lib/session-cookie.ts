/**
 * Signed session cookie — issued once (POST /api/auth/session) after a
 * real Firebase ID token is verified, then trusted independently for its
 * own lifetime so every subsequent same-origin request (fetch OR a plain
 * navigation) carries it automatically. Uses Web Crypto (`crypto.subtle`)
 * so this file runs unmodified in both src/proxy.ts's Edge runtime and
 * normal Node.js API routes. Same shape as the sibling Skott repo's
 * codebase/lib/session-cookie.ts.
 */
export const SESSION_COOKIE = 'wnd_session'
const SESSION_DAYS = 14

interface SessionPayload {
  uid: string
  email: string
  exp: number
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

const b64 = (s: string) => toBase64Url(new TextEncoder().encode(s))
const unb64 = (s: string) => new TextDecoder().decode(fromBase64Url(s))

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

export function sessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET
  return secret && secret.length >= 16 ? secret : null
}

export async function signSession(uid: string, email: string, secret: string): Promise<string> {
  const payload = b64(JSON.stringify({
    uid,
    email,
    exp: Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400,
  } satisfies SessionPayload))
  const key = await hmacKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return `${payload}.${toBase64Url(new Uint8Array(sig))}`
}

export async function verifySession(token: string | undefined | null, secret: string): Promise<{ uid: string; email: string } | null> {
  if (!token || token.length > 2048) return null
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payload, sig] = parts as [string, string]

  let valid: boolean
  try {
    const key = await hmacKey(secret)
    const sigBytes = fromBase64Url(sig).slice()
    valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payload))
  } catch {
    return null
  }
  if (!valid) return null

  try {
    const s = JSON.parse(unb64(payload)) as Partial<SessionPayload>
    if (typeof s.exp !== 'number' || s.exp <= Math.floor(Date.now() / 1000)) return null
    if (!s.uid) return null
    return { uid: s.uid, email: s.email || '' }
  } catch {
    return null
  }
}

export function sessionCookieHeader(token: string, secure: boolean): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`
}

export function clearedSessionCookieHeader(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`
}
