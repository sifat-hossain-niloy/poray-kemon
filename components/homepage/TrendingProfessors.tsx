import { db } from '@/lib/db'
import { getCache, setCache, CACHE_KEYS, CACHE_TTL } from '@/lib/redis'
import { obfuscateName } from '@/lib/name-obfuscation'
import { LocaleLink as Link } from '@/components/i18n/LocaleLink'
import { Card, CardContent } from '@/components/ui/card'
import { getLocale } from '@/lib/i18n'

// SRS §10 Phase 2: "Trending professors widget — most reviewed in last 30 days".
export const TRENDING_WINDOW_DAYS = 30
const TRENDING_LIMIT = 6

interface TrendingEntry {
  publicId: string
  displayName: string
  universityShortName: string
  departmentLabel: string
  recentReviews: number
  overallScore: number | null
}

async function computeTrending(): Promise<TrendingEntry[]> {
  // Only counted reviews (visible + live/soft_flagged) — a burst of
  // reports-and-hidden reviews must not push someone onto the homepage.
  // The score shown is the professor's all-time weighted overall, not the
  // window's, so a trending card never disagrees with the profile page.
  const rows = await db.$queryRaw<
    Array<{
      public_id: string
      name_en: string
      name_bn: string | null
      uni_short_name: string
      dept_short_name: string | null
      dept_name_en: string
      recent_reviews: number
      overall_score: string | null
    }>
  >`
    WITH recent AS (
      SELECT pc.professor_id, COUNT(*)::int AS recent_reviews, MAX(r.submitted_at) AS last_at
      FROM reviews r
      JOIN professor_courses pc ON pc.id = r.professor_course_id
      WHERE r.submitted_at > NOW() - make_interval(days => ${TRENDING_WINDOW_DAYS}::int)
        AND r.status = 'visible'
        AND r.moderation_status IN ('live', 'soft_flagged')
      GROUP BY pc.professor_id
      ORDER BY recent_reviews DESC, last_at DESC
      LIMIT ${TRENDING_LIMIT}
    )
    SELECT p.public_id, p.name_en, p.name_bn,
           u.short_name AS uni_short_name,
           d.short_name AS dept_short_name, d.name_en AS dept_name_en,
           recent.recent_reviews,
           (SELECT SUM(pc2.overall_score * pc2.review_count) / NULLIF(SUM(pc2.review_count), 0)
              FROM professor_courses pc2
             WHERE pc2.professor_id = p.id AND pc2.review_count > 0)::text AS overall_score
    FROM recent
    JOIN professors p ON p.id = recent.professor_id
    JOIN universities u ON u.id = p.university_id
    JOIN departments d ON d.id = p.department_id
    ORDER BY recent.recent_reviews DESC, recent.last_at DESC
  `
  return rows.map((r) => ({
    publicId: r.public_id,
    displayName: r.name_bn ?? obfuscateName(r.name_en),
    universityShortName: r.uni_short_name,
    departmentLabel: r.dept_short_name ?? r.dept_name_en,
    recentReviews: r.recent_reviews,
    overallScore: r.overall_score === null ? null : Number(r.overall_score),
  }))
}

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
