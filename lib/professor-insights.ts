// ─────────────────────────────────────────────────────────────────────────────
// Per-page queries behind the professor-profile insights (SRS §4.6
// FR-STAT-02, §4.8 FR-AUTH-05). Pure shaping lives in lib/review-insights.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { COUNTED_MODERATION_STATES, ratingDistribution, type TagCount } from '@/lib/review-insights'

export async function loadProfessorInsights({
  professorCourseIds,
  previewReviewIds,
  viewerId,
}: {
  professorCourseIds: number[]
  /** Reviews rendered on the page — only these need per-viewer vote state. */
  previewReviewIds: number[]
  viewerId: string | null
}) {
  const pcIds = professorCourseIds
  const [votes, mySubmissions, tagRows, teachingBuckets] = await Promise.all([
    viewerId && previewReviewIds.length > 0
      ? db.helpfulVote.findMany({
          where: { userId: viewerId, reviewId: { in: previewReviewIds } },
          select: { reviewId: true },
        })
      : [],
    // FR-AUTH-05: review_submissions holds only (user, professor_course), so
    // telling the viewer which courses they reviewed never touches content.
    viewerId && pcIds.length > 0
      ? db.reviewSubmission.findMany({
          where: { userId: viewerId, professorCourseId: { in: pcIds } },
          select: { professorCourseId: true },
        })
      : [],
    pcIds.length > 0
      ? db.$queryRaw<Array<{ pc_id: number; tag: string; count: number }>>`
          SELECT r.professor_course_id AS pc_id, t.tag, COUNT(*)::int AS count
          FROM reviews r, unnest(r.tags) AS t(tag)
          WHERE r.professor_course_id IN (${Prisma.join(pcIds)})
            AND r.status = 'visible'
            AND r.moderation_status IN ('live', 'soft_flagged')
          GROUP BY 1, 2
        `
      : [],
    pcIds.length > 0
      ? db.review.groupBy({
          by: ['teachingQuality'],
          where: {
            professorCourseId: { in: pcIds },
            status: 'visible',
            moderationStatus: { in: [...COUNTED_MODERATION_STATES] },
          },
          _count: { _all: true },
        })
      : [],
  ])

  const tagsByCourse = new Map<number, TagCount[]>()
  const tagTotals = new Map<string, number>()
  for (const row of tagRows) {
    const bucket = tagsByCourse.get(row.pc_id) ?? []
    bucket.push({ tag: row.tag, count: row.count })
    tagsByCourse.set(row.pc_id, bucket)
    tagTotals.set(row.tag, (tagTotals.get(row.tag) ?? 0) + row.count)
  }

  return {
    votedReviewIds: new Set(votes.map((v) => v.reviewId)),
    reviewedCourseIds: new Set(mySubmissions.map((s) => s.professorCourseId)),
    tagsByCourse,
    professorTags: [...tagTotals].map(([tag, count]) => ({ tag, count })),
    distribution: ratingDistribution(
      teachingBuckets.map((b) => ({ value: b.teachingQuality, count: b._count._all })),
    ),
  }
}
