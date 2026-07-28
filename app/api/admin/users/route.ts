// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/users — create a new staff account (admin or moderator).
//
// Role rules:
//   - super_admin can create admins and moderators
//   - admin can create moderators only
//   - moderator cannot hit this endpoint (requireAdmin below rejects them)
//   - creating a second super_admin is impossible — the DB partial unique
//     index on role='super_admin' would reject it, AND the schema in
//     lib/validations/admin.ts doesn't accept 'super_admin' as a role value.
//
// Passwords are bcrypt-hashed at cost 12 (matches the seed script).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { adminUserCreateSchema } from '@/lib/validations/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs' // bcryptjs

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  const { session } = guard

  const parsed = adminUserCreateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    )
  }
  const { username, email, password, role } = parsed.data

  // Non-super admins can only create moderators. This is a policy check on
  // TOP of the schema-level role restriction — belt and braces so a rogue
  // client can't smuggle role=admin from an admin session.
  if (role === 'admin' && session.role !== 'super_admin') {
    return NextResponse.json(
      { error: 'Only the super-admin can create other admins', code: 'FORBIDDEN' },
      { status: 403 },
    )
  }

  const passwordHash = await bcrypt.hash(password, 12)

  try {
    const created = await db.adminUser.create({
      data: {
        username,
        email: email?.trim() || null,
        passwordHash,
        role,
        createdBy: session.adminId,
      },
      select: { id: true, username: true, email: true, role: true, createdAt: true },
    })
    return NextResponse.json({ user: created }, { status: 201 })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // 'admin_users_username_key' | 'admin_users_email_key'
      const target = String(err.meta?.target ?? 'field')
      return NextResponse.json(
        { error: `That ${target.includes('email') ? 'email' : 'username'} is already taken` },
        { status: 409 },
      )
    }
    throw err
  }
}
