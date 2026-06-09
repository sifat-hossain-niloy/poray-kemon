// PATCH /api/admin/departments/[id]
// Update a department's fields. Admin-only.

import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { departmentUpdateSchema } from '@/lib/validations/admin'

export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ id: string }>
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const { id: idRaw } = await ctx.params
  const id = Number(idRaw)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid department id' }, { status: 400 })
  }

  const parsed = departmentUpdateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    )
  }
  const d = parsed.data
  const data: Prisma.DepartmentUpdateInput = {}
  if (d.nameEn !== undefined) data.nameEn = d.nameEn
  if (d.nameBn !== undefined) data.nameBn = d.nameBn || null
  if (d.shortName !== undefined) data.shortName = d.shortName || null
  if (d.slug !== undefined) data.slug = d.slug || null

  try {
    await db.department.update({ where: { id }, data })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2025') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      if (err.code === 'P2002') {
        return NextResponse.json(
          { error: 'Duplicate short name or slug for this university' },
          { status: 409 },
        )
      }
    }
    console.error('[admin/departments PATCH]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
