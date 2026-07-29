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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const uni = await db.university.findUnique({
    where: { slug },
    select: { nameEn: true, nameBn: true, shortName: true },
  })
  if (!uni) return { title: 'Not found' }
  return {
    title: `${uni.shortName} — ${uni.nameBn ?? uni.nameEn}`,
    description: `${uni.nameEn} এর বিভাগসমূহ এবং শিক্ষকবৃন্দ`,
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

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
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
