// POST /api/admin/reports/[id]/resolve
//   body: { action: 'keep' | 'remove' }
//
// keep   → reports.status = 'resolved_kept'; review left as-is
// remove → reports.status = 'resolved_removed'; review.status = 'deleted'
//          (transparency placeholder rendered in its place)

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { CACHE_KEYS, deleteCache } from '@/lib/redis'

export const dynamic = 'force-dynamic'

const schema = z.object({
  action: z.enum(['keep', 'remove']),
})

interface RouteCtx {
  params: Promise<{ id: string }>
}

export async function POST(req: Request, ctx: RouteCtx) {
  const { id: idRaw } = await ctx.params
  const reportId = Number(idRaw)
  if (!Number.isInteger(reportId) || reportId <= 0) {
    return NextResponse.json({ error: 'Invalid report id' }, { status: 400 })
  }

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
  }
  const { action } = parsed.data

  const report = await db.report.findUnique({
    where: { id: reportId },
    select: {
      reviewId: true,
      review: {
        select: {
          professorCourse: { select: { professor: { select: { slug: true } } } },
        },
      },
    },
  })
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.$transaction(async (tx) => {
    await tx.report.update({
      where: { id: reportId },
      data: {
        status: action === 'keep' ? 'resolved_kept' : 'resolved_removed',
        resolvedAt: new Date(),
      },
    })

    if (action === 'remove') {
      await tx.review.update({
        where: { id: report.reviewId },
        data: { status: 'deleted', moderationStatus: 'deleted' },
      })
    } else {
      // Keep — if the review was auto-hidden via 3-strike, leave it; admin can
      // re-approve it from the queue page separately.
    }
  })

  await Promise.all([
    deleteCache(CACHE_KEYS.siteStats),
    report.review.professorCourse.professor.slug
      ? deleteCache(CACHE_KEYS.professorProfile(report.review.professorCourse.professor.slug))
      : Promise.resolve(),
  ])

  return NextResponse.json({ ok: true, action })
}
