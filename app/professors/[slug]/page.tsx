import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ReviewCard } from '@/components/review/ReviewCard'
import { combineProfessorStats } from '@/lib/professor-stats'
import { obfuscateName } from '@/lib/name-obfuscation'
import { getLocale, getStrings } from '@/lib/i18n'
import Link from 'next/link'

// Dynamic: per-viewer vote state can't be cached.
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ slug: string }>
}

const REVIEWS_PER_COURSE_PREVIEW = 3

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const prof = await db.professor.findUnique({
    where: { slug },
    select: { nameEn: true, nameBn: true },
  })
  if (!prof) return { title: 'Not found' }
  // Title + meta description are indexed by search engines — never leak the
  // real English name here. Bangla name is fine (different attack surface).
  const displayEn = obfuscateName(prof.nameEn)
  return {
    title: prof.nameBn ?? displayEn,
    description: `${displayEn} এর শিক্ষাগত রিভিউ ও রেটিং`,
  }
}

export default async function ProfessorPage({ params }: PageProps) {
  const [strings, locale] = await Promise.all([getStrings(), getLocale()])
  const numberLocale = locale === 'en' ? 'en-US' : 'bn-BD'
  const breadcrumbLabel = locale === 'en' ? 'Universities' : 'বিশ্ববিদ্যালয়'
  const coursesHeading = locale === 'en' ? 'Courses' : 'কোর্সসমূহ'
  const coursesSuffix = locale === 'en' ? 'courses' : 'টি কোর্স'
  const outOfFive = locale === 'en' ? '/ 5' : '/ ৫'
  const seeAll = (n: number) =>
    locale === 'en'
      ? `See all ${n.toLocaleString(numberLocale)} reviews →`
      : `সব ${n.toLocaleString(numberLocale)} রিভিউ দেখুন →`
  const { slug } = await params
  const session = await auth()
  const viewerId = session?.user?.id ?? null

  const professor = await db.professor.findUnique({
    where: { slug },
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
  })

  if (!professor) notFound()

  // Combined weighted score across all courses
  const combined = combineProfessorStats(
    professor.professorCourses.map((pc) => ({
      reviewCount: pc.reviewCount,
      avgTeachingQuality: pc.avgTeachingQuality ? Number(pc.avgTeachingQuality.toString()) : null,
      avgGradingFairness: pc.avgGradingFairness ? Number(pc.avgGradingFairness.toString()) : null,
      avgCourseDifficulty: pc.avgCourseDifficulty
        ? Number(pc.avgCourseDifficulty.toString())
        : null,
      avgAttendance: pc.avgAttendance ? Number(pc.avgAttendance.toString()) : null,
      wouldRecommendPct: pc.wouldRecommendPct ? Number(pc.wouldRecommendPct.toString()) : null,
      overallScore: pc.overallScore ? Number(pc.overallScore.toString()) : null,
    })),
  )

  // Fan-out viewer's votes across every review on the page in ONE query
  const allReviewIds = professor.professorCourses.flatMap((pc) => pc.reviews.map((r) => r.id))
  const votedIds = new Set<number>()
  if (viewerId && allReviewIds.length > 0) {
    const votes = await db.helpfulVote.findMany({
      where: { userId: viewerId, reviewId: { in: allReviewIds } },
      select: { reviewId: true },
    })
    votes.forEach((v) => votedIds.add(v.reviewId))
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="mb-8">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <Link href="/universities" className="text-muted-foreground hover:text-foreground">
            {breadcrumbLabel}
          </Link>
          <span className="text-muted-foreground">›</span>
          <Link
            href={`/universities/${professor.university.slug}`}
            className="text-muted-foreground hover:text-foreground"
          >
            {professor.university.shortName}
          </Link>
        </div>

        <h1 className="text-3xl font-bold tracking-tight">
          {professor.nameBn ?? obfuscateName(professor.nameEn)}
        </h1>
        {professor.nameBn ? (
          <p className="mt-1 text-sm text-muted-foreground">{obfuscateName(professor.nameEn)}</p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="secondary">{professor.university.shortName}</Badge>
          <Badge variant="outline">
            {professor.department.shortName ?? professor.department.nameEn}
          </Badge>
          {professor.designation ? (
            <Badge variant="outline">{strings.professor.designation[professor.designation]}</Badge>
          ) : null}
          <Badge variant="outline">{strings.professor.status[professor.status]}</Badge>
        </div>

        <div className="mt-6">
          <Button render={<Link href={`/review/new?professor=${professor.slug}`} />}>
            {strings.professor.writeReview}
          </Button>
        </div>
      </div>

      {/* ── Combined score (SRS §4.6 FR-STAT-02 — Level 1) ───────────────── */}
      {combined.totalReviews > 0 ? (
        <Card className="mb-8">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <CardTitle className="text-base">{strings.professor.overallScore}</CardTitle>
              <span className="text-xs text-muted-foreground">
                {strings.professor.reviewCount(combined.totalReviews)} ·{' '}
                {combined.coursesWithReviews.toLocaleString(numberLocale)} {coursesSuffix}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold tabular-nums">
                {combined.overallScore?.toFixed(1) ?? '—'}
              </span>
              <span className="text-sm text-muted-foreground">{outOfFive}</span>
              {combined.wouldRecommendPct !== null ? (
                <Badge variant="secondary" className="ml-auto">
                  {strings.professor.wouldRecommendPercent(Math.round(combined.wouldRecommendPct))}
                </Badge>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label={strings.ratings.teachingQuality} value={combined.avgTeachingQuality} />
              <Stat label={strings.ratings.gradingFairness} value={combined.avgGradingFairness} />
              <Stat label={strings.ratings.courseDifficulty} value={combined.avgCourseDifficulty} />
              <Stat label={strings.ratings.attendance} value={combined.avgAttendance} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Courses + preview reviews (SRS §4.6 FR-STAT-02 — Level 2) ────── */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">{coursesHeading}</h2>

        {professor.professorCourses.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {strings.professor.noCoursesYet}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {professor.professorCourses.map((pc) => {
              const courseSlug = pc.course.slug ?? null
              const courseHref = courseSlug ? `/professors/${professor.slug}/${courseSlug}` : null
              const hasReviews = pc.reviewCount > 0

              return (
                <div key={pc.id} className="space-y-3">
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <CardTitle className="text-base">
                          {pc.course.courseCode ? `${pc.course.courseCode} — ` : ''}
                          {pc.course.courseName}
                        </CardTitle>
                        <span className="text-xs text-muted-foreground">
                          {strings.professor.reviewCount(pc.reviewCount)}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <Stat label={strings.ratings.teachingQuality} value={pc.avgTeachingQuality} />
                      <Stat label={strings.ratings.gradingFairness} value={pc.avgGradingFairness} />
                      <Stat
                        label={strings.ratings.courseDifficulty}
                        value={pc.avgCourseDifficulty}
                      />
                      <Stat label={strings.ratings.attendance} value={pc.avgAttendance} />
                    </CardContent>
                  </Card>

                  {hasReviews && pc.reviews.length > 0 ? (
                    <div className="ml-2 space-y-2 border-l-2 border-border pl-4">
                      {pc.reviews.map((r) => (
                        <ReviewCard
                          key={r.id}
                          review={{
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
                          }}
                          userVoted={votedIds.has(r.id)}
                        />
                      ))}

                      {pc.reviewCount > REVIEWS_PER_COURSE_PREVIEW && courseHref ? (
                        <Link
                          href={courseHref}
                          className="block rounded-md border border-border bg-card px-3 py-2 text-center text-xs font-medium text-primary transition-colors hover:bg-muted"
                        >
                          {seeAll(pc.reviewCount)}
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

function Stat({
  label,
  value,
}: {
  label: string
  value: number | { toString: () => string } | null
}) {
  const num = typeof value === 'number' ? value : value ? Number(value.toString()) : null
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">
        {num !== null ? num.toFixed(1) : '—'}
      </div>
    </div>
  )
}
