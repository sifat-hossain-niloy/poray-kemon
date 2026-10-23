// ─────────────────────────────────────────────────────────────────────────────
// Data loading for /professors/[publicId].
//
// Two waves of queries, whatever the number of courses:
//   1. the professor with everything the page renders (one joined SELECT,
//      shared by generateMetadata and the page via React cache())
//   2. per-page extras in parallel — tags, rating distribution, semester
//      trend, and (signed in only) the viewer's votes and submissions
// Each sequential round trip costs real latency on serverless, so keep new
// queries inside wave 2 rather than awaiting them one after another.
// ─────────────────────────────────────────────────────────────────────────────

import { cache } from 'react'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { COUNTED_MODERATION_STATES, ratingDistribution, type TagCount } from '@/lib/review-insights'
import { loadSemesterTrend } from '@/lib/semester-trend'

export const REVIEWS_PER_COURSE_PREVIEW = 3

export const getProfessorForPage = cache(async (publicId: string) =>
  db.professor.findUnique({
    relationLoadStrategy: 'join',
    where: { publicId },
    include: {
      university: true,
      department: true,
      professorCourses: {
        orderBy: { reviewCount: 'desc' },
        include: {
          course: true,
          reviews: {
            where: { status: 'visible' },
            orderBy: [{ helpfulCount: 'desc' }, { submittedAt: 'desc' }],
            take: REVIEWS_PER_COURSE_PREVIEW,
          },
        },
      },
    },
  }),
)

export async function loadProfessorExtras({
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
  const [votes, mySubmissions, tagRows, teachingBuckets, trend] = await Promise.all([
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
    loadSemesterTrend(pcIds),
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
    trend,
  }
}
