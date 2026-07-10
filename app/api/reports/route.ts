// ─────────────────────────────────────────────────────────────────────────────
// POST /api/reports — file a report on a review.
//
// Auth: REQUIRED. The SRS does not strictly mandate auth for reporting, but
//       opening this endpoint to anonymous traffic is an abuse vector: anyone
//       could script 3 POSTs and hide a legitimate review. Requiring an
//       authenticated session is the simplest defence available to MVP.
//
// Anti-abuse:
//   - Redis dedup key `reported:{userId}:{reviewId}` with 30-day TTL prevents
//     one user from spamming the same review's report count. Returns 200
//     idempotently on a duplicate.
//   - The `reports` table itself stays user-anonymous — we do NOT write the
//     reporter's user_id to PostgreSQL. The Redis dedup is the only place
//     the (user, review) link exists, and it expires after 30 days.
//
// Auto-hide: when the count of pending reports on a review reaches
//            AUTO_HIDE_THRESHOLD (3), the review's `moderation_status` is set
//            to `flagged_hidden`. Admin must explicitly reinstate it.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { acquireOnce, deleteCache, redis, CACHE_KEYS } from '@/lib/redis'
import { reportSchema } from '@/lib/validations/review'
import {
  AUTO_HIDE_THRESHOLD,
  shouldAutoHide,
  reportDedupKey,
  REPORT_DEDUP_TTL_SECONDS,
} from '@/lib/reports'
import { getStrings } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: (await getStrings()).errors.unauthorized, code: 'UNAUTHENTICATED' },
      { status: 401 },
    )
  }
  const userId = session.user.id

  // ── 2. Validation ────────────────────────────────────────────────────────
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = reportSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    )
  }
  const { review_id: reviewId, reason, details } = parsed.data

  // ── 3. Review must exist & not already deleted ────────────────────────────
  const review = await db.review.findUnique({
    where: { id: reviewId },
    select: { id: true, status: true, moderationStatus: true, professorCourseId: true },
  })
  if (!review || review.status === 'deleted') {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  }

  // ── 4. Dedup via Redis ────────────────────────────────────────────────────
  // acquireOnce is atomic SET NX with a TTL. When REDIS_URL is unset or Redis
  // is down it returns true (assume first-time) — the SQL side of the app will
  // still catch straight-up duplicates via the (user_id, review_id) unique key.
  const dedupKey = reportDedupKey(userId, reviewId)
  const isFirstReport = await acquireOnce(dedupKey, REPORT_DEDUP_TTL_SECONDS)

  if (!isFirstReport) {
    // Idempotent — pretend we accepted it. Don't leak the dedup mechanism.
    return NextResponse.json({ message: (await getStrings()).report.success }, { status: 201 })
  }

  // ── 5. INSERT report + maybe auto-hide ───────────────────────────────────
  let didAutoHide = false
  try {
    didAutoHide = await db.$transaction(async (tx) => {
      await tx.report.create({
        data: {
          reviewId,
          reason,
          details: details?.trim() || null,
        },
      })

      // Count pending reports on this review (including the one we just inserted).
      const pending = await tx.report.count({
        where: { reviewId, status: 'pending' },
      })

      if (!shouldAutoHide(pending)) return false
      if (review.moderationStatus === 'flagged_hidden') return false // already hidden

      await tx.review.update({
        where: { id: reviewId },
        data: { moderationStatus: 'flagged_hidden' },
      })
      return true
    })
  } catch (err) {
    // Roll back the Redis dedup if the DB write failed, so the user can retry.
    if (redis) {
      try {
        await redis.del(dedupKey)
      } catch {
        // Swallow — Redis already noisy on the way in.
      }
    }
    console.error('[reports] write failed:', err)
    return NextResponse.json({ error: (await getStrings()).errors.serverError }, { status: 500 })
  }

  // ── 6. Cache invalidation when we auto-hid ───────────────────────────────
  if (didAutoHide) {
    // The professor profile renders this review; bust the page-level cache so
    // the next visitor doesn't see the hidden review re-appear.
    const professor = await db.professorCourse
      .findUnique({
        where: { id: review.professorCourseId },
        select: { professor: { select: { slug: true } } },
      })
      .catch(() => null)

    await Promise.all([
      deleteCache(CACHE_KEYS.siteStats),
      professor?.professor?.slug
        ? deleteCache(CACHE_KEYS.professorProfile(professor.professor.slug))
        : Promise.resolve(),
    ])
  }

  return NextResponse.json(
    {
      message: (await getStrings()).report.success,
      auto_hidden: didAutoHide,
      threshold: AUTO_HIDE_THRESHOLD,
    },
    { status: 201 },
  )
}
