import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { setAdminSessionCookie, type AdminRoleLiteral } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs' // bcryptjs needs node, not edge

// Accepts both JSON (for fetch) and form-encoded (for the no-JS login page).
// The identifier field is `login` — the frontend sends whichever the user
// typed (email or username); the server figures out which one it is.
async function readCredentials(req: Request): Promise<{
  login: string
  password: string
  from: string
} | null> {
  const ct = req.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    const body = (await req.json().catch(() => null)) as {
      login?: string
      username?: string
      password?: string
      from?: string
    } | null
    if (!body) return null
    // Back-compat: accept `username` too (older clients / integration tests).
    const login = body.login ?? body.username
    if (typeof login !== 'string' || typeof body.password !== 'string') return null
    return { login, password: body.password, from: body.from ?? '' }
  }
  const form = await req.formData().catch(() => null)
  if (!form) return null
  const login = form.get('login') ?? form.get('username')
  const password = form.get('password')
  const from = form.get('from')
  if (typeof login !== 'string' || typeof password !== 'string') return null
  return { login, password, from: typeof from === 'string' ? from : '' }
}

function isSafeFromPath(from: string): boolean {
  // Allow internal admin/moderator paths to prevent open-redirect via ?from=
  if (!from || from.startsWith('//')) return false
  return from.startsWith('/admin') || from.startsWith('/moderator')
}

/** Whether the identifier looks like an email — a single '@' with something on both sides. */
function looksLikeEmail(s: string): boolean {
  const at = s.indexOf('@')
  return at > 0 && at < s.length - 1 && s.indexOf('@', at + 1) === -1
}

export async function POST(req: Request) {
  const creds = await readCredentials(req)
  const failRedirect = (fromHint: string) => {
    const target = fromHint.startsWith('/moderator/login')
      ? '/moderator/login?error=1'
      : '/admin/login?error=1'
    return NextResponse.redirect(new URL(target, req.url), { status: 303 })
  }

  if (!creds) return failRedirect(req.headers.get('referer') ?? '')

  const { login, password, from } = creds
  const referer = req.headers.get('referer') ?? ''

  const identifier = login.trim()
  const admin = looksLikeEmail(identifier)
    ? await db.adminUser.findUnique({
        where: { email: identifier },
        select: { id: true, passwordHash: true, role: true },
      })
    : await db.adminUser.findUnique({
        where: { username: identifier },
        select: { id: true, passwordHash: true, role: true },
      })

  // Run bcrypt even on missing-user to keep timing similar.
  const hashToCompare =
    admin?.passwordHash ?? '$2a$12$CwTycUXWue0Thq9StjUM0uJ8Z89.UpD8tQAQjA3.Vn3CmQs9hZ5TG'

  const ok = await bcrypt.compare(password, hashToCompare)
  if (!admin || !ok) return failRedirect(referer)

  const role = admin.role as AdminRoleLiteral

  await db.adminUser.update({ where: { id: admin.id }, data: { lastLogin: new Date() } })
  await setAdminSessionCookie(admin.id, role)

  // Post-login destination: honour ?from if it's safe; otherwise send the
  // user to the shared dashboard (moderators + admins both land on /admin —
  // the nav hides admin-only entries for moderators).
  const redirectTo = isSafeFromPath(from) ? from : '/admin'
  return NextResponse.redirect(new URL(redirectTo, req.url), { status: 303 })
}
