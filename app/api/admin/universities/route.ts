// POST /api/admin/universities
// Create a new university. Admin auth enforced by middleware.ts.

import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'
import { universityCreateSchema } from '@/lib/validations/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  const parsed = universityCreateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    )
  }
  const data = parsed.data

  try {
    const created = await db.university.create({
      data: {
        nameEn: data.nameEn,
        nameBn: data.nameBn || null,
        shortName: data.shortName,
        slug: data.slug,
        locationCity: data.locationCity || null,
        type: data.type,
        websiteUrl: data.websiteUrl || null,
      },
      select: { id: true, slug: true },
    })
    return NextResponse.json({ ok: true, university: created }, { status: 201 })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json(
        { error: 'A university with that slug, short name, or full name already exists' },
        { status: 409 },
      )
    }
    console.error('[admin/universities POST]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
