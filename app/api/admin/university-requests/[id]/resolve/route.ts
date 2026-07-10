// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/university-requests/[id]/resolve
//
// Admin-only (middleware gates the path). Body:
//   { action: 'approve' | 'reject', admin_note?, short_name?, slug?, location_city? }
//
// On approve: creates the University row from the request's fields, allowing
// the admin to override short_name/slug/location_city before publishing.
// The whole thing runs in one transaction so a failed uni-insert (unique
// short_name/slug collision, etc.) doesn't leave the request half-resolved.
//
// On reject: just flips status. The admin_note is surfaced back to the
// requester so they know why. No side effects on other tables.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { universityRequestResolveSchema } from '@/lib/validations/admin'
import { slugify } from '@/lib/slug'

export const dynamic = 'force-dynamic'

interface RouteCtx {
  params: Promise<{ id: string }>
}

export async function POST(req: Request, ctx: RouteCtx) {
  const { id: idRaw } = await ctx.params
  const id = Number(idRaw)
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid request id' }, { status: 400 })
  }

  const parsed = universityRequestResolveSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    )
  }
  const { action, admin_note, short_name, slug, location_city } = parsed.data

  try {
    const result = await db.$transaction(async (tx) => {
      const request = await tx.universityRequest.findUnique({
        where: { id },
        select: {
          id: true,
          nameEn: true,
          nameBn: true,
          type: true,
          status: true,
        },
      })
      if (!request) throw new ResolveError(404, 'Request not found')
      if (request.status !== 'pending') {
        throw new ResolveError(409, `Request is already ${request.status}`)
      }

      let createdUniversity: { id: number; slug: string; shortName: string } | null = null

      if (action === 'approve') {
        // Fall back to name-derived defaults when the admin didn't override.
        // For shortName, if the admin didn't provide one, take the initials
        // of the name (skipping common stopwords), capped at 20 chars.
        const effectiveShort =
          short_name?.trim() ||
          request.nameEn
            .split(/\s+/)
            .filter((w) => w.length > 0 && !['of', 'and', 'the', 'for'].includes(w.toLowerCase()))
            .map((w) => w[0]!.toUpperCase())
            .join('')
            .slice(0, 20) ||
          'UNI'
        const effectiveSlug = slug?.trim() || slugify(effectiveShort).slice(0, 50)

        createdUniversity = await tx.university.create({
          data: {
            nameEn: request.nameEn,
            nameBn: request.nameBn,
            shortName: effectiveShort,
            slug: effectiveSlug,
            type: request.type,
            locationCity: location_city?.trim() || null,
          },
          select: { id: true, slug: true, shortName: true },
        })
      }

      const resolved = await tx.universityRequest.update({
        where: { id: request.id },
        data: {
          status: action === 'approve' ? 'approved' : 'rejected',
          adminNote: admin_note?.trim() || null,
          resolvedAt: new Date(),
        },
        select: { id: true, status: true, resolvedAt: true },
      })

      return { request: resolved, university: createdUniversity }
    })

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ResolveError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    // P2002 == unique constraint. Almost always a name/short_name/slug clash
    // with an existing uni that snuck past our reviewer-facing dedup check.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json(
        {
          error: `Unique constraint on ${String(err.meta?.target)} — pick a different short_name/slug and try again`,
          code: 'UNIQUE_VIOLATION',
        },
        { status: 409 },
      )
    }
    throw err
  }
}

class ResolveError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}
