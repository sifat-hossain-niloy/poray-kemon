// PATCH /api/admin/universities/[id]
// Update fields on a university. Admin auth enforced by middleware.ts.

import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { universityUpdateSchema } from '@/lib/validations/admin'

export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ id: string }>
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  const { id: idRaw } = await ctx.params
  const id = Number(idRaw)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid university id' }, { status: 400 })
  }

  const parsed = universityUpdateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  // Build patch object — only forward keys that were actually provided
  const d = parsed.data
  const data: Prisma.UniversityUpdateInput = {}
  if (d.nameEn !== undefined) data.nameEn = d.nameEn
  if (d.nameBn !== undefined) data.nameBn = d.nameBn || null
  if (d.shortName !== undefined) data.shortName = d.shortName
  if (d.slug !== undefined) data.slug = d.slug
  if (d.locationCity !== undefined) data.locationCity = d.locationCity || null
  if (d.type !== undefined) data.type = d.type
  if (d.websiteUrl !== undefined) data.websiteUrl = d.websiteUrl || null

  try {
    await db.university.update({ where: { id }, data })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      if (err.code === 'P2002') {
        return NextResponse.json({ error: 'Duplicate slug / short name / name' }, { status: 409 })
      }
    }
    console.error('[admin/universities PATCH]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
