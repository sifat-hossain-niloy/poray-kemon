import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ReviewCard } from '@/components/review/ReviewCard'
import { STRINGS } from '@/lib/strings'
import Link from 'next/link'

// Dynamic now: we need the authenticated user's per-review vote state.
// ISR + per-user state in the SAME render is impossible without a client
// fetch — the dynamic render keeps the page authoritative for both signed-in
// and signed-out viewers.
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
  return {
    title: prof.nameBn ?? prof.nameEn,
    description: `${prof.nameEn} এর শিক্ষাগত রিভিউ ও রেটিং`,
  }
}

export default async function ProfessorPage({ params }: PageProps) {
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

  // Fetch the viewer's votes across ALL visible reviews on this page in one
  // round-trip. Index lookup is cheap; this beats N+1 client requests.
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
            বিশ্ববিদ্যালয়
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
          {professor.nameBn ?? professor.nameEn}
        </h1>
        {professor.nameBn ? (
          <p className="mt-1 text-sm text-muted-foreground">{professor.nameEn}</p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="secondary">{professor.university.shortName}</Badge>
          <Badge variant="outline">
            {professor.department.shortName ?? professor.department.nameEn}
          </Badge>
          {professor.designation ? (
            <Badge variant="outline">{STRINGS.professor.designation[professor.designation]}</Badge>
          ) : null}
          <Badge variant="outline">{STRINGS.professor.status[professor.status]}</Badge>
        </div>

        <div className="mt-6">
          <Button render={<Link href={`/review/new?professor=${professor.slug}`} />}>
            {STRINGS.professor.writeReview}
          </Button>
        </div>
      </div>

      {/* ── Courses + recent reviews ─────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">কোর্সসমূহ</h2>

        {professor.professorCourses.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {STRINGS.professor.noCoursesYet}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {professor.professorCourses.map((pc) => (
              <div key={pc.id} className="space-y-3">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <CardTitle className="text-base">
                        {pc.course.courseCode ? `${pc.course.courseCode} — ` : ''}
                        {pc.course.courseName}
                      </CardTitle>
                      <span className="text-xs text-muted-foreground">
                        {STRINGS.professor.reviewCount(pc.reviewCount)}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <Stat label={STRINGS.ratings.teachingQuality} value={pc.avgTeachingQuality} />
                    <Stat label={STRINGS.ratings.gradingFairness} value={pc.avgGradingFairness} />
                    <Stat label={STRINGS.ratings.courseDifficulty} value={pc.avgCourseDifficulty} />
                    <Stat label={STRINGS.ratings.attendance} value={pc.avgAttendance} />
                  </CardContent>
                </Card>

                {pc.reviews.length > 0 ? (
                  <div className="ml-2 space-y-2 border-l-2 border-border pl-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {STRINGS.reviewDisplay.sortByHelpful}
                    </h3>
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
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: { toString: () => string } | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">
        {value ? Number(value.toString()).toFixed(1) : '—'}
      </div>
    </div>
  )
}
