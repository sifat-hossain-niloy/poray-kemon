import Link from 'next/link'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { getLocale, getStrings } from '@/lib/i18n'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title: locale === 'en' ? 'Universities' : 'বিশ্ববিদ্যালয়',
    description:
      locale === 'en'
        ? 'All universities in Bangladesh covered by Poray Kemon'
        : 'বাংলাদেশের সব বিশ্ববিদ্যালয়ের তালিকা',
  }
}

// Universities change rarely. The ISR cache key includes the cookie via Next's
// dynamic rendering for dynamic functions — but to be safe we drop the
// revalidate hint and render on-demand. The DB query is cheap.
export const dynamic = 'force-dynamic'

const TYPE_LABELS_BN: Record<'public' | 'private' | 'international', string> = {
  public: 'সরকারি',
  private: 'বেসরকারি',
  international: 'আন্তর্জাতিক',
}
const TYPE_LABELS_EN: Record<'public' | 'private' | 'international', string> = {
  public: 'Public',
  private: 'Private',
  international: 'International',
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
      _count: { select: { departments: true, professors: true } },
    },
  })
}

export default async function UniversitiesPage() {
  const [universities, strings, locale] = await Promise.all([
    getUniversities(),
    getStrings(),
    getLocale(),
  ])
  const numberLocale = locale === 'en' ? 'en-US' : 'bn-BD'
  const TYPE_LABELS = locale === 'en' ? TYPE_LABELS_EN : TYPE_LABELS_BN
  const header =
    locale === 'en'
      ? `${universities.length.toLocaleString(numberLocale)} universities in Bangladesh`
      : `বাংলাদেশের ${universities.length.toLocaleString(numberLocale)} টি বিশ্ববিদ্যালয়`
  const departmentsLabel = locale === 'en' ? 'departments' : 'বিভাগ'
  const professorsLabel = locale === 'en' ? 'professors' : 'শিক্ষক'

  const grouped = {
    public: universities.filter((u) => u.type === 'public'),
    private: universities.filter((u) => u.type === 'private'),
    international: universities.filter((u) => u.type === 'international'),
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{strings.nav.universities}</h1>
        <p className="text-muted-foreground">{header}</p>
      </div>

      {(['public', 'private', 'international'] as const).map((type) => {
        const list = grouped[type]
        if (list.length === 0) return null
        return (
          <section key={type} className="mb-10">
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-xl font-semibold">{TYPE_LABELS[type]}</h2>
              <Badge variant="secondary">{list.length.toLocaleString(numberLocale)}</Badge>
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
                        {locale === 'en' ? uni.nameEn : (uni.nameBn ?? uni.nameEn)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      <div className="flex gap-4">
                        <span>
                          {uni._count.departments.toLocaleString(numberLocale)} {departmentsLabel}
                        </span>
                        <span>
                          {uni._count.professors.toLocaleString(numberLocale)} {professorsLabel}
                        </span>
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
