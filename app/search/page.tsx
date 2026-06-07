import Link from 'next/link'
import type { Metadata } from 'next'
import { search, type SearchResultKind } from '@/lib/search'
import { STRINGS } from '@/lib/strings'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ q?: string | string[] }>
}

const KIND_LABELS: Record<SearchResultKind, string> = {
  university: 'বিশ্ববিদ্যালয়',
  department: 'বিভাগ',
  professor: 'শিক্ষক',
}

const KIND_VARIANT: Record<SearchResultKind, 'default' | 'secondary' | 'outline'> = {
  university: 'default',
  department: 'secondary',
  professor: 'outline',
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { q } = await searchParams
  const query = Array.isArray(q) ? q[0] : q
  return {
    title: query ? `"${query}" এর জন্য ফলাফল` : 'অনুসন্ধান',
    robots: { index: false }, // search pages shouldn't be indexed
  }
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams
  const query = (Array.isArray(q) ? q[0] : q)?.trim() ?? ''

  const results = query.length >= 2 ? await search(query) : []

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      {/* Search form (controlled via URL — pure server) */}
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
            placeholder={STRINGS.site.searchPlaceholder}
            autoFocus
            className="w-full rounded-2xl border border-border bg-card px-5 py-4 pl-12 text-base shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </form>

      {/* Result summary */}
      {query.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">{STRINGS.site.searchPlaceholder}</p>
      ) : query.length < 2 ? (
        <p className="py-12 text-center text-muted-foreground">কমপক্ষে ২টি অক্ষর লিখুন</p>
      ) : results.length === 0 ? (
        <div className="py-12 text-center">
          <p className="font-medium">&ldquo;{query}&rdquo; এর জন্য কোনো ফলাফল পাওয়া যায়নি।</p>
          <p className="mt-2 text-sm text-muted-foreground">
            অন্য কিছু লিখে দেখুন, অথবা বানান যাচাই করুন।
          </p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            {results.length.toLocaleString('bn-BD')} টি ফলাফল
          </p>
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
