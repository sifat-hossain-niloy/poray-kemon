import { LocaleLink as Link } from '@/components/i18n/LocaleLink'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { combineProfessorStats } from '@/lib/professor-stats'
import { obfuscateName } from '@/lib/name-obfuscation'
import { getLocale, getStrings } from '@/lib/i18n'
import { localeAlternates } from '@/lib/i18n/alternates'
import { breadcrumbJsonLd } from '@/lib/seo/breadcrumbs'
import {
  applyListing,
  difficultyBucket,
  listingQuery,
  parseListingParams,
  type DepartmentListingParams,
} from '@/lib/department-listing'

export const revalidate = 300

interface PageProps {
  params: Promise<{ slug: string; deptSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const num = (v: { toString: () => string } | null) => (v === null ? null : Number(v.toString()))

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug, deptSlug } = await params
  const dept = await db.department.findFirst({
    where: { slug: deptSlug, university: { slug } },
    select: {
      nameEn: true,
      nameBn: true,
      shortName: true,
      slug: true,
      university: { select: { shortName: true, nameEn: true, slug: true } },
      _count: { select: { professors: true } },
    },
  })
  if (!dept) return { title: 'Not found' }
  const deptLabel = dept.shortName ?? dept.nameEn
  const locale = await getLocale()
  const alt = localeAlternates(
    `/universities/${dept.university.slug}/departments/${dept.slug ?? deptSlug}`,
    locale,
  )
  const title = `${deptLabel}, ${dept.university.shortName} — professor reviews from students`
  const description =
    `Anonymous student reviews of ${dept.nameEn} professors at ${dept.university.nameEn} ` +
    `(${dept.university.shortName}). ${dept._count.professors} professors listed.`
  return {
    title,
    description,
    alternates: { canonical: alt.canonical, languages: alt.languages },
    openGraph: { title, description, url: alt.canonical, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function DepartmentProfessorsPage({ params, searchParams }: PageProps) {
  const [strings, locale, { slug, deptSlug }, rawSearch] = await Promise.all([
    getStrings(),
    getLocale(),
    params,
    searchParams,
  ])
  const en = locale === 'en'
  const numberLocale = en ? 'en-US' : 'bn-BD'
  const listing = parseListingParams(rawSearch)

  const dept = await db.department.findFirst({
    where: { slug: deptSlug, university: { slug } },
    include: {
      university: {
        select: { slug: true, shortName: true, nameBn: true, nameEn: true },
      },
      professors: {
        orderBy: [{ nameEn: 'asc' }],
        include: {
          professorCourses: {
            select: {
              id: true,
              reviewCount: true,
              avgTeachingQuality: true,
              avgGradingFairness: true,
              avgCourseDifficulty: true,
              avgAttendance: true,
              wouldRecommendPct: true,
              overallScore: true,
            },
          },
        },
      },
    },
  })

  if (!dept) notFound()

  const deptLabel = dept.shortName ?? dept.nameEn
  const basePath = `/universities/${dept.university.slug}/departments/${dept.slug ?? deptSlug}`

  // JSON-LD: department nested under its university. Google can render this
  // as a knowledge-panel snippet for "<dept> at <uni>" style queries.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollegeDepartment',
    name: dept.nameEn,
    ...(dept.shortName ? { alternateName: dept.shortName } : {}),
    parentOrganization: {
      '@type': 'CollegeOrUniversity',
      name: dept.university.nameEn,
      alternateName: dept.university.shortName,
    },
  }

  const breadcrumb = breadcrumbJsonLd(locale, [
    { name: 'Home', path: '/' },
    { name: 'Universities', path: '/universities' },
    { name: dept.university.shortName, path: `/universities/${dept.university.slug}` },
    { name: deptLabel, path: basePath },
  ])
  const t = {
    back: en ? '← Departments' : '← বিভাগসমূহ',
    professors: en ? 'Professors' : 'শিক্ষকবৃন্দ',
    courses: en ? 'Courses' : 'কোর্সসমূহ',
    empty: en
      ? 'No professors listed yet. Be the first to add one via a review.'
      : 'এখনো কোনো শিক্ষক যোগ করা হয়নি। রিভিউ দিয়ে যুক্ত করুন।',
    emptyFiltered: en
      ? 'No professors match these filters.'
      : 'এই ফিল্টারের সাথে মেলে এমন কোনো শিক্ষক নেই।',
    emptyCourses: en
      ? 'No courses recorded yet. Courses appear once someone reviews them.'
      : 'এখনো কোনো কোর্স যোগ হয়নি। রিভিউ দিলে কোর্স যুক্ত হবে।',
    clearFilters: en ? 'Clear filters' : 'ফিল্টার মুছুন',
    outOfFive: en ? '/ 5' : '/ ৫',
    noReviewsYet: en ? 'No reviews yet' : 'এখনো কোনো রিভিউ নেই',
    reviews: (n: number) =>
      en
        ? `${n.toLocaleString(numberLocale)} ${n === 1 ? 'review' : 'reviews'}`
        : `${n.toLocaleString(numberLocale)} টি রিভিউ`,
    sortLabel: en ? 'Sort' : 'সাজান',
    sort: {
      rating: en ? 'Highest rated' : 'সর্বোচ্চ রেটিং',
      reviews: en ? 'Most reviewed' : 'সর্বাধিক রিভিউ',
      recent: en ? 'Recently reviewed' : 'সাম্প্রতিক রিভিউ',
    },
    difficultyLabel: en ? 'Difficulty' : 'কাঠিন্য',
    difficulty: {
      easy: en ? 'Easy' : 'সহজ',
      medium: en ? 'Medium' : 'মাঝারি',
      hard: en ? 'Hard' : 'কঠিন',
    },
    any: en ? 'Any' : 'যেকোনো',
    recommendedOnly: en ? 'Recommended only' : 'শুধু সুপারিশকৃত',
    taughtBy: en ? 'Taught by' : 'পড়ান',
    difficultyShort: en ? 'Difficulty' : 'কাঠিন্য',
  }

  const professors = dept.professors.map((p) => {
    const combined = combineProfessorStats(
      p.professorCourses.map((pc) => ({
        reviewCount: pc.reviewCount,
        avgTeachingQuality: num(pc.avgTeachingQuality),
        avgGradingFairness: num(pc.avgGradingFairness),
        avgCourseDifficulty: num(pc.avgCourseDifficulty),
        avgAttendance: num(pc.avgAttendance),
        wouldRecommendPct: num(pc.wouldRecommendPct),
        overallScore: num(pc.overallScore),
      })),
    )
    return { professor: p, combined }
  })

  const view =
    listing.view === 'courses' ? (
      <CourseCatalog departmentId={dept.id} t={t} numberLocale={numberLocale} />
    ) : (
      <ProfessorList
        professors={professors}
        listing={listing}
        basePath={basePath}
        t={t}
        designations={strings.professor.designation}
      />
    )

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Breadcrumb + header */}
      <div className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <Link href="/universities" className="text-muted-foreground hover:text-foreground">
            {strings.nav.universities}
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link
            href={`/universities/${dept.university.slug}`}
            className="text-muted-foreground hover:text-foreground"
          >
            {dept.university.shortName}
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link
            href={`/universities/${dept.university.slug}`}
            className="text-muted-foreground hover:text-foreground"
          >
            {t.back}
          </Link>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight">{deptLabel}</h1>
            <p className="mt-1 text-muted-foreground">
              {en ? dept.nameEn : (dept.nameBn ?? dept.nameEn)}
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {professors.length.toLocaleString(numberLocale)} {t.professors.toLowerCase()}
          </Badge>
        </div>
      </div>

      {/* View tabs */}
      <nav className="mb-4 flex gap-1 border-b border-border" aria-label={t.professors}>
        {(['professors', 'courses'] as const).map((v) => {
          const active = listing.view === v
          return (
            <Link
              key={v}
              href={`${basePath}${listingQuery({ ...listing, view: v })}`}
              aria-current={active ? 'page' : undefined}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t[v]}
            </Link>
          )
        })}
      </nav>

      {view}
    </main>
  )
}

type Copy = {
  empty: string
  emptyFiltered: string
  emptyCourses: string
  clearFilters: string
  outOfFive: string
  noReviewsYet: string
  reviews: (n: number) => string
  sortLabel: string
  sort: Record<DepartmentListingParams['sort'], string>
  difficultyLabel: string
  difficulty: Record<'easy' | 'medium' | 'hard', string>
  any: string
  recommendedOnly: string
  taughtBy: string
  difficultyShort: string
}

function Pill({ href, active, children }: { href: string; active: boolean; children: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors ${
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground hover:text-foreground'
      }`}
    >
      {children}
    </Link>
  )
}

type ProfessorRow = {
  professor: {
    id: number
    publicId: string
    nameEn: string
    nameBn: string | null
    designation: string | null
    professorCourses: { id: number }[]
  }
  combined: ReturnType<typeof combineProfessorStats>
}

async function ProfessorList({
  professors,
  listing,
  basePath,
  t,
  designations,
}: {
  professors: ProfessorRow[]
  listing: DepartmentListingParams
  basePath: string
  t: Copy
  designations: Record<string, string>
}) {
  // "Recently reviewed" needs the newest visible review per professor; one
  // grouped query over the department's professor_courses covers it.
  const pcToProfessor = new Map<number, number>()
  for (const { professor } of professors) {
    for (const pc of professor.professorCourses) pcToProfessor.set(pc.id, professor.id)
  }
  const latest = pcToProfessor.size
    ? await db.review.groupBy({
        by: ['professorCourseId'],
        where: { professorCourseId: { in: [...pcToProfessor.keys()] }, status: 'visible' },
        _max: { submittedAt: true },
      })
    : []
  const lastByProfessor = new Map<number, Date>()
  for (const row of latest) {
    const profId = pcToProfessor.get(row.professorCourseId)
    const at = row._max.submittedAt
    if (profId === undefined || !at) continue
    const prev = lastByProfessor.get(profId)
    if (!prev || at > prev) lastByProfessor.set(profId, at)
  }

  const rows = applyListing(
    professors.map((r) => ({
      ...r,
      overallScore: r.combined.overallScore,
      totalReviews: r.combined.totalReviews,
      avgCourseDifficulty: r.combined.avgCourseDifficulty,
      wouldRecommendPct: r.combined.wouldRecommendPct,
      lastReviewedAt: lastByProfessor.get(r.professor.id) ?? null,
    })),
    listing,
  )
  const href = (patch: Partial<DepartmentListingParams>) =>
    `${basePath}${listingQuery({ ...listing, ...patch })}`
  const filtersActive = listing.difficulty !== null || listing.recommendedOnly

  return (
    <>
      <div className="mb-5 space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">{t.sortLabel}</span>
          {(['rating', 'reviews', 'recent'] as const).map((s) => (
            <Pill key={s} href={href({ sort: s })} active={listing.sort === s}>
              {t.sort[s]}
            </Pill>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">{t.difficultyLabel}</span>
          <Pill href={href({ difficulty: null })} active={listing.difficulty === null}>
            {t.any}
          </Pill>
          {(['easy', 'medium', 'hard'] as const).map((d) => (
            <Pill key={d} href={href({ difficulty: d })} active={listing.difficulty === d}>
              {t.difficulty[d]}
            </Pill>
          ))}
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          <Pill
            href={href({ recommendedOnly: !listing.recommendedOnly })}
            active={listing.recommendedOnly}
          >
            {t.recommendedOnly}
          </Pill>
        </div>
      </div>

      {professors.length === 0 ? (
        <p className="text-muted-foreground">{t.empty}</p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground">
          {t.emptyFiltered}{' '}
          {filtersActive ? (
            <Link
              href={href({ difficulty: null, recommendedOnly: false })}
              className="text-primary hover:underline"
            >
              {t.clearFilters}
            </Link>
          ) : null}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ professor, combined }) => {
            const displayName = professor.nameBn ?? obfuscateName(professor.nameEn)
            const overall = combined.overallScore
            const bucket = difficultyBucket(combined.avgCourseDifficulty)
            return (
              <Link
                key={professor.id}
                href={`/professors/${professor.publicId}`}
                className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full transition-colors group-hover:border-primary/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">{displayName}</CardTitle>
                      {overall !== null ? (
                        <div className="flex shrink-0 items-baseline gap-1">
                          <span className="text-lg font-semibold tabular-nums">
                            {overall.toFixed(1)}
                          </span>
                          <span className="text-xs text-muted-foreground">{t.outOfFive}</span>
                        </div>
                      ) : (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {t.noReviewsYet}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-2 pt-0 text-sm text-muted-foreground">
                    <span className="truncate">
                      {professor.designation ? (designations[professor.designation] ?? '') : ''}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 tabular-nums">
                      {bucket ? (
                        <Badge variant="outline" className="text-[10px]">
                          {t.difficulty[bucket]}
                        </Badge>
                      ) : null}
                      {t.reviews(combined.totalReviews)}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}

async function CourseCatalog({
  departmentId,
  t,
  numberLocale,
}: {
  departmentId: number
  t: Copy
  numberLocale: string
}) {
  const courses = await db.course.findMany({
    where: { departmentId },
    select: {
      id: true,
      courseCode: true,
      courseName: true,
      slug: true,
      professorCourses: {
        orderBy: { reviewCount: 'desc' },
        select: {
          reviewCount: true,
          avgTeachingQuality: true,
          avgGradingFairness: true,
          avgCourseDifficulty: true,
          avgAttendance: true,
          wouldRecommendPct: true,
          overallScore: true,
          professor: { select: { publicId: true, nameEn: true, nameBn: true } },
        },
      },
    },
  })

  const rows = courses
    .map((c) => ({
      course: c,
      combined: combineProfessorStats(
        c.professorCourses.map((pc) => ({
          reviewCount: pc.reviewCount,
          avgTeachingQuality: num(pc.avgTeachingQuality),
          avgGradingFairness: num(pc.avgGradingFairness),
          avgCourseDifficulty: num(pc.avgCourseDifficulty),
          avgAttendance: num(pc.avgAttendance),
          wouldRecommendPct: num(pc.wouldRecommendPct),
          overallScore: num(pc.overallScore),
        })),
      ),
    }))
    .sort(
      (a, b) =>
        b.combined.totalReviews - a.combined.totalReviews ||
        (a.course.courseCode ?? a.course.courseName).localeCompare(
          b.course.courseCode ?? b.course.courseName,
        ),
    )

  if (rows.length === 0) return <p className="text-muted-foreground">{t.emptyCourses}</p>

  return (
    <div className="space-y-3">
      {rows.map(({ course, combined }) => {
        const bucket = difficultyBucket(combined.avgCourseDifficulty)
        return (
          <Card key={course.id}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <CardTitle className="text-base">
                  {course.courseCode ? `${course.courseCode} · ` : ''}
                  {course.courseName}
                </CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                  {bucket ? (
                    <Badge variant="outline" className="text-[10px]">
                      {t.difficultyShort}: {t.difficulty[bucket]}
                    </Badge>
                  ) : null}
                  {combined.overallScore !== null ? (
                    <span className="text-sm font-semibold text-foreground">
                      {combined.overallScore.toFixed(1)}{' '}
                      <span className="text-xs font-normal text-muted-foreground">
                        {t.outOfFive}
                      </span>
                    </span>
                  ) : null}
                  <span>
                    {combined.totalReviews > 0 ? t.reviews(combined.totalReviews) : t.noReviewsYet}
                  </span>
                </div>
              </div>
            </CardHeader>
            {course.professorCourses.length > 0 ? (
              <CardContent className="pt-0">
                <p className="mb-1.5 text-xs text-muted-foreground">{t.taughtBy}</p>
                <ul className="flex flex-wrap gap-1.5">
                  {course.professorCourses.map((pc) => {
                    const name = pc.professor.nameBn ?? obfuscateName(pc.professor.nameEn)
                    const score = num(pc.overallScore)
                    const target =
                      course.slug && pc.reviewCount > 0
                        ? `/professors/${pc.professor.publicId}/${course.slug}`
                        : `/professors/${pc.professor.publicId}`
                    return (
                      <li key={pc.professor.publicId}>
                        <Link
                          href={target}
                          className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs hover:border-primary/50"
                        >
                          <span>{name}</span>
                          {score !== null ? (
                            <span className="font-semibold tabular-nums">{score.toFixed(1)}</span>
                          ) : null}
                          <span className="text-muted-foreground tabular-nums">
                            ({pc.reviewCount.toLocaleString(numberLocale)})
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            ) : null}
          </Card>
        )
      })}
    </div>
  )
}
