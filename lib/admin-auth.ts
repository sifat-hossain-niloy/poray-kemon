// ─────────────────────────────────────────────────────────────────────────────
// Admin authentication
//
// Per SRS §4.5 FR-MOD-05 the admin panel must NOT share Google OAuth with
// regular users. Admins authenticate against the `admin_users` table with a
// username + bcrypt password and receive a separate session cookie.
//
// We sign the cookie ourselves with HMAC-SHA256 (Web Crypto API) so the
// helpers work in BOTH the edge runtime (middleware.ts) and the node runtime
// (API routes, server components). No JWT library needed for this surface.
//
// Cookie payload (JSON, base64url-encoded):
//   { adminId: number, exp: number }   // exp = unix seconds
// Cookie value: `${b64url(payload)}.${b64url(signature)}`
// ─────────────────────────────────────────────────────────────────────────────

import { cookies } from 'next/headers'

export const ADMIN_COOKIE_NAME = 'pk_admin_session'
export const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60 // 8h — short by design

interface AdminPayload {
  adminId: number
  exp: number
}

interface AdminSession {
  adminId: number
}

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('ADMIN_SESSION_SECRET must be set (≥ 16 chars)')
  }
  return secret
}

// ── base64url helpers (browser-safe; no Buffer to keep edge-runtime compat) ──

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): ArrayBuffer {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(padded)
  // Allocate over a fresh ArrayBuffer (not SharedArrayBuffer) for BufferSource compat
  const buf = new ArrayBuffer(bin.length)
  const view = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i)
  return buf
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

// ── HMAC ──────────────────────────────────────────────────────────────────────

async function getKey(): Promise<CryptoKey> {
  return globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

async function sign(payload: string): Promise<string> {
  const key = await getKey()
  const sig = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return toBase64Url(new Uint8Array(sig))
}

/**
 * Constant-time-ish comparison via Web Crypto verify(). Returns false on any
 * malformed input — never throws to the caller.
 */
async function verify(payload: string, signature: string): Promise<boolean> {
  try {
    const key = await getKey()
    const sigBuf = fromBase64Url(signature)
    return globalThis.crypto.subtle.verify('HMAC', key, sigBuf, encoder.encode(payload))
  } catch {
    return false
  }
}

// ── Session encode / decode ──────────────────────────────────────────────────

export async function createAdminSessionToken(adminId: number): Promise<string> {
  const payload: AdminPayload = {
    adminId,
    exp: Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS,
  }
  const encoded = toBase64Url(encoder.encode(JSON.stringify(payload)))
  const sig = await sign(encoded)
  return `${encoded}.${sig}`
}

export async function verifyAdminSessionToken(
  token: string | null | undefined,
): Promise<AdminSession | null> {
  if (!token) return null
  const dot = token.indexOf('.')
  if (dot < 0) return null

  const encoded = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  if (!encoded || !sig) return null

  if (!(await verify(encoded, sig))) return null

  try {
    const json = decoder.decode(fromBase64Url(encoded))
    const payload = JSON.parse(json) as Partial<AdminPayload>
    if (typeof payload.adminId !== 'number' || typeof payload.exp !== 'number') return null
    if (Date.now() / 1000 > payload.exp) return null
    return { adminId: payload.adminId }
  } catch {
    return null
  }
}

// ── Server-side helpers using next/headers (node runtime only) ───────────────

export async function getAdminSession(): Promise<AdminSession | null> {
  const jar = await cookies()
  const token = jar.get(ADMIN_COOKIE_NAME)?.value
  return verifyAdminSessionToken(token)
}

export async function setAdminSessionCookie(adminId: number): Promise<void> {
  const token = await createAdminSessionToken(adminId)
  const jar = await cookies()
  jar.set({
    name: ADMIN_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  })
}

export async function clearAdminSessionCookie(): Promise<void> {
  const jar = await cookies()
  jar.delete(ADMIN_COOKIE_NAME)
}
