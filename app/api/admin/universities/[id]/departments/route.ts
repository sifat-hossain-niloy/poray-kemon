// POST /api/admin/universities/[id]/departments
// Create a department under a specific university. Admin-only.

import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { departmentCreateSchema } from '@/lib/validations/admin'
import { slugify } from '@/lib/slug'

export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ id: string }>
}

export async function POST(req: Request, ctx: RouteCtx) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  const { id: idRaw } = await ctx.params
  const universityId = Number(idRaw)
  if (!Number.isInteger(universityId) || universityId <= 0) {
    return NextResponse.json({ error: 'Invalid university id' }, { status: 400 })
  }

  const parsed = departmentCreateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    )
  }
  const d = parsed.data

  // Confirm the parent university exists
  const uni = await db.university.findUnique({ where: { id: universityId }, select: { id: true } })
  if (!uni) {
    return NextResponse.json({ error: 'University not found' }, { status: 404 })
  }

  // Derive slug from shortName or nameEn if not supplied — keeps URLs sane
  const slug = (d.slug && d.slug.trim()) || slugify(d.shortName || d.nameEn) || null

  try {
    const created = await db.department.create({
      data: {
        universityId,
        nameEn: d.nameEn,
        nameBn: d.nameBn || null,
        shortName: d.shortName || null,
        slug,
      },
      select: { id: true, slug: true },
    })
    return NextResponse.json({ ok: true, department: created }, { status: 201 })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json(
        { error: 'A department with that short name or slug already exists in this university' },
        { status: 409 },
      )
    }
    console.error('[admin/departments POST]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
