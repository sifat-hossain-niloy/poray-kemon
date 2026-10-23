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
import { LocaleLink as Link } from '@/components/i18n/LocaleLink'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ReviewCard } from '@/components/review/ReviewCard'
import { obfuscateName } from '@/lib/name-obfuscation'
import { isProfessorPublicId } from '@/lib/public-id'
import { getLocale, getStrings } from '@/lib/i18n'
import {
  filterParams,
  filterWhere,
  hasActiveFilters,
  parseCourseReviewFilters,
  NO_FILTERS,
  type CourseReviewFilters,
} from '@/lib/course-review-filters'
import { loadCourseAlternatives } from '@/lib/course-alternatives'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 10

type SortKey = 'helpful' | 'recent'

interface PageProps {
  params: Promise<{ publicId: string; 'course-slug': string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
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
    title: `${prof.nameBn ?? obfuscateName(prof.nameEn)} · সব রিভিউ`,
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
  const fx =
    locale === 'en'
      ? {
          filter: 'Show',
          wouldTake: 'Would take again',
          wouldNotTake: "Wouldn't take again",
          withText: 'Written reviews',
          clear: 'Clear filters',
          noMatches: 'No reviews match these filters.',
          alsoTaughtBy: 'Also teaching this course',
          noReviews: 'No reviews yet',
        }
      : {
          filter: 'দেখান',
          wouldTake: 'আবার নেবেন',
          wouldNotTake: 'আবার নেবেন না',
          withText: 'লিখিত রিভিউ',
          clear: 'ফিল্টার মুছুন',
          noMatches: 'এই ফিল্টারের সাথে মেলে এমন কোনো রিভিউ নেই।',
          alsoTaughtBy: 'এই কোর্সটি আরও যারা পড়ান',
          noReviews: 'এখনো কোনো রিভিউ নেই',
        }
  const nextLabel = locale === 'en' ? 'Next →' : 'পরের →'
  const { publicId, 'course-slug': courseSlug } = await params
  const rawSearch = await searchParams
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const sort = parseSort(one(rawSearch.sort))
  const page = parsePage(one(rawSearch.page))
  const knownTags = new Set(Object.keys(strings.tags))
  const tagLabels = strings.tags as Record<string, string>
  const filters = parseCourseReviewFilters(rawSearch, knownTags)

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
  const baseWhere = { professorCourseId: professorCourse.id, status: 'visible' as const }
  const where = { ...baseWhere, ...filterWhere(filters) }
  const orderBy =
    sort === 'recent'
      ? [{ submittedAt: 'desc' as const }]
      : [{ helpfulCount: 'desc' as const }, { submittedAt: 'desc' as const }]

  const [reviews, totalReviews, allReviews, courseTags, alternatives] = await Promise.all([
    db.review.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.review.count({ where }),
    // The header always reports the unfiltered total.
    hasActiveFilters(filters) ? db.review.count({ where: baseWhere }) : null,
    // Offer only tags that actually occur on this course's counted reviews.
    db.$queryRaw<Array<{ tag: string; count: number }>>`
      SELECT t.tag, COUNT(*)::int AS count
      FROM reviews r, unnest(r.tags) AS t(tag)
      WHERE r.professor_course_id = ${professorCourse.id}
        AND r.status = 'visible'
        AND r.moderation_status IN ('live', 'soft_flagged')
      GROUP BY t.tag
      ORDER BY count DESC, t.tag
    `,
    loadCourseAlternatives(professorCourse.courseId, professor.id),
  ])
  const tagOptions = courseTags.filter((t) => knownTags.has(t.tag))

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
  function pageHref(p: number, s: SortKey = sort, f: CourseReviewFilters = filters) {
    const sp = new URLSearchParams()
    if (s !== 'helpful') sp.set('sort', s)
    for (const [k, v] of filterParams(f)) sp.set(k, v)
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
          {professorCourse.course.courseCode ? `${professorCourse.course.courseCode} · ` : ''}
          {professorCourse.course.courseName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {strings.professor.reviewCount(allReviews ?? totalReviews)} ·{' '}
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

      {/* ── Who else teaches this course ──────────────────────────────────── */}
      {alternatives.length > 0 ? (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{fx.alsoTaughtBy}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {alternatives.map((alt) => (
                <li key={alt.publicId}>
                  <Link
                    href={
                      alt.reviewCount > 0
                        ? `/professors/${alt.publicId}/${courseSlug}`
                        : `/professors/${alt.publicId}`
                    }
                    className="flex items-center justify-between gap-3 py-2 text-sm hover:text-primary"
                  >
                    <span className="min-w-0 truncate font-medium">{alt.displayName}</span>
                    <span className="flex shrink-0 items-baseline gap-2 tabular-nums text-xs text-muted-foreground">
                      {alt.overallScore !== null ? (
                        <span className="text-sm font-semibold text-foreground">
                          {alt.overallScore.toFixed(1)}
                        </span>
                      ) : null}
                      <span>
                        {alt.reviewCount > 0
                          ? strings.professor.reviewCount(alt.reviewCount)
                          : fx.noReviews}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

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

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-muted-foreground">{fx.filter}</span>
        <SortLink
          href={pageHref(1, sort, {
            ...filters,
            recommend: filters.recommend === 'yes' ? null : 'yes',
          })}
          active={filters.recommend === 'yes'}
        >
          {fx.wouldTake}
        </SortLink>
        <SortLink
          href={pageHref(1, sort, {
            ...filters,
            recommend: filters.recommend === 'no' ? null : 'no',
          })}
          active={filters.recommend === 'no'}
        >
          {fx.wouldNotTake}
        </SortLink>
        <SortLink
          href={pageHref(1, sort, { ...filters, withText: !filters.withText })}
          active={filters.withText}
        >
          {fx.withText}
        </SortLink>
        {tagOptions.map(({ tag }) => (
          <SortLink
            key={tag}
            href={pageHref(1, sort, { ...filters, tag: filters.tag === tag ? null : tag })}
            active={filters.tag === tag}
          >
            {tagLabels[tag] ?? tag}
          </SortLink>
        ))}
        {hasActiveFilters(filters) ? (
          <Link
            href={pageHref(1, sort, NO_FILTERS)}
            className="ml-1 text-xs text-primary hover:underline"
          >
            {fx.clear}
          </Link>
        ) : null}
      </div>

      {/* ── Reviews list ─────────────────────────────────────────────────── */}
      {reviews.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            {hasActiveFilters(filters) ? fx.noMatches : strings.reviewDisplay.noReviews}
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
                professorPublicId={publicId}
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
        {num !== null ? num.toFixed(1) : '-'}
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
