import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { getLocale } from '@/lib/i18n'
import { Card, CardContent } from '@/components/ui/card'
import { ReviewCard, type ReviewCardData } from '@/components/review/ReviewCard'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title: locale === 'en' ? 'Recent reviews' : 'সাম্প্রতিক রিভিউ',
    description:
      locale === 'en'
        ? 'The most recent anonymous reviews across all professors.'
        : 'সব শিক্ষকের সাম্প্রতিক বেনামী রিভিউ।',
  }
}

// Feed is per-request — never cache. The join has no user identifier,
// so ordering by submittedAt DESC is safe.
export const dynamic = 'force-dynamic'

const PAGE_SIZE = 30

// Anonymity note: this feed sorts reviews by `reviews.submitted_at` — the
// only timestamp left in the anonymity path after the 20260731 migration.
// The submission table has no timestamp of its own, so nothing in this
// order can be joined back to who submitted what.
async function getRecentReviews() {
  return db.review.findMany({
    where: { status: 'visible', moderationStatus: 'live' },
    orderBy: [{ submittedAt: 'desc' }],
    take: PAGE_SIZE,
    select: {
      id: true,
      teachingQuality: true,
      gradingFairness: true,
      courseDifficulty: true,
      attendanceStrictness: true,
      wouldRecommend: true,
      reviewText: true,
      tags: true,
      helpfulCount: true,
      submittedAt: true,
      moderationStatus: true,
      professorCourse: {
        select: {
          professor: {
            select: {
              publicId: true,
              nameEn: true,
              nameBn: true,
              university: { select: { shortName: true, slug: true } },
              department: { select: { shortName: true, nameEn: true, slug: true } },
            },
          },
          course: { select: { courseCode: true, courseName: true } },
        },
      },
    },
  })
}

export default async function RecentReviewsPage() {
  const [reviews, locale, session] = await Promise.all([getRecentReviews(), getLocale(), auth()])
  const viewerId = session?.user?.id ?? null

  // Fetch viewer's helpful votes for every review on the page in one query
  // so each ReviewCard renders with the right toggle state.
  const votedIds = new Set<number>()
  if (viewerId && reviews.length > 0) {
    const votes = await db.helpfulVote.findMany({
      where: { userId: viewerId, reviewId: { in: reviews.map((r) => r.id) } },
      select: { reviewId: true },
    })
    votes.forEach((v) => votedIds.add(v.reviewId))
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {locale === 'en' ? 'Recent reviews' : 'সাম্প্রতিক রিভিউ'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {locale === 'en'
            ? 'The latest anonymous reviews across every professor and course.'
            : 'সকল শিক্ষক ও কোর্সের সবচেয়ে সাম্প্রতিক বেনামী রিভিউ।'}
        </p>
      </header>

      {reviews.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {locale === 'en'
              ? 'No reviews have been posted yet. You could be the first.'
              : 'এখনো কোনো রিভিউ নেই। আপনিই প্রথম হতে পারেন।'}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => {
            const cardData: ReviewCardData = {
              id: r.id,
              teachingQuality: r.teachingQuality,
              gradingFairness: r.gradingFairness,
              courseDifficulty: r.courseDifficulty,
              attendanceStrictness: r.attendanceStrictness,
              wouldRecommend: r.wouldRecommend,
              reviewText: r.reviewText,
              tags: r.tags,
              helpfulCount: r.helpfulCount,
              submittedAt: r.submittedAt,
              moderationStatus: r.moderationStatus,
            }
            return (
              <li key={r.id}>
                <ReviewCard
                  review={cardData}
                  userVoted={votedIds.has(r.id)}
                  context={{
                    professor: {
                      publicId: r.professorCourse.professor.publicId,
                      nameEn: r.professorCourse.professor.nameEn,
                      nameBn: r.professorCourse.professor.nameBn,
                    },
                    university: r.professorCourse.professor.university,
                    department: r.professorCourse.professor.department,
                    course: r.professorCourse.course,
                  }}
                />
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
