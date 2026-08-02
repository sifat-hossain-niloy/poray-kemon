// PATCH /api/admin/reviews/[id]/moderation
//   body: { action: 'approve' | 'hide' | 'delete' }
//
// approve → moderation_status = 'live', status = 'visible'  (re-publishes a flagged/hidden review)
// hide    → moderation_status = 'flagged_hidden'            (removed from public view)
// delete  → status = 'deleted'                              (transparency-notice placeholder)
//
// We never hard-delete the row — the placeholder text on the public site
// depends on a row being there to render against.

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { CACHE_KEYS, deleteCache } from '@/lib/redis'
import {
  excludeReviewFromAggregate,
  includeReviewInAggregate,
  isCountedInAggregate,
} from '@/lib/aggregation-mutations'

export const dynamic = 'force-dynamic'

const schema = z.object({
  action: z.enum(['approve', 'hide', 'delete']),
  notes: z.string().trim().max(500).optional(),
})

interface RouteCtx {
  params: Promise<{ id: string }>
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const { id: idRaw } = await ctx.params
  const reviewId = Number(idRaw)
  if (!Number.isInteger(reviewId) || reviewId <= 0) {
    return NextResponse.json({ error: 'Invalid review id' }, { status: 400 })
  }

  const parsed = schema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    )
  }
  const { action, notes } = parsed.data

  const review = await db.review.findUnique({
    where: { id: reviewId },
    select: {
      professorCourseId: true,
      moderationStatus: true,
      status: true,
      professorCourse: { select: { professor: { select: { publicId: true } } } },
    },
  })
  if (!review) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data: Parameters<typeof db.review.update>[0]['data'] = {
    moderationNotes: notes ?? undefined,
  }
  let nextModerationStatus = review.moderationStatus
  let nextStatus = review.status
  if (action === 'approve') {
    data.moderationStatus = 'live'
    data.moderationReason = null
    data.status = 'visible'
    nextModerationStatus = 'live'
    nextStatus = 'visible'
  } else if (action === 'hide') {
    data.moderationStatus = 'flagged_hidden'
    nextModerationStatus = 'flagged_hidden'
  } else if (action === 'delete') {
    data.status = 'deleted'
    data.moderationStatus = 'deleted'
    nextStatus = 'deleted'
    nextModerationStatus = 'deleted'
  }

  const wasCounted = isCountedInAggregate(review.moderationStatus, review.status)
  const willBeCounted = isCountedInAggregate(nextModerationStatus, nextStatus)

  // Apply the review update and aggregate delta in one transaction so a mid-
  // write crash cannot leave the professor's public score out of sync with
  // the review's visibility.
  await db.$transaction(async (tx) => {
    if (wasCounted && !willBeCounted) {
      await excludeReviewFromAggregate(tx, reviewId)
    } else if (!wasCounted && willBeCounted) {
      await includeReviewInAggregate(tx, reviewId)
    }
    await tx.review.update({ where: { id: reviewId }, data })
  })

  // Invalidate caches the public site reads
  await Promise.all([
    deleteCache(CACHE_KEYS.siteStats),
    review.professorCourse.professor.publicId
      ? deleteCache(CACHE_KEYS.professorProfile(review.professorCourse.professor.publicId))
      : Promise.resolve(),
  ])

  return NextResponse.json({ ok: true, action })
}
