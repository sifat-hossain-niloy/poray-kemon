import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { setAdminSessionCookie } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs' // bcryptjs needs node, not edge

// Accepts both JSON (for fetch) and form-encoded (for the no-JS login page)
async function readCredentials(req: Request): Promise<{
  username: string
  password: string
  from: string
} | null> {
  const ct = req.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    const body = (await req.json().catch(() => null)) as {
      username?: string
      password?: string
      from?: string
    } | null
    if (!body) return null
    if (typeof body.username !== 'string' || typeof body.password !== 'string') return null
    return { username: body.username, password: body.password, from: body.from ?? '' }
  }
  const form = await req.formData().catch(() => null)
  if (!form) return null
  const username = form.get('username')
  const password = form.get('password')
  const from = form.get('from')
  if (typeof username !== 'string' || typeof password !== 'string') return null
  return { username, password, from: typeof from === 'string' ? from : '' }
}

function isSafeFromPath(from: string): boolean {
  // Only allow internal admin paths to prevent open-redirect via ?from=
  return from.startsWith('/admin') && !from.startsWith('//')
}

export async function POST(req: Request) {
  const creds = await readCredentials(req)
  if (!creds) {
    return NextResponse.redirect(new URL('/admin/login?error=1', req.url), { status: 303 })
  }

  const { username, password, from } = creds

  const admin = await db.adminUser.findUnique({
    where: { username },
    select: { id: true, passwordHash: true },
  })

  // Run bcrypt even on missing-user to keep timing similar.
  // Bogus hash with the right cost.
  const hashToCompare =
    admin?.passwordHash ?? '$2a$12$CwTycUXWue0Thq9StjUM0uJ8Z89.UpD8tQAQjA3.Vn3CmQs9hZ5TG'

  const ok = await bcrypt.compare(password, hashToCompare)
  if (!admin || !ok) {
    return NextResponse.redirect(new URL('/admin/login?error=1', req.url), { status: 303 })
  }

  await db.adminUser.update({ where: { id: admin.id }, data: { lastLogin: new Date() } })
  await setAdminSessionCookie(admin.id)

  const redirectTo = isSafeFromPath(from) ? from : '/admin'
  return NextResponse.redirect(new URL(redirectTo, req.url), { status: 303 })
}
