import Link from 'next/link'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { STRINGS } from '@/lib/strings'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata: Metadata = {
  title: 'বিশ্ববিদ্যালয়',
  description: 'বাংলাদেশের সব বিশ্ববিদ্যালয়ের তালিকা',
}

// Revalidate the static HTML every 5 minutes — universities change very rarely
export const revalidate = 300

const TYPE_LABELS: Record<'public' | 'private' | 'international', string> = {
  public: 'সরকারি',
  private: 'বেসরকারি',
  international: 'আন্তর্জাতিক',
}

async function getUniversities() {
  return db.university.findMany({
    orderBy: [{ type: 'asc' }, { shortName: 'asc' }],
    select: {
      id: true,
      nameEn: true,
      nameBn: true,
      shortName: true,
      slug: true,
      locationCity: true,
      type: true,
      _count: {
        select: { departments: true, professors: true },
      },
    },
  })
}

export default async function UniversitiesPage() {
  const universities = await getUniversities()

  // Group by type for visual separation
  const grouped = {
    public: universities.filter((u) => u.type === 'public'),
    private: universities.filter((u) => u.type === 'private'),
    international: universities.filter((u) => u.type === 'international'),
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{STRINGS.nav.universities}</h1>
        <p className="text-muted-foreground">
          বাংলাদেশের {universities.length.toLocaleString('bn-BD')} টি বিশ্ববিদ্যালয়
        </p>
      </div>

      {/* Sections */}
      {(['public', 'private', 'international'] as const).map((type) => {
        const list = grouped[type]
        if (list.length === 0) return null

        return (
          <section key={type} className="mb-10">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-xl font-semibold">{TYPE_LABELS[type]}</h2>
              <Badge variant="secondary">{list.length.toLocaleString('bn-BD')}</Badge>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((uni) => (
                <Link key={uni.id} href={`/universities/${uni.slug}`} className="group">
                  <Card className="h-full transition-shadow hover:shadow-md">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg leading-tight group-hover:text-primary">
                          {uni.shortName}
                        </CardTitle>
                        {uni.locationCity ? (
                          <Badge variant="outline" className="shrink-0">
                            {uni.locationCity}
                          </Badge>
                        ) : null}
                      </div>
                      <CardDescription className="line-clamp-2">
                        {uni.nameBn ?? uni.nameEn}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      <div className="flex gap-4">
                        <span>{uni._count.departments.toLocaleString('bn-BD')} বিভাগ</span>
                        <span>{uni._count.professors.toLocaleString('bn-BD')} শিক্ষক</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )
      })}
    </main>
  )
}
