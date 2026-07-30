import Link from 'next/link'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { getLocale, getStrings } from '@/lib/i18n'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { obfuscateName } from '@/lib/name-obfuscation'

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
      wouldRecommend: true,
      reviewText: true,
      tags: true,
      helpfulCount: true,
      submittedAt: true,
      professorCourse: {
        select: {
          professor: { select: { publicId: true, nameEn: true } },
          course: { select: { courseCode: true, courseName: true } },
        },
      },
    },
  })
}

export default async function RecentReviewsPage() {
  const [reviews, strings, locale] = await Promise.all([
    getRecentReviews(),
    getStrings(),
    getLocale(),
  ])
  const dateFormatter = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'bn-BD', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const tagLabels = strings.tags as Record<string, string>

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
            const courseLabel = r.professorCourse.course.courseCode
              ? `${r.professorCourse.course.courseCode} · ${r.professorCourse.course.courseName}`
              : r.professorCourse.course.courseName
            return (
              <li key={r.id}>
                <Card>
                  <CardContent className="space-y-3 py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                      <Link
                        href={`/professors/${r.professorCourse.professor.publicId}`}
                        className="font-semibold hover:underline"
                      >
                        {obfuscateName(r.professorCourse.professor.nameEn)}
                      </Link>
                      <span className="text-xs text-muted-foreground">{courseLabel}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
                      <RatingRow
                        value={r.teachingQuality}
                        label={strings.ratings.teachingQuality}
                      />
                      <RatingRow
                        value={r.gradingFairness}
                        label={strings.ratings.gradingFairness}
                      />
                      <Badge variant={r.wouldRecommend ? 'default' : 'outline'} className="ml-auto">
                        {r.wouldRecommend
                          ? strings.reviewDisplay.wouldRecommend
                          : strings.reviewDisplay.wouldNotRecommend}
                      </Badge>
                    </div>

                    {r.reviewText ? (
                      <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                        {r.reviewText}
                      </p>
                    ) : null}

                    {r.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {r.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px]">
                            {tagLabels[tag] ?? tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}

                    <div className="text-xs text-muted-foreground">
                      <time dateTime={r.submittedAt.toISOString()}>
                        {dateFormatter.format(r.submittedAt)}
                      </time>
                    </div>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}

function RatingRow({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}:</span>
      <span aria-label={`${label} ${value} out of 5`}>
        <span className="text-yellow-500">{'★'.repeat(value)}</span>
        <span className="text-muted-foreground/40">{'★'.repeat(5 - value)}</span>
      </span>
    </span>
  )
}
