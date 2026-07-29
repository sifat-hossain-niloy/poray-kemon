// ─────────────────────────────────────────────────────────────────────────────
// Admin authentication
//
// Per SRS §4.5 FR-MOD-05 the admin panel must NOT share Google OAuth with
// regular users. Admins authenticate against the `admin_users` table with a
// username-or-email + bcrypt password and receive a separate session cookie.
//
// The cookie now carries `role` alongside `adminId` so gate checks (edge
// runtime middleware + node runtime handlers) can decide access without a DB
// hit. Tokens issued before this change fail signature check and are ignored.
//
// Cookie payload (JSON, base64url-encoded):
//   { adminId: number, role: AdminRoleLiteral, exp: number }   // exp = unix seconds
// Cookie value: `${b64url(payload)}.${b64url(signature)}`
//
// The role literal is duplicated as a string-union here rather than imported
// from @prisma/client — this file is loaded by middleware.ts in the edge
// runtime, where the Prisma client can't run.
// ─────────────────────────────────────────────────────────────────────────────

import { cookies } from 'next/headers'

export const ADMIN_COOKIE_NAME = 'pk_admin_session'
export const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60 // 8h — short by design

export type AdminRoleLiteral = 'super_admin' | 'admin' | 'moderator'

interface AdminPayload {
  adminId: number
  role: AdminRoleLiteral
  exp: number
}

export interface AdminSession {
  adminId: number
  role: AdminRoleLiteral
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

function fromBase64Url(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(padded)
  const view = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i)
  return view
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

const VALID_ROLES: readonly AdminRoleLiteral[] = ['super_admin', 'admin', 'moderator'] as const

function isRole(x: unknown): x is AdminRoleLiteral {
  return typeof x === 'string' && (VALID_ROLES as readonly string[]).includes(x)
}

export async function createAdminSessionToken(
  adminId: number,
  role: AdminRoleLiteral,
): Promise<string> {
  const payload: AdminPayload = {
    adminId,
    role,
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
    if (typeof payload.adminId !== 'number') return null
    if (typeof payload.exp !== 'number') return null
    if (!isRole(payload.role)) return null
    if (Date.now() / 1000 > payload.exp) return null
    return { adminId: payload.adminId, role: payload.role }
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

export async function setAdminSessionCookie(
  adminId: number,
  role: AdminRoleLiteral,
): Promise<void> {
  const token = await createAdminSessionToken(adminId, role)
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

// ── Role helpers ─────────────────────────────────────────────────────────────
// The routing surface has three concentric permission tiers:
//   - moderator+       (any authenticated staff row)
//   - admin+           (super_admin OR admin — anyone who can reshape the catalog)
//   - super_admin only (user management)
// Handlers call one of the require* helpers below and get either a session
// or a Response to return. Keeping the failure branch as a Response keeps
// each handler a one-liner.

import { NextResponse } from 'next/server'

export function canAdmin(role: AdminRoleLiteral): boolean {
  return role === 'super_admin' || role === 'admin'
}

export function canSuperAdmin(role: AdminRoleLiteral): boolean {
  return role === 'super_admin'
}

type Guard<T> = { session: AdminSession; error?: undefined } | { session?: undefined; error: T }

/** Any authenticated staff — used by moderation-queue endpoints. */
export async function requireStaff(): Promise<Guard<NextResponse>> {
  const session = await getAdminSession()
  if (!session) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  }
  return { session }
}

/** Admin or super_admin — used by catalog-editing endpoints. */
export async function requireAdmin(): Promise<Guard<NextResponse>> {
  const session = await getAdminSession()
  if (!session) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  }
  if (!canAdmin(session.role)) {
    return { error: NextResponse.json({ error: 'Admin role required' }, { status: 403 }) }
  }
  return { session }
}

/** Super_admin only — used by admin-user management endpoints. */
export async function requireSuperAdmin(): Promise<Guard<NextResponse>> {
  const session = await getAdminSession()
  if (!session) {
    return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  }
  if (!canSuperAdmin(session.role)) {
    return { error: NextResponse.json({ error: 'Super-admin role required' }, { status: 403 }) }
  }
  return { session }
}
