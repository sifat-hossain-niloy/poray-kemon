// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/departments/merge
//
// Collapses several "duplicate" department rows under one canonical target —
// the most-common admin operation once the review form starts auto-creating
// departments. A student typing "CSE", "C.S.E.", or "Computer Science and
// Engineering" can each spawn a new row; this endpoint lets an admin point
// them all at one canonical row in a single transaction.
//
// Steps inside the transaction:
//   1. Sanity-check: every source id and the target must belong to the same
//      university. We never merge cross-university — that would silently
//      reassign professors to a different institution.
//   2. Repoint dependent rows: professors.department_id and
//      courses.department_id all switch from source → target. There is no
//      cascade in the schema; doing this manually keeps the FK happy.
//   3. Mark the target as `verified` — the merge is an explicit admin
//      endorsement of that row as the canonical name.
//   4. Delete the source rows.
//
// The whole thing runs in db.$transaction so a partial failure rolls back.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

// Middleware guarantees an authenticated staff session; requireAdmin below
// then narrows to admin+super_admin (merging repoints FKs — moderators
// don't get to do this).

const mergeBodySchema = z.object({
  target_id: z.number().int().positive(),
  source_ids: z.array(z.number().int().positive()).min(1).max(50),
})

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = mergeBodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    )
  }
  const { target_id, source_ids } = parsed.data

  if (source_ids.includes(target_id)) {
    return NextResponse.json({ error: 'target_id must not be in source_ids' }, { status: 400 })
  }

  const result = await db
    .$transaction(async (tx) => {
      const target = await tx.department.findUnique({
        where: { id: target_id },
        select: { id: true, universityId: true, nameEn: true },
      })
      if (!target) throw new MergeError(404, 'Target department not found')

      const sources = await tx.department.findMany({
        where: { id: { in: source_ids } },
        select: { id: true, universityId: true },
      })
      if (sources.length !== source_ids.length) {
        throw new MergeError(404, 'One or more source departments not found')
      }
      for (const src of sources) {
        if (src.universityId !== target.universityId) {
          throw new MergeError(
            400,
            'All departments must belong to the same university — cross-university merges are not allowed',
          )
        }
      }

      // Repoint professors. Their (universityId, departmentId) composite stays
      // consistent because we already verified everyone shares a universityId.
      const movedProfs = await tx.professor.updateMany({
        where: { departmentId: { in: source_ids } },
        data: { departmentId: target_id },
      })
      const movedCourses = await tx.course.updateMany({
        where: { departmentId: { in: source_ids } },
        data: { departmentId: target_id },
      })

      // Mark the merge target as the canonical row.
      await tx.department.update({
        where: { id: target_id },
        data: { status: 'verified' },
      })

      // Delete the source rows.
      const deleted = await tx.department.deleteMany({
        where: { id: { in: source_ids } },
      })

      return {
        target: { id: target.id, nameEn: target.nameEn },
        moved_professors: movedProfs.count,
        moved_courses: movedCourses.count,
        deleted_departments: deleted.count,
      }
    })
    .catch((err: unknown) => {
      if (err instanceof MergeError) return { __error: err }
      throw err
    })

  if ('__error' in result) {
    return NextResponse.json({ error: result.__error.message }, { status: result.__error.status })
  }

  return NextResponse.json(result)
}

class MergeError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}
