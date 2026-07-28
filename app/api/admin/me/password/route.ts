// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/me/password — self-service password change.
//
// Any authenticated staff row (super_admin, admin, moderator) can update
// their own password by proving they know the current one. This is the only
// way for the super_admin to rotate the seed-time password after first
// login — up until now the runbook told them to hand-craft a bcrypt hash
// and run raw SQL, which is not a workflow that survives contact with reality.
//
// Rules:
//   - `requireStaff` — any authenticated role, but only for the row keyed
//     by session.adminId. There is no path for one admin to change another's
//     password here; that responsibility stays in /admin/users (delete +
//     recreate, or add a separate admin-reset endpoint later).
//   - Current password must verify against the row's bcrypt hash.
//   - New password must differ from the current one (Zod schema).
//   - Failed attempts share the same 401 shape as a bad login so the
//     endpoint can't be used to enumerate valid passwords.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { requireStaff } from '@/lib/admin-auth'
import { adminPasswordChangeSchema } from '@/lib/validations/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs' // bcryptjs

export async function POST(req: Request) {
  const guard = await requireStaff()
  if (guard.error) return guard.error
  const { session } = guard

  const parsed = adminPasswordChangeSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    )
  }
  const { currentPassword, newPassword } = parsed.data

  const admin = await db.adminUser.findUnique({
    where: { id: session.adminId },
    select: { id: true, passwordHash: true },
  })
  if (!admin) {
    // Session references a row that no longer exists (deleted since login).
    // Treat as unauthenticated so the client can prompt for a fresh login.
    return NextResponse.json({ error: 'Session invalid' }, { status: 401 })
  }

  const ok = await bcrypt.compare(currentPassword, admin.passwordHash)
  if (!ok) {
    return NextResponse.json(
      { error: 'Current password is incorrect', code: 'BAD_CURRENT_PASSWORD' },
      { status: 401 },
    )
  }

  const newHash = await bcrypt.hash(newPassword, 12)
  await db.adminUser.update({
    where: { id: admin.id },
    data: { passwordHash: newHash },
  })

  return NextResponse.json({ ok: true })
}
