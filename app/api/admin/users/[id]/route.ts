// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/admin/users/[id] — remove a staff account.
//
// Role rules:
//   - The super_admin can never be deleted (403 SUPER_ADMIN_IMMUTABLE).
//   - The super_admin can delete both admins and moderators.
//   - An admin can delete moderators only.
//   - A user cannot delete themselves (guards against locking yourself out).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ id: string }>
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  const { session } = guard

  const { id: idRaw } = await ctx.params
  const id = Number(idRaw)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 })
  }

  if (id === session.adminId) {
    return NextResponse.json(
      { error: "You can't delete your own account", code: 'SELF_DELETE_FORBIDDEN' },
      { status: 400 },
    )
  }

  const target = await db.adminUser.findUnique({
    where: { id },
    select: { id: true, role: true, username: true },
  })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  if (target.role === 'super_admin') {
    return NextResponse.json(
      { error: 'The super-admin cannot be deleted', code: 'SUPER_ADMIN_IMMUTABLE' },
      { status: 403 },
    )
  }

  // Admins can only delete moderators. Super-admin can delete admins too.
  if (target.role === 'admin' && session.role !== 'super_admin') {
    return NextResponse.json(
      { error: 'Only the super-admin can delete other admins', code: 'FORBIDDEN' },
      { status: 403 },
    )
  }

  await db.adminUser.delete({ where: { id } })
  return NextResponse.json({ deleted: { id, username: target.username } })
}
