// ─────────────────────────────────────────────────────────────────────────────
// /professors/[slug]/[course-slug]
//
// Full reviews list for ONE professor teaching ONE course.
// - Default sort: helpful (FR-VOTE-04). Secondary: most recent.
// - Pagination: PAGE_SIZE per page via ?page=2.
// - Per-viewer vote state computed in a single batched query.
// ─────────────────────────────────────────────────────────────────────────────

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ReviewCard } from '@/components/review/ReviewCard'
import { STRINGS } from '@/lib/strings'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 10

type SortKey = 'helpful' | 'recent'

interface PageProps {
  params: Promise<{ slug: string; 'course-slug': string }>
  searchParams: Promise<{ sort?: string; page?: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const prof = await db.professor.findUnique({
    where: { slug },
    select: { nameEn: true, nameBn: true },
  })
  if (!prof) return { title: 'Not found' }
  return {
    title: `${prof.nameBn ?? prof.nameEn} — সব রিভিউ`,
    robots: { index: true },
  }
}

function parseSort(raw: string | undefined): SortKey {
  return raw === 'recent' ? 'recent' : 'helpful'
}

function parsePage(raw: string | undefined): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(Math.floor(n), 1000)
}

export default async function ProfessorCoursePage({ params, searchParams }: PageProps) {
  const { slug, 'course-slug': courseSlug } = await params
  const { sort: sortRaw, page: pageRaw } = await searchParams
  const sort = parseSort(sortRaw)
  const page = parsePage(pageRaw)

  const session = await auth()
  const viewerId = session?.user?.id ?? null

  // ── Resolve the professor + their course-slug match ──────────────────────
  const professor = await db.professor.findUnique({
    where: { slug },
    include: { university: true, department: true },
  })
  if (!professor) notFound()

  // Find professor_courses row by matching course.slug within the professor's
  // department. Course slugs are unique-per-department in our seed/find-or-
  // create flow (lib/slug.courseSlug), so this is unambiguous.
  const professorCourse = await db.professorCourse.findFirst({
    where: {
      professorId: professor.id,
      course: { slug: courseSlug, departmentId: professor.departmentId },
    },
    include: { course: true },
  })
  if (!professorCourse) notFound()

  // ── Reviews — paged + sorted ─────────────────────────────────────────────
  const where = { professorCourseId: professorCourse.id, status: 'visible' as const }
  const orderBy =
    sort === 'recent'
      ? [{ submittedAt: 'desc' as const }]
      : [{ helpfulCount: 'desc' as const }, { submittedAt: 'desc' as const }]

  const [reviews, totalReviews] = await Promise.all([
    db.review.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.review.count({ where }),
  ])

  // Batched per-viewer vote lookup
  const votedIds = new Set<number>()
  if (viewerId && reviews.length > 0) {
    const votes = await db.helpfulVote.findMany({
      where: { userId: viewerId, reviewId: { in: reviews.map((r) => r.id) } },
      select: { reviewId: true },
    })
    votes.forEach((v) => votedIds.add(v.reviewId))
  }

  const totalPages = Math.max(1, Math.ceil(totalReviews / PAGE_SIZE))
  // Capture into local consts so TypeScript can narrow through the closure
  const professorSlug = professor.slug
  const profHref = `/professors/${professorSlug}`
  function pageHref(p: number, s: SortKey = sort) {
    const sp = new URLSearchParams()
    if (s !== 'helpful') sp.set('sort', s)
    if (p > 1) sp.set('page', String(p))
    const qs = sp.toString()
    return `/professors/${professorSlug}/${courseSlug}${qs ? `?${qs}` : ''}`
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      {/* ── Breadcrumb + title ──────────────────────────────────────────── */}
      <div className="mb-6 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
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
          <span className="text-muted-foreground">›</span>
          <Link href={profHref} className="text-muted-foreground hover:text-foreground">
            {professor.nameBn ?? professor.nameEn}
          </Link>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {professorCourse.course.courseCode ? `${professorCourse.course.courseCode} — ` : ''}
          {professorCourse.course.courseName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {STRINGS.professor.reviewCount(totalReviews)} · {professor.nameBn ?? professor.nameEn}
        </p>
      </div>

      {/* ── Per-course aggregate ────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <CardTitle className="text-base">{STRINGS.professor.overallScore}</CardTitle>
            {professorCourse.wouldRecommendPct !== null ? (
              <Badge variant="secondary">
                {STRINGS.professor.wouldRecommendPercent(
                  Math.round(Number(professorCourse.wouldRecommendPct.toString())),
                )}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat
            label={STRINGS.ratings.teachingQuality}
            value={professorCourse.avgTeachingQuality}
          />
          <Stat
            label={STRINGS.ratings.gradingFairness}
            value={professorCourse.avgGradingFairness}
          />
          <Stat
            label={STRINGS.ratings.courseDifficulty}
            value={professorCourse.avgCourseDifficulty}
          />
          <Stat label={STRINGS.ratings.attendance} value={professorCourse.avgAttendance} />
        </CardContent>
      </Card>

      {/* ── Sort tabs ────────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-2">
        <SortLink href={pageHref(1, 'helpful')} active={sort === 'helpful'}>
          {STRINGS.reviewDisplay.sortByHelpful}
        </SortLink>
        <SortLink href={pageHref(1, 'recent')} active={sort === 'recent'}>
          {STRINGS.reviewDisplay.sortByRecent}
        </SortLink>
        <div className="ml-auto">
          <Button
            render={<Link href={`/review/new?professor=${professor.slug}`} />}
            variant="outline"
            size="sm"
          >
            {STRINGS.professor.writeReview}
          </Button>
        </div>
      </div>

      {/* ── Reviews list ─────────────────────────────────────────────────── */}
      {reviews.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {STRINGS.reviewDisplay.noReviews}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li key={r.id}>
              <ReviewCard
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
            </li>
          ))}
        </ul>
      )}

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {totalPages > 1 ? (
        <nav className="mt-6 flex items-center justify-center gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={pageHref(page - 1)}
              className="rounded-md border border-border bg-card px-3 py-1.5 transition-colors hover:bg-muted"
            >
              ← আগের
            </Link>
          ) : (
            <span className="rounded-md border border-border bg-muted/40 px-3 py-1.5 text-muted-foreground/50">
              ← আগের
            </span>
          )}
          <span className="px-2 text-muted-foreground tabular-nums">
            {page.toLocaleString('bn-BD')} / {totalPages.toLocaleString('bn-BD')}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              className="rounded-md border border-border bg-card px-3 py-1.5 transition-colors hover:bg-muted"
            >
              পরের →
            </Link>
          ) : (
            <span className="rounded-md border border-border bg-muted/40 px-3 py-1.5 text-muted-foreground/50">
              পরের →
            </span>
          )}
        </nav>
      ) : null}
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

function SortLink({
  href,
  active,
  children,
}: {
  href: string
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={
        'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
        (active
          ? 'bg-primary text-primary-foreground'
          : 'border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground')
      }
    >
      {children}
    </Link>
  )
}
