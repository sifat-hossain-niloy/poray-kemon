import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const revalidate = 300

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
  const canonical = `/universities/${uni.slug}`
  const title = `${uni.shortName} (${uni.nameEn}) — professor reviews`
  const description =
    `Anonymous student reviews of professors and courses at ${uni.nameEn} (${uni.shortName}). ` +
    `${uni._count.professors} professors across ${uni._count.departments} departments.`
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: 'website' },
    twitter: { card: 'summary', title, description },
  }
}

export default async function UniversityPage({ params }: PageProps) {
  const { slug } = await params
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

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-sm">
          <Link href="/universities" className="text-muted-foreground hover:text-foreground">
            ← বিশ্ববিদ্যালয়
          </Link>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{uni.shortName}</h1>
            <p className="mt-1 text-muted-foreground">{uni.nameBn ?? uni.nameEn}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            {uni.locationCity ? <Badge variant="outline">{uni.locationCity}</Badge> : null}
            <Badge variant="secondary">
              {uni.type === 'public'
                ? 'সরকারি'
                : uni.type === 'private'
                  ? 'বেসরকারি'
                  : 'আন্তর্জাতিক'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Departments */}
      <section>
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-xl font-semibold">বিভাগসমূহ</h2>
          <Badge variant="secondary">{uni.departments.length.toLocaleString('bn-BD')}</Badge>
        </div>

        {uni.departments.length === 0 ? (
          <p className="text-muted-foreground">এখনো কোনো বিভাগ যোগ করা হয়নি।</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {uni.departments.map((dept) => (
              <Link
                key={dept.id}
                href={`/universities/${uni.slug}/departments/${dept.slug}`}
                className="group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
              >
                <Card className="h-full transition-colors group-hover:border-primary/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <CardTitle className="text-base">{dept.shortName ?? dept.nameEn}</CardTitle>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {dept._count.professors.toLocaleString('bn-BD')} শিক্ষক
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    {dept.nameBn ?? dept.nameEn}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
