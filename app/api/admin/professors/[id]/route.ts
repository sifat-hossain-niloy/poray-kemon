// PATCH /api/admin/professors/[id]
//   body: { status?: 'active' | 'retired' | 'unverified',
//           designation?: ..., nameEn?: ..., nameBn?: ... }

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { CACHE_KEYS, deleteCache } from '@/lib/redis'

export const dynamic = 'force-dynamic'

const schema = z
  .object({
    status: z.enum(['active', 'retired', 'unverified']).optional(),
    designation: z
      .enum([
        'lecturer',
        'assistant_professor',
        'associate_professor',
        'professor',
        'adjunct',
        'other',
      ])
      .optional(),
    nameEn: z.string().trim().min(2).max(200).optional(),
    nameBn: z.string().trim().max(200).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'At least one field is required',
  })

interface RouteCtx {
  params: Promise<{ id: string }>
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const { id: idRaw } = await ctx.params
  const id = Number(idRaw)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid professor id' }, { status: 400 })
  }

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const existing = await db.professor.findUnique({
    where: { id },
    select: { publicId: true },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.professor.update({ where: { id }, data: parsed.data })

  await deleteCache(CACHE_KEYS.professorProfile(existing.publicId))

  return NextResponse.json({ ok: true })
}
