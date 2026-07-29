// ─────────────────────────────────────────────────────────────────────────────
// /professors/[publicId]/[course-slug]
//
// Full reviews list for ONE professor teaching ONE course.
// - Default sort: helpful (FR-VOTE-04). Secondary: most recent.
// - Pagination: PAGE_SIZE per page via ?page=2.
// - Per-viewer vote state computed in a single batched query.
// - Legacy name-slug URLs 301-redirect to the opaque publicId.
// ─────────────────────────────────────────────────────────────────────────────

import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ReviewCard } from '@/components/review/ReviewCard'
import { obfuscateName } from '@/lib/name-obfuscation'
import { isProfessorPublicId } from '@/lib/public-id'
import { getLocale, getStrings } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 10

type SortKey = 'helpful' | 'recent'

interface PageProps {
  params: Promise<{ publicId: string; 'course-slug': string }>
  searchParams: Promise<{ sort?: string; page?: string }>
}

async function resolveProfessor(param: string) {
  if (isProfessorPublicId(param)) {
    return db.professor.findUnique({ where: { publicId: param } })
  }
  return db.professor.findUnique({ where: { slug: param } })
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { publicId } = await params
  const prof = await resolveProfessor(publicId)
  if (!prof) return { title: 'Not found' }
  return {
    title: `${prof.nameBn ?? obfuscateName(prof.nameEn)} — সব রিভিউ`,
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
  const [strings, locale] = await Promise.all([getStrings(), getLocale()])
  const breadcrumbUni = locale === 'en' ? 'Universities' : 'বিশ্ববিদ্যালয়'
  const prevLabel = locale === 'en' ? '← Previous' : '← আগের'
  const nextLabel = locale === 'en' ? 'Next →' : 'পরের →'
  const { publicId, 'course-slug': courseSlug } = await params
  const { sort: sortRaw, page: pageRaw } = await searchParams
  const sort = parseSort(sortRaw)
  const page = parsePage(pageRaw)

  const session = await auth()
  const viewerId = session?.user?.id ?? null

  // Legacy /professors/<name-slug>/<course-slug> URLs 301-redirect to the
  // opaque form so existing indexed links keep working.
  if (!isProfessorPublicId(publicId)) {
    const legacy = await db.professor.findUnique({
      where: { slug: publicId },
      select: { publicId: true },
    })
    if (!legacy) notFound()
    redirect(`/professors/${legacy.publicId}/${courseSlug}`)
  }

  // ── Resolve the professor + their course-slug match ──────────────────────
  const professor = await db.professor.findUnique({
    where: { publicId },
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
  const professorPublicId = professor.publicId
  const profHref = `/professors/${professorPublicId}`
  function pageHref(p: number, s: SortKey = sort) {
    const sp = new URLSearchParams()
    if (s !== 'helpful') sp.set('sort', s)
    if (p > 1) sp.set('page', String(p))
    const qs = sp.toString()
    return `/professors/${professorPublicId}/${courseSlug}${qs ? `?${qs}` : ''}`
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      {/* ── Breadcrumb + title ──────────────────────────────────────────── */}
      <div className="mb-6 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link href="/universities" className="text-muted-foreground hover:text-foreground">
            {breadcrumbUni}
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
            {professor.nameBn ?? obfuscateName(professor.nameEn)}
          </Link>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">
          {professorCourse.course.courseCode ? `${professorCourse.course.courseCode} — ` : ''}
          {professorCourse.course.courseName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {strings.professor.reviewCount(totalReviews)} ·{' '}
          {professor.nameBn ?? obfuscateName(professor.nameEn)}
        </p>
      </div>

      {/* ── Per-course aggregate ────────────────────────────────────────── */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <CardTitle className="text-base">{strings.professor.overallScore}</CardTitle>
            {professorCourse.wouldRecommendPct !== null ? (
              <Badge variant="secondary">
                {strings.professor.wouldRecommendPercent(
                  Math.round(Number(professorCourse.wouldRecommendPct.toString())),
                )}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Stat
            label={strings.ratings.teachingQuality}
            value={professorCourse.avgTeachingQuality}
          />
          <Stat
            label={strings.ratings.gradingFairness}
            value={professorCourse.avgGradingFairness}
          />
          <Stat
            label={strings.ratings.courseDifficulty}
            value={professorCourse.avgCourseDifficulty}
          />
          <Stat label={strings.ratings.attendance} value={professorCourse.avgAttendance} />
        </CardContent>
      </Card>

      {/* ── Sort tabs ────────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center gap-2">
        <SortLink href={pageHref(1, 'helpful')} active={sort === 'helpful'}>
          {strings.reviewDisplay.sortByHelpful}
        </SortLink>
        <SortLink href={pageHref(1, 'recent')} active={sort === 'recent'}>
          {strings.reviewDisplay.sortByRecent}
        </SortLink>
        <div className="ml-auto">
          <Button
            render={<Link href={`/review/new?professor=${professor.publicId}`} />}
            variant="outline"
            size="sm"
          >
            {strings.professor.writeReview}
          </Button>
        </div>
      </div>

      {/* ── Reviews list ─────────────────────────────────────────────────── */}
      {reviews.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {strings.reviewDisplay.noReviews}
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
              {prevLabel}
            </Link>
          ) : (
            <span className="rounded-md border border-border bg-muted/40 px-3 py-1.5 text-muted-foreground/50">
              {prevLabel}
            </span>
          )}
          <span className="px-2 text-muted-foreground tabular-nums">
            {page.toLocaleString(locale === 'en' ? 'en-US' : 'bn-BD')} /{' '}
            {totalPages.toLocaleString(locale === 'en' ? 'en-US' : 'bn-BD')}
          </span>
          {page < totalPages ? (
            <Link
              href={pageHref(page + 1)}
              className="rounded-md border border-border bg-card px-3 py-1.5 transition-colors hover:bg-muted"
            >
              {nextLabel}
            </Link>
          ) : (
            <span className="rounded-md border border-border bg-muted/40 px-3 py-1.5 text-muted-foreground/50">
              {nextLabel}
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
