import Link from 'next/link'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { getLocale, getStrings } from '@/lib/i18n'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { obfuscateName } from '@/lib/name-obfuscation'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title: locale === 'en' ? 'Professors' : 'শিক্ষকবৃন্দ',
    description:
      locale === 'en'
        ? 'Professors reviewed on Poray Kemon, ranked by activity.'
        : 'পড়ায় কেমন-এ রিভিউকৃত শিক্ষকবৃন্দ।',
  }
}

// Reads live counts / aggregates per request — can't be cached to a
// static page. Same rationale as the homepage.
export const dynamic = 'force-dynamic'

interface Row {
  id: number
  publicId: string
  nameEn: string
  reviewCount: number
  overallScore: number | null
  university: { shortName: string; slug: string }
  department: { shortName: string | null; nameEn: string; slug: string | null }
}

// Rank by activity first (more reviews = more established), then by
// overall_score for a tie-break. Professors with zero reviews sink to
// the bottom — the listing is meant to help new students find who
// has feedback available.
async function getProfessors(): Promise<Row[]> {
  const rows = await db.$queryRaw<
    Array<{
      id: number
      public_id: string
      name_en: string
      review_count: number
      overall_score: string | null
      uni_short_name: string
      uni_slug: string
      dept_short_name: string | null
      dept_name_en: string
      dept_slug: string | null
    }>
  >`
    SELECT p.id,
           p.public_id,
           p.name_en,
           COALESCE(SUM(pc.review_count), 0)::int AS review_count,
           -- Weighted-by-review-count overall across all their courses.
           -- Postgres AVG on decimals returns a string; the page casts to Number.
           CASE
             WHEN COALESCE(SUM(pc.review_count), 0) = 0 THEN NULL
             ELSE SUM(pc.overall_score * pc.review_count) / NULLIF(SUM(pc.review_count), 0)
           END AS overall_score,
           u.short_name AS uni_short_name,
           u.slug       AS uni_slug,
           d.short_name AS dept_short_name,
           d.name_en    AS dept_name_en,
           d.slug       AS dept_slug
      FROM professors p
      JOIN universities u ON u.id = p.university_id
      JOIN departments  d ON d.id = p.department_id
 LEFT JOIN professor_courses pc ON pc.professor_id = p.id
     GROUP BY p.id, u.short_name, u.slug, d.short_name, d.name_en, d.slug
     ORDER BY COALESCE(SUM(pc.review_count), 0) DESC,
              CASE
                WHEN COALESCE(SUM(pc.review_count), 0) = 0 THEN NULL
                ELSE SUM(pc.overall_score * pc.review_count) / NULLIF(SUM(pc.review_count), 0)
              END DESC NULLS LAST,
              p.name_en ASC
     LIMIT 100
  `

  return rows.map((r) => ({
    id: r.id,
    publicId: r.public_id,
    nameEn: r.name_en,
    reviewCount: Number(r.review_count),
    overallScore: r.overall_score === null ? null : Number(r.overall_score),
    university: { shortName: r.uni_short_name, slug: r.uni_slug },
    department: {
      shortName: r.dept_short_name,
      nameEn: r.dept_name_en,
      slug: r.dept_slug,
    },
  }))
}

export default async function ProfessorsPage() {
  const [rows, strings, locale] = await Promise.all([getProfessors(), getStrings(), getLocale()])
  const nfmt = new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'bn-BD')

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {locale === 'en' ? 'Professors' : 'শিক্ষকবৃন্দ'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {locale === 'en'
            ? 'Ranked by how much student feedback exists: most-reviewed first, then by overall score.'
            : 'রিভিউয়ের সংখ্যার ভিত্তিতে সাজানো, তারপর সামগ্রিক স্কোর।'}
        </p>
      </header>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {locale === 'en'
              ? 'No professors in the catalog yet.'
              : 'এখনো কোনো শিক্ষক তালিকাভুক্ত হননি।'}
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/professors/${r.publicId}`} className="block">
                <Card className="transition-colors hover:bg-muted/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex flex-wrap items-baseline gap-2 text-base">
                      <span className="font-semibold">{obfuscateName(r.nameEn)}</span>
                      <Badge variant="secondary">{r.university.shortName}</Badge>
                      <Badge variant="outline">
                        {r.department.shortName ?? r.department.nameEn}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap items-baseline gap-4 text-sm">
                      <span>
                        <span className="text-lg font-semibold tabular-nums">
                          {r.overallScore === null ? '—' : r.overallScore.toFixed(1)}
                        </span>
                        <span className="text-muted-foreground"> / 5</span>
                      </span>
                      <span className="text-muted-foreground">
                        {nfmt.format(r.reviewCount)}{' '}
                        {locale === 'en'
                          ? strings.stats.totalReviews(r.reviewCount).replace(/^\d[\d,]*\s*/, '')
                          : r.reviewCount === 1
                            ? 'রিভিউ'
                            : 'রিভিউ'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
