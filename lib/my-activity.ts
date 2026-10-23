// ─────────────────────────────────────────────────────────────────────────────
// Data for /me (SRS §4.8 FR-AUTH-05).
//
// Everything is scoped to ONE account id and read from the tables that are
// legitimately linked to an account: users, review_submissions,
// helpful_votes, university_requests. Nothing here reads reviews by author —
// that link does not exist.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from '@/lib/db'
import { obfuscateName } from '@/lib/name-obfuscation'

export const HELPFUL_LIMIT = 50

/** A voted-on review that no longer shows publicly must not leak its text
 *  through the voter's activity page. */
export function isReviewRemoved(review: { status: string; moderationStatus: string }): boolean {
  return (
    review.status !== 'visible' ||
    review.moderationStatus === 'flagged_hidden' ||
    review.moderationStatus === 'deleted'
  )
}

export async function loadMyActivity(userId: string) {
  const [user, submissions, votes, requests] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { createdAt: true, emailDomain: true },
    }),
    db.reviewSubmission.findMany({
      where: { userId },
      select: {
        id: true,
        professorCourse: {
          select: {
            course: { select: { courseCode: true, courseName: true, slug: true } },
            professor: {
              select: {
                publicId: true,
                nameEn: true,
                nameBn: true,
                university: { select: { shortName: true } },
                department: { select: { shortName: true, nameEn: true } },
              },
            },
          },
        },
      },
    }),
    db.helpfulVote.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: HELPFUL_LIMIT,
      select: {
        id: true,
        review: {
          select: {
            id: true,
            reviewText: true,
            status: true,
            moderationStatus: true,
            professorCourse: {
              select: {
                course: { select: { courseCode: true, courseName: true } },
                professor: { select: { publicId: true, nameEn: true, nameBn: true } },
              },
            },
          },
        },
      },
    }),
    db.universityRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, nameEn: true, status: true, adminNote: true, createdAt: true },
    }),
  ])

  // review_submissions has no timestamp by design, so order alphabetically.
  const reviewed = submissions
    .map((s) => ({
      id: s.id,
      displayName:
        s.professorCourse.professor.nameBn ?? obfuscateName(s.professorCourse.professor.nameEn),
      professor: s.professorCourse.professor,
      course: s.professorCourse.course,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName))

  const helpful = votes.map((v) => {
    const removed = isReviewRemoved(v.review)
    const prof = v.review.professorCourse.professor
    return {
      id: v.id,
      reviewId: v.review.id,
      professorPublicId: prof.publicId,
      professorName: prof.nameBn ?? obfuscateName(prof.nameEn),
      course: v.review.professorCourse.course,
      removed,
      // Removed reviews never surface their text, even to someone who once
      // voted on them.
      reviewText: removed ? null : v.review.reviewText,
    }
  })

  return { user, reviewed, helpful, requests }
}

export type MyActivity = Awaited<ReturnType<typeof loadMyActivity>>
