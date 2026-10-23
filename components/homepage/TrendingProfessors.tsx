import { getCache, setCache, CACHE_KEYS, CACHE_TTL } from '@/lib/redis'
import { computeTrending, TRENDING_WINDOW_DAYS, type TrendingEntry } from '@/lib/trending'
import { LocaleLink as Link } from '@/components/i18n/LocaleLink'
import { Card, CardContent } from '@/components/ui/card'
import { getLocale } from '@/lib/i18n'

async function getTrending(): Promise<TrendingEntry[]> {
  const cached = await getCache<TrendingEntry[]>(CACHE_KEYS.trendingProfessors)
  if (cached) return cached
  // An optional homepage section must never take the whole page down.
  const fresh = await computeTrending().catch((err: unknown) => {
    console.error('[trending] query failed:', err)
    return null
  })
  if (!fresh) return []
  await setCache(CACHE_KEYS.trendingProfessors, fresh, CACHE_TTL.trendingProfessors)
  return fresh
}

export async function TrendingProfessors() {
  const [entries, locale] = await Promise.all([getTrending(), getLocale()])
  if (entries.length === 0) return null

  const en = locale === 'en'
  const numberLocale = en ? 'en-US' : 'bn-BD'
  const heading = en ? 'Trending this month' : 'এই মাসে আলোচনায়'
  const sub = en
    ? `Most reviewed professors in the last ${TRENDING_WINDOW_DAYS} days`
    : `গত ${TRENDING_WINDOW_DAYS.toLocaleString(numberLocale)} দিনে সবচেয়ে বেশি রিভিউ পাওয়া শিক্ষক`
  const newReviews = (n: number) =>
    en
      ? `+${n.toLocaleString(numberLocale)} new ${n === 1 ? 'review' : 'reviews'}`
      : `+${n.toLocaleString(numberLocale)} নতুন রিভিউ`
  const outOfFive = en ? '/ 5' : '/ ৫'

  return (
    <section
      aria-labelledby="pk-trending-heading"
      className="border-t border-border px-4 py-14 sm:py-16"
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h2 id="pk-trending-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
            {heading}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
        </div>

        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {entries.map((e) => (
            <li key={e.publicId}>
              <Link
                href={`/professors/${e.publicId}`}
                className="group block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full transition-colors group-hover:border-primary/50">
                  <CardContent className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{e.displayName}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {e.departmentLabel} · {e.universityShortName}
                      </p>
                      <p className="mt-1 text-xs font-medium text-primary">
                        {newReviews(e.recentReviews)}
                      </p>
                    </div>
                    {e.overallScore !== null ? (
                      <div className="flex shrink-0 items-baseline gap-1">
                        <span className="text-xl font-bold tabular-nums">
                          {e.overallScore.toFixed(1)}
                        </span>
                        <span className="text-xs text-muted-foreground">{outOfFive}</span>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
