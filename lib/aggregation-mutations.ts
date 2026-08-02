// ─────────────────────────────────────────────────────────────────────────────
// Aggregate mutations on professor_courses.
//
// When a review is hidden or deleted, its contribution must be REMOVED from
// the running averages — otherwise a defamatory or spam review continues to
// pollute the professor's public score even after moderators pull it. When
// an admin approves a previously-hidden review back to visible, the reverse
// applies.
//
// The INSERT-time formula lives inline in app/api/reviews/route.ts (kept
// there because it runs in the same transaction as the review INSERT). This
// module is the mirror image, used from the three moderation code paths.
// ─────────────────────────────────────────────────────────────────────────────

import type { Prisma } from '@prisma/client'

type Tx = Prisma.TransactionClient

interface ReviewContribution {
  professorCourseId: number
  teachingQuality: number
  gradingFairness: number
  courseDifficulty: number
  attendanceStrictness: number
  wouldRecommend: boolean
}

async function loadContribution(tx: Tx, reviewId: number): Promise<ReviewContribution | null> {
  const r = await tx.review.findUnique({
    where: { id: reviewId },
    select: {
      professorCourseId: true,
      teachingQuality: true,
      gradingFairness: true,
      courseDifficulty: true,
      attendanceStrictness: true,
      wouldRecommend: true,
    },
  })
  return r
}

// Subtract this review's ratings from its professor_course aggregate.
// Safe to call inside a transaction that also updates the review row —
// call this BEFORE flipping moderation_status so the OLD values on the
// review row are still readable when needed.
export async function excludeReviewFromAggregate(tx: Tx, reviewId: number): Promise<void> {
  const r = await loadContribution(tx, reviewId)
  if (!r) return

  const wouldRec = r.wouldRecommend ? 100 : 0

  // The CASE guard handles the edge where this was the ONLY review — count
  // drops to 0 and every average must go NULL (division-by-zero otherwise).
  // All arithmetic uses the OLD column values (Postgres does not read its
  // own row updates within a single UPDATE).
  await tx.$executeRaw`
    UPDATE professor_courses
    SET
      review_count = review_count - 1,
      avg_teaching_quality = CASE
        WHEN review_count <= 1 THEN NULL
        ELSE (avg_teaching_quality * review_count - ${r.teachingQuality}) / (review_count - 1)
      END,
      avg_grading_fairness = CASE
        WHEN review_count <= 1 THEN NULL
        ELSE (avg_grading_fairness * review_count - ${r.gradingFairness}) / (review_count - 1)
      END,
      avg_course_difficulty = CASE
        WHEN review_count <= 1 THEN NULL
        ELSE (avg_course_difficulty * review_count - ${r.courseDifficulty}) / (review_count - 1)
      END,
      avg_attendance = CASE
        WHEN review_count <= 1 THEN NULL
        ELSE (avg_attendance * review_count - ${r.attendanceStrictness}) / (review_count - 1)
      END,
      would_recommend_pct = CASE
        WHEN review_count <= 1 THEN NULL
        ELSE (would_recommend_pct * review_count - ${wouldRec}) / (review_count - 1)
      END,
      overall_score = CASE
        WHEN review_count <= 1 THEN NULL
        ELSE (
          ((avg_teaching_quality * review_count - ${r.teachingQuality}) / (review_count - 1)) * 0.5
          + ((avg_grading_fairness * review_count - ${r.gradingFairness}) / (review_count - 1)) * 0.3
          + (((would_recommend_pct * review_count - ${wouldRec}) / (review_count - 1)) / 100 * 5) * 0.2
        )
      END,
      updated_at = NOW()
    WHERE id = ${r.professorCourseId}
  `
}

// Add this review's ratings back into its professor_course aggregate. Used
// when an admin approves a previously-hidden review back to live. Same
// formula as the INSERT-time update in app/api/reviews/route.ts.
export async function includeReviewInAggregate(tx: Tx, reviewId: number): Promise<void> {
  const r = await loadContribution(tx, reviewId)
  if (!r) return

  const wouldRec = r.wouldRecommend ? 100 : 0

  await tx.$executeRaw`
    UPDATE professor_courses
    SET
      avg_teaching_quality  = ((COALESCE(avg_teaching_quality,  0) * review_count) + ${r.teachingQuality})       / (review_count + 1),
      avg_grading_fairness  = ((COALESCE(avg_grading_fairness,  0) * review_count) + ${r.gradingFairness})       / (review_count + 1),
      avg_course_difficulty = ((COALESCE(avg_course_difficulty, 0) * review_count) + ${r.courseDifficulty})      / (review_count + 1),
      avg_attendance        = ((COALESCE(avg_attendance,        0) * review_count) + ${r.attendanceStrictness})  / (review_count + 1),
      would_recommend_pct   = ((COALESCE(would_recommend_pct,   0) * review_count) + ${wouldRec})                / (review_count + 1),
      overall_score = (
        ((COALESCE(avg_teaching_quality, 0) * review_count) + ${r.teachingQuality}) / (review_count + 1) * 0.5
        + ((COALESCE(avg_grading_fairness, 0) * review_count) + ${r.gradingFairness}) / (review_count + 1) * 0.3
        + (((COALESCE(would_recommend_pct, 0) * review_count) + ${wouldRec}) / (review_count + 1) / 100 * 5) * 0.2
      ),
      review_count = review_count + 1,
      updated_at = NOW()
    WHERE id = ${r.professorCourseId}
  `
}

// True when this moderation state means the review's ratings ARE currently
// contributing to the professor_course aggregate. Insert-time defaults set
// moderationStatus to 'live' or 'soft_flagged' — both count. When a mod
// hides or the auto-hide-on-3-reports fires, it flips to 'flagged_hidden'
// (excluded). Delete sets status='deleted' (also excluded).
export function isCountedInAggregate(
  moderationStatus: string | null | undefined,
  status: string | null | undefined,
): boolean {
  if (status === 'deleted') return false
  if (moderationStatus === 'flagged_hidden' || moderationStatus === 'deleted') return false
  return true
}
