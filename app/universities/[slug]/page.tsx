import { LocaleLink as Link } from '@/components/i18n/LocaleLink'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { getLocale } from '@/lib/i18n'
import { obfuscateName } from '@/lib/name-obfuscation'
import { rollupDepartments, rollupUniversity, topProfessors } from '@/lib/university-stats'
import { localeAlternates } from '@/lib/i18n/alternates'
import { breadcrumbJsonLd } from '@/lib/seo/breadcrumbs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export const revalidate = 300

const TOP_PROFESSORS_LIMIT = 5

interface PageProps {
  params: Promise<{ slug: string }>
}

// Title/description tuned for long-tail search: "<uni-shortname> professor
// reviews", "<full name> anonymous course reviews", etc. Numbers in the
// description ("42 professors, 12 departments") give Google a signal that
// the page has real, quantifiable content behind it.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const uni = await db.university.findUnique({
    where: { slug },
    select: {
      nameEn: true,
      nameBn: true,
      shortName: true,
      slug: true,
      _count: { select: { departments: true, professors: true } },
    },
  })
  if (!uni) return { title: 'Not found' }
  const locale = await getLocale()
  const alt = localeAlternates(`/universities/${uni.slug}`, locale)
  const title = `${uni.shortName} (${uni.nameEn}) — professor reviews`
  const description =
    `Anonymous student reviews of professors and courses at ${uni.nameEn} (${uni.shortName}). ` +
    `${uni._count.professors} professors across ${uni._count.departments} departments.`
  return {
    title,
    description,
    alternates: { canonical: alt.canonical, languages: alt.languages },
    openGraph: { title, description, url: alt.canonical, type: 'website' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function UniversityPage({ params }: PageProps) {
  const { slug } = await params
  const locale = await getLocale()
  const en = locale === 'en'
  const numberLocale = en ? 'en-US' : 'bn-BD'
  const uni = await db.university.findUnique({
    where: { slug },
    include: {
      departments: {
        orderBy: { shortName: 'asc' },
        include: {
          _count: { select: { professors: true } },
        },
      },
      _count: { select: { professors: true } },
    },
  })

  if (!uni) notFound()

  // One query feeds every rollup on the page: department cards, the header
  // strip and the top-professors list are all derived from these rows.
  const courseRows = await db.professorCourse.findMany({
    where: { professor: { universityId: uni.id }, reviewCount: { gt: 0 } },
    select: {
      reviewCount: true,
      avgTeachingQuality: true,
      avgGradingFairness: true,
      avgCourseDifficulty: true,
      avgAttendance: true,
      wouldRecommendPct: true,
      overallScore: true,
      professor: { select: { id: true, departmentId: true } },
    },
  })
  const num = (v: { toString: () => string } | null) => (v === null ? null : Number(v.toString()))
  const rows = courseRows.map((pc) => ({
    professorId: pc.professor.id,
    departmentId: pc.professor.departmentId,
    reviewCount: pc.reviewCount,
    avgTeachingQuality: num(pc.avgTeachingQuality),
    avgGradingFairness: num(pc.avgGradingFairness),
    avgCourseDifficulty: num(pc.avgCourseDifficulty),
    avgAttendance: num(pc.avgAttendance),
    wouldRecommendPct: num(pc.wouldRecommendPct),
    overallScore: num(pc.overallScore),
  }))
  const deptStats = rollupDepartments(rows)
  const summary = rollupUniversity(rows)
  const top = topProfessors(rows, TOP_PROFESSORS_LIMIT)
  const topDetails = top.length
    ? await db.professor.findMany({
        where: { id: { in: top.map((t) => t.professorId) } },
        select: {
          id: true,
          publicId: true,
          nameEn: true,
          nameBn: true,
          department: { select: { shortName: true, nameEn: true } },
        },
      })
    : []
  const topById = new Map(topDetails.map((p) => [p.id, p]))

  // Departments with reviews float up; the rest keep alphabetical order.
  const departments = [...uni.departments].sort(
    (a, b) => (deptStats.get(b.id)?.totalReviews ?? 0) - (deptStats.get(a.id)?.totalReviews ?? 0),
  )

  const t = {
    back: en ? '← Universities' : '← বিশ্ববিদ্যালয়',
    type: {
      public: en ? 'Public' : 'সরকারি',
      private: en ? 'Private' : 'বেসরকারি',
      international: en ? 'International' : 'আন্তর্জাতিক',
    },
    departments: en ? 'Departments' : 'বিভাগসমূহ',
    noDepartments: en ? 'No departments added yet.' : 'এখনো কোনো বিভাগ যোগ করা হয়নি।',
    professors: (n: number) =>
      en
        ? `${n.toLocaleString(numberLocale)} ${n === 1 ? 'professor' : 'professors'}`
        : `${n.toLocaleString(numberLocale)} শিক্ষক`,
    reviews: (n: number) =>
      en
        ? `${n.toLocaleString(numberLocale)} ${n === 1 ? 'review' : 'reviews'}`
        : `${n.toLocaleString(numberLocale)} টি রিভিউ`,
    noReviews: en ? 'No reviews yet' : 'এখনো কোনো রিভিউ নেই',
    outOfFive: en ? '/ 5' : '/ ৫',
    statReviews: en ? 'Reviews' : 'রিভিউ',
    statRated: en ? 'Professors rated' : 'রেটিং পাওয়া শিক্ষক',
    statScore: en ? 'Average score' : 'গড় স্কোর',
    statRecommend: en ? 'Would recommend' : 'সুপারিশ করবেন',
    topHeading: en ? `Top professors at ${uni.shortName}` : `${uni.shortName}-এর সেরা শিক্ষক`,
    topSub: en
      ? 'Highest overall scores with at least 3 reviews'
      : 'কমপক্ষে ৩টি রিভিউ নিয়ে সর্বোচ্চ ওভারঅল স্কোর',
    writeReview: en ? 'Write a review' : 'রিভিউ লিখুন',
  }

  // JSON-LD for search-engine rich results. Marks the page as an educational
  // organization with a nested list of departments, which Google can surface
  // as a knowledge-panel snippet on branded queries.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollegeOrUniversity',
    name: uni.nameEn,
    alternateName: uni.shortName,
    ...(uni.nameBn ? { additionalName: uni.nameBn } : {}),
    ...(uni.locationCity
      ? {
          address: {
            '@type': 'PostalAddress',
            addressLocality: uni.locationCity,
            addressCountry: 'BD',
          },
        }
      : {}),
    department: uni.departments.map((d) => ({
      '@type': 'CollegeDepartment',
      name: d.nameEn,
      ...(d.shortName ? { alternateName: d.shortName } : {}),
    })),
  }

  const breadcrumb = breadcrumbJsonLd(locale, [
    { name: 'Home', path: '/' },
    { name: 'Universities', path: '/universities' },
    { name: uni.shortName, path: `/universities/${uni.slug}` },
  ])

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-sm">
          <Link href="/universities" className="text-muted-foreground hover:text-foreground">
            {t.back}
          </Link>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight">{uni.shortName}</h1>
            <p className="mt-1 text-muted-foreground">
              {en ? uni.nameEn : (uni.nameBn ?? uni.nameEn)}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {uni.locationCity ? <Badge variant="outline">{uni.locationCity}</Badge> : null}
            <Badge variant="secondary">{t.type[uni.type]}</Badge>
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <HeaderStat
            label={t.statReviews}
            value={summary.totalReviews.toLocaleString(numberLocale)}
          />
          <HeaderStat
            label={t.statRated}
            value={`${summary.ratedProfessors.toLocaleString(numberLocale)} / ${uni._count.professors.toLocaleString(numberLocale)}`}
          />
          <HeaderStat
            label={t.statScore}
            value={summary.overallScore !== null ? summary.overallScore.toFixed(1) : '-'}
          />
          <HeaderStat
            label={t.statRecommend}
            value={
              summary.wouldRecommendPct !== null
                ? `${Math.round(summary.wouldRecommendPct).toLocaleString(numberLocale)}%`
                : '-'
            }
          />
        </dl>

        <div className="mt-6">
          <Button render={<Link href="/review/new" />}>{t.writeReview}</Button>
        </div>
      </div>

      {/* Top professors (FR-STAT-04) */}
      {top.length > 0 ? (
        <section aria-labelledby="pk-uni-top-heading" className="mb-10">
          <h2 id="pk-uni-top-heading" className="text-xl font-semibold">
            {t.topHeading}
          </h2>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">{t.topSub}</p>
          <ol className="space-y-2">
            {top.map((entry, idx) => {
              const prof = topById.get(entry.professorId)
              if (!prof) return null
              return (
                <li key={entry.professorId}>
                  <Link
                    href={`/professors/${prof.publicId}`}
                    className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Card className="transition-colors group-hover:border-primary/50">
                      <CardContent className="flex items-center gap-3 py-3 sm:gap-4">
                        <span className="w-6 shrink-0 text-center text-lg font-bold tabular-nums text-muted-foreground">
                          {(idx + 1).toLocaleString(numberLocale)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {prof.nameBn ?? obfuscateName(prof.nameEn)}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {prof.department.shortName ?? prof.department.nameEn} ·{' '}
                            {t.reviews(entry.totalReviews)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-baseline gap-1">
                          <span className="text-xl font-bold tabular-nums">
                            {entry.overallScore.toFixed(1)}
                          </span>
                          <span className="text-xs text-muted-foreground">{t.outOfFive}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              )
            })}
          </ol>
        </section>
      ) : null}

      {/* Departments (FR-SEARCH-04) */}
      <section>
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-xl font-semibold">{t.departments}</h2>
          <Badge variant="secondary">{uni.departments.length.toLocaleString(numberLocale)}</Badge>
        </div>

        {departments.length === 0 ? (
          <p className="text-muted-foreground">{t.noDepartments}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {departments.map((dept) => {
              const stats = deptStats.get(dept.id)
              return (
                <Link
                  key={dept.id}
                  href={`/universities/${uni.slug}/departments/${dept.slug}`}
                  className="group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Card className="h-full transition-colors group-hover:border-primary/50">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base">{dept.shortName ?? dept.nameEn}</CardTitle>
                        {stats?.overallScore != null ? (
                          <div className="flex shrink-0 items-baseline gap-1">
                            <span className="text-lg font-semibold tabular-nums">
                              {stats.overallScore.toFixed(1)}
                            </span>
                            <span className="text-xs text-muted-foreground">{t.outOfFive}</span>
                          </div>
                        ) : null}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <p className="line-clamp-2">
                        {en ? dept.nameEn : (dept.nameBn ?? dept.nameEn)}
                      </p>
                      <p className="flex items-center justify-between gap-2 text-xs tabular-nums">
                        <span>{t.professors(dept._count.professors)}</span>
                        <span>
                          {stats?.totalReviews ? t.reviews(stats.totalReviews) : t.noReviews}
                        </span>
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
