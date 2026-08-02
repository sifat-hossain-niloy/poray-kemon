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

export const revalidate = 300

interface PageProps {
  params: Promise<{ slug: string; deptSlug: string }>
}

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

export default async function DepartmentProfessorsPage({ params }: PageProps) {
  const [strings, locale, { slug, deptSlug }] = await Promise.all([
    getStrings(),
    getLocale(),
    params,
  ])
  const numberLocale = locale === 'en' ? 'en-US' : 'bn-BD'

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
    {
      name: deptLabel,
      path: `/universities/${dept.university.slug}/departments/${dept.slug ?? deptSlug}`,
    },
  ])
  const backLabel = locale === 'en' ? '← Departments' : '← বিভাগসমূহ'
  const headingProfessors = locale === 'en' ? 'Professors' : 'শিক্ষকবৃন্দ'
  const emptyLabel =
    locale === 'en'
      ? 'No professors listed yet. Be the first to add one via a review.'
      : 'এখনো কোনো শিক্ষক যোগ করা হয়নি। রিভিউ দিয়ে যুক্ত করুন।'
  const outOfFive = locale === 'en' ? '/ 5' : '/ ৫'
  const noReviewsYet = locale === 'en' ? 'No reviews yet' : 'এখনো কোনো রিভিউ নেই'
  const reviewCountFmt = (n: number) =>
    locale === 'en'
      ? `${n.toLocaleString(numberLocale)} ${n === 1 ? 'review' : 'reviews'}`
      : `${n.toLocaleString(numberLocale)} টি রিভিউ`

  const professors = dept.professors.map((p) => {
    const combined = combineProfessorStats(
      p.professorCourses.map((pc) => ({
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
    return { professor: p, combined }
  })

  // Highest overall-score first; unrated professors sink to the bottom.
  professors.sort((a, b) => (b.combined.overallScore ?? -1) - (a.combined.overallScore ?? -1))

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
      <div className="mb-8">
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
            {backLabel}
          </Link>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{deptLabel}</h1>
            <p className="mt-1 text-muted-foreground">{dept.nameBn ?? dept.nameEn}</p>
          </div>
          <Badge variant="secondary">
            {professors.length.toLocaleString(numberLocale)} {headingProfessors.toLowerCase()}
          </Badge>
        </div>
      </div>

      {/* Professor cards */}
      {professors.length === 0 ? (
        <p className="text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {professors.map(({ professor, combined }) => {
            const displayName = professor.nameBn ?? obfuscateName(professor.nameEn)
            const overall = combined.overallScore
            return (
              <Link
                key={professor.id}
                href={`/professors/${professor.publicId}`}
                className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
              >
                <Card className="h-full transition-colors group-hover:border-primary/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">{displayName}</CardTitle>
                      {overall !== null ? (
                        <div className="flex items-baseline gap-1 shrink-0">
                          <span className="text-lg font-semibold tabular-nums">
                            {overall.toFixed(1)}
                          </span>
                          <span className="text-xs text-muted-foreground">{outOfFive}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {noReviewsYet}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 text-sm text-muted-foreground flex items-center justify-between gap-2">
                    <span>
                      {professor.designation
                        ? strings.professor.designation[
                            professor.designation as keyof typeof strings.professor.designation
                          ]
                        : ''}
                    </span>
                    <span className="tabular-nums">{reviewCountFmt(combined.totalReviews)}</span>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
