// ─────────────────────────────────────────────────────────────────────────────
// /compare?ids=AAAA1111,BBBB2222 — up to three professors side by side.
// Selection lives in the URL, so a comparison is shareable as a link.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from 'next'
import { getLocale, getStrings } from '@/lib/i18n'
import { LocaleLink as Link } from '@/components/i18n/LocaleLink'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { CompareAdder } from '@/components/compare/CompareAdder'
import { bestIndices, compareHref, parseCompareIds, MAX_COMPARE } from '@/lib/compare'
import { loadComparison, type ComparedProfessor } from '@/lib/compare-loader'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ ids?: string | string[] }>
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title: locale === 'en' ? 'Compare professors' : 'শিক্ষকদের তুলনা',
    // Every combination of ids is its own URL — keep them out of the index.
    robots: { index: false, follow: true },
  }
}

export default async function ComparePage({ searchParams }: PageProps) {
  const [{ ids: rawIds }, strings, locale] = await Promise.all([
    searchParams,
    getStrings(),
    getLocale(),
  ])
  const en = locale === 'en'
  const numberLocale = en ? 'en-US' : 'bn-BD'
  const ids = parseCompareIds(rawIds)
  const knownTags = new Set(Object.keys(strings.tags))
  const tagLabels = strings.tags as Record<string, string>
  const columns = await loadComparison(ids, knownTags)
  const liveIds = columns.map((c) => c.publicId)

  const t = {
    title: en ? 'Compare professors' : 'শিক্ষকদের তুলনা',
    intro: en
      ? `Pick up to ${MAX_COMPARE} professors to see their ratings side by side. Share the page link to share the comparison.`
      : `সর্বোচ্চ ${MAX_COMPARE.toLocaleString(numberLocale)} জন শিক্ষক বেছে নিয়ে পাশাপাশি রেটিং দেখুন। পেজের লিংক শেয়ার করলেই তুলনাটি শেয়ার হবে।`,
    add: en ? 'Add a professor by name…' : 'নাম লিখে শিক্ষক যোগ করুন…',
    noMatches: en ? 'No other professors match.' : 'আর কোনো শিক্ষক মেলেনি।',
    full: en
      ? `Comparing the maximum of ${MAX_COMPARE}. Remove one to add another.`
      : `সর্বোচ্চ ${MAX_COMPARE.toLocaleString(numberLocale)} জনের তুলনা চলছে। নতুন যোগ করতে একজনকে সরান।`,
    remove: en ? 'Remove' : 'সরান',
    profile: en ? 'View profile →' : 'প্রোফাইল দেখুন →',
    overall: strings.professor.overallScore,
    recommend: en ? 'Would take again' : 'আবার নেবেন',
    reviews: en ? 'Reviews' : 'রিভিউ',
    tags: en ? 'Most mentioned' : 'সবচেয়ে বেশি উল্লেখিত',
    informational: en ? 'higher = harder / stricter' : 'বেশি = কঠিন / কড়া',
    best: en ? 'Best in this comparison' : 'এই তুলনায় সেরা',
  }

  const rows: {
    label: string
    hint?: string
    values: (number | null)[]
    format: (v: number) => string
    highlight: boolean
  }[] = [
    {
      label: t.overall,
      values: columns.map((c) => c.stats.overallScore),
      format: (v) => v.toFixed(1),
      highlight: true,
    },
    {
      label: strings.ratings.teachingQuality,
      values: columns.map((c) => c.stats.avgTeachingQuality),
      format: (v) => v.toFixed(1),
      highlight: true,
    },
    {
      label: strings.ratings.gradingFairness,
      values: columns.map((c) => c.stats.avgGradingFairness),
      format: (v) => v.toFixed(1),
      highlight: true,
    },
    {
      label: t.recommend,
      values: columns.map((c) => c.stats.wouldRecommendPct),
      format: (v) => `${Math.round(v).toLocaleString(numberLocale)}%`,
      highlight: true,
    },
    // Difficulty and attendance are informational per SRS Q1 — "better" is
    // a matter of taste, so they are never highlighted.
    {
      label: strings.ratings.courseDifficulty,
      hint: t.informational,
      values: columns.map((c) => c.stats.avgCourseDifficulty),
      format: (v) => v.toFixed(1),
      highlight: false,
    },
    {
      label: strings.ratings.attendance,
      hint: t.informational,
      values: columns.map((c) => c.stats.avgAttendance),
      format: (v) => v.toFixed(1),
      highlight: false,
    },
    {
      label: t.reviews,
      values: columns.map((c) => c.stats.totalReviews),
      format: (v) => v.toLocaleString(numberLocale),
      highlight: false,
    },
  ]

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.intro}</p>
      </header>

      <div className="mb-6 max-w-md">
        {liveIds.length < MAX_COMPARE ? (
          <CompareAdder ids={liveIds} labels={{ placeholder: t.add, noMatches: t.noMatches }} />
        ) : (
          <p className="text-sm text-muted-foreground">{t.full}</p>
        )}
      </div>

      {columns.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 align-top">
                <th className="w-40 p-3" />
                {columns.map((c) => (
                  <ColumnHeader
                    key={c.publicId}
                    column={c}
                    removeHref={compareHref(liveIds.filter((id) => id !== c.publicId))}
                    removeLabel={t.remove}
                    designations={strings.professor.designation}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const best = row.highlight ? bestIndices(row.values) : new Set<number>()
                return (
                  <tr key={row.label} className="border-b border-border last:border-0">
                    <th scope="row" className="p-3 text-left font-normal text-muted-foreground">
                      {row.label}
                      {row.hint ? <span className="block text-[10px]">{row.hint}</span> : null}
                    </th>
                    {row.values.map((v, i) => (
                      <td key={columns[i]?.publicId ?? i} className="p-3 text-center tabular-nums">
                        {v === null ? (
                          <span className="text-muted-foreground">-</span>
                        ) : (
                          <span
                            className={best.has(i) ? 'font-bold text-primary' : 'font-semibold'}
                            title={best.has(i) ? t.best : undefined}
                          >
                            {row.format(v)}
                            {best.has(i) ? <span className="sr-only"> ({t.best})</span> : null}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
              <tr className="border-b border-border">
                <th scope="row" className="p-3 text-left font-normal text-muted-foreground">
                  {t.tags}
                </th>
                {columns.map((c) => (
                  <td key={c.publicId} className="p-3">
                    <div className="flex flex-wrap justify-center gap-1">
                      {c.topTags.length === 0 ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (
                        c.topTags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px]">
                            {tagLabels[tag] ?? tag}
                          </Badge>
                        ))
                      )}
                    </div>
                  </td>
                ))}
              </tr>
              <tr>
                <td />
                {columns.map((c) => (
                  <td key={c.publicId} className="p-3 text-center">
                    <Link
                      href={`/professors/${c.publicId}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {t.profile}
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {t.intro}
          </CardContent>
        </Card>
      )}
    </main>
  )
}

function ColumnHeader({
  column,
  removeHref,
  removeLabel,
  designations,
}: {
  column: ComparedProfessor
  removeHref: string
  removeLabel: string
  designations: Record<string, string>
}) {
  return (
    <th scope="col" className="p-3 text-center font-normal">
      <Link
        href={`/professors/${column.publicId}`}
        className="block font-semibold text-foreground hover:underline"
      >
        {column.displayName}
      </Link>
      <span className="mt-0.5 block text-xs text-muted-foreground">
        {column.department.shortName ?? column.department.nameEn} · {column.university.shortName}
      </span>
      {column.designation ? (
        <span className="block text-xs text-muted-foreground">
          {designations[column.designation] ?? ''}
        </span>
      ) : null}
      <Link
        href={removeHref}
        className="mt-1 inline-block text-xs text-muted-foreground underline-offset-2 hover:text-destructive hover:underline"
      >
        {removeLabel}
      </Link>
    </th>
  )
}
