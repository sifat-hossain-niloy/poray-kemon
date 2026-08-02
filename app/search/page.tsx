import { LocaleLink as Link } from '@/components/i18n/LocaleLink'
import type { Metadata } from 'next'
import { search, type SearchResultKind } from '@/lib/search'
import { getLocale, getStrings } from '@/lib/i18n'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ q?: string | string[] }>
}

const KIND_LABELS_BN: Record<SearchResultKind, string> = {
  university: 'বিশ্ববিদ্যালয়',
  department: 'বিভাগ',
  professor: 'শিক্ষক',
}
const KIND_LABELS_EN: Record<SearchResultKind, string> = {
  university: 'University',
  department: 'Department',
  professor: 'Professor',
}

const KIND_VARIANT: Record<SearchResultKind, 'default' | 'secondary' | 'outline'> = {
  university: 'default',
  department: 'secondary',
  professor: 'outline',
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams
  const query = Array.isArray(q) ? q[0] : q
  const locale = await getLocale()
  return {
    title: query
      ? locale === 'en'
        ? `Results for "${query}"`
        : `"${query}" এর জন্য ফলাফল`
      : locale === 'en'
        ? 'Search'
        : 'অনুসন্ধান',
    robots: { index: false },
  }
}

export default async function SearchPage({ searchParams }: PageProps) {
  const [strings, locale] = await Promise.all([getStrings(), getLocale()])
  const KIND_LABELS = locale === 'en' ? KIND_LABELS_EN : KIND_LABELS_BN

  const t =
    locale === 'en'
      ? {
          tooShort: 'Enter at least 2 characters',
          noResults: (q: string) => `No results found for "${q}"`,
          tryAgain: 'Try a different search, or check the spelling.',
          total: (n: number) => `${n.toLocaleString('en-US')} results`,
        }
      : {
          tooShort: 'কমপক্ষে ২টি অক্ষর লিখুন',
          noResults: (q: string) => `"${q}" এর জন্য কোনো ফলাফল পাওয়া যায়নি।`,
          tryAgain: 'অন্য কিছু লিখে দেখুন, অথবা বানান যাচাই করুন।',
          total: (n: number) => `${n.toLocaleString('bn-BD')} টি ফলাফল`,
        }

  const { q } = await searchParams
  const query = (Array.isArray(q) ? q[0] : q)?.trim() ?? ''
  const results = query.length >= 2 ? await search(query) : []

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <form action="/search" method="GET" className="mb-6">
        <div className="relative">
          <svg
            aria-hidden="true"
            className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
            />
          </svg>
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder={strings.site.searchPlaceholder}
            autoFocus
            className="w-full rounded-2xl border border-border bg-card px-5 py-4 pl-12 text-base shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </form>

      {query.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">{strings.site.searchPlaceholder}</p>
      ) : query.length < 2 ? (
        <p className="py-12 text-center text-muted-foreground">{t.tooShort}</p>
      ) : results.length === 0 ? (
        <div className="py-12 text-center">
          <p className="font-medium">{t.noResults(query)}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t.tryAgain}</p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">{t.total(results.length)}</p>
          <ul className="space-y-3">
            {results.map((r) => (
              <li key={`${r.kind}-${r.id}`}>
                <Link href={r.href} className="block">
                  <Card className="p-4 transition-shadow hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold leading-tight">{r.title}</div>
                        <div className="mt-0.5 text-sm text-muted-foreground line-clamp-1">
                          {r.subtitle}
                        </div>
                      </div>
                      <Badge variant={KIND_VARIANT[r.kind]} className="shrink-0">
                        {KIND_LABELS[r.kind]}
                      </Badge>
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  )
}
