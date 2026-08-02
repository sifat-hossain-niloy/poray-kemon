import { db } from '@/lib/db'
import { getCache, setCache, CACHE_KEYS, CACHE_TTL } from '@/lib/redis'
import { combineProfessorStats } from '@/lib/professor-stats'
import { obfuscateName } from '@/lib/name-obfuscation'
import { LocaleLink as Link } from '@/components/i18n/LocaleLink'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getLocale } from '@/lib/i18n'

const TOP_N = 10
// A professor needs at least this many reviews to appear on the leaderboard.
// Prevents a single 5-star review from parking someone at the top forever.
const MIN_REVIEWS_TO_QUALIFY = 3

interface LeaderboardEntry {
  publicId: string
  displayName: string
  universityShortName: string
  departmentLabel: string
  overallScore: number
  totalReviews: number
  wouldRecommendPct: number | null
}

async function computeTopProfessors(): Promise<LeaderboardEntry[]> {
  // Pull every professor that has at least MIN_REVIEWS_TO_QUALIFY reviews
  // across all courses, then merge per-course aggregates into a single
  // weighted score using the same helper the profile page uses.
  const candidates = await db.professor.findMany({
    where: {
      professorCourses: {
        some: { reviewCount: { gt: 0 } },
      },
    },
    select: {
      publicId: true,
      nameEn: true,
      nameBn: true,
      university: { select: { shortName: true } },
      department: { select: { shortName: true, nameEn: true } },
      professorCourses: {
        select: {
          reviewCount: true,
          avgTeachingQuality: true,
          avgGradingFairness: true,
          avgCourseDifficulty: true,
          avgAttendance: true,
          wouldRecommendPct: true,
          overallScore: true,
        },
      },
    },
  })

  const ranked = candidates
    .map((p) => {
      const combined = combineProfessorStats(
        p.professorCourses.map((pc) => ({
          reviewCount: pc.reviewCount,
          avgTeachingQuality: pc.avgTeachingQuality
            ? Number(pc.avgTeachingQuality.toString())
            : null,
          avgGradingFairness: pc.avgGradingFairness
            ? Number(pc.avgGradingFairness.toString())
            : null,
          avgCourseDifficulty: pc.avgCourseDifficulty
            ? Number(pc.avgCourseDifficulty.toString())
            : null,
          avgAttendance: pc.avgAttendance ? Number(pc.avgAttendance.toString()) : null,
          wouldRecommendPct: pc.wouldRecommendPct ? Number(pc.wouldRecommendPct.toString()) : null,
          overallScore: pc.overallScore ? Number(pc.overallScore.toString()) : null,
        })),
      )
      return { p, combined }
    })
    .filter(
      (r): r is typeof r & { combined: { overallScore: number } } =>
        r.combined.overallScore !== null && r.combined.totalReviews >= MIN_REVIEWS_TO_QUALIFY,
    )
    // Sort by overall score desc, then by review count desc (more evidence wins ties)
    .sort((a, b) => {
      const scoreDiff = b.combined.overallScore - a.combined.overallScore
      if (scoreDiff !== 0) return scoreDiff
      return b.combined.totalReviews - a.combined.totalReviews
    })
    .slice(0, TOP_N)

  return ranked.map(({ p, combined }) => ({
    publicId: p.publicId,
    displayName: p.nameBn ?? obfuscateName(p.nameEn),
    universityShortName: p.university.shortName,
    departmentLabel: p.department.shortName ?? p.department.nameEn,
    overallScore: combined.overallScore,
    totalReviews: combined.totalReviews,
    wouldRecommendPct: combined.wouldRecommendPct,
  }))
}

async function getTopProfessors(): Promise<LeaderboardEntry[]> {
  const cached = await getCache<LeaderboardEntry[]>(CACHE_KEYS.topProfessors)
  if (cached) return cached
  const fresh = await computeTopProfessors()
  await setCache(CACHE_KEYS.topProfessors, fresh, CACHE_TTL.topProfessors)
  return fresh
}

export async function TopProfessorsLeaderboard() {
  const [entries, locale] = await Promise.all([getTopProfessors(), getLocale()])
  if (entries.length === 0) return null

  const numberLocale = locale === 'en' ? 'en-US' : 'bn-BD'
  const heading = locale === 'en' ? 'Top-rated professors' : 'সর্বোচ্চ রেটিং পাওয়া শিক্ষক'
  const sub =
    locale === 'en'
      ? `Highest overall scores across at least ${MIN_REVIEWS_TO_QUALIFY} reviews`
      : `কমপক্ষে ${MIN_REVIEWS_TO_QUALIFY.toLocaleString(numberLocale)} টি রিভিউ নিয়ে সর্বোচ্চ ওভারঅল স্কোর`
  const outOfFive = locale === 'en' ? '/ 5' : '/ ৫'
  const reviewLabel = (n: number) =>
    locale === 'en'
      ? `${n.toLocaleString(numberLocale)} ${n === 1 ? 'review' : 'reviews'}`
      : `${n.toLocaleString(numberLocale)} টি রিভিউ`
  const seeAll = locale === 'en' ? 'See all professors →' : 'সব শিক্ষক দেখুন →'

  return (
    <section
      aria-labelledby="pk-leaderboard-heading"
      className="border-t border-border px-4 py-14 sm:py-16"
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="text-left">
          <h2 id="pk-leaderboard-heading" className="text-2xl sm:text-3xl font-bold tracking-tight">
            {heading}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
        </div>

        <ol className="space-y-2">
          {entries.map((e, idx) => (
            <li key={e.publicId}>
              <Link
                href={`/professors/${e.publicId}`}
                className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
              >
                <Card className="transition-colors group-hover:border-primary/50">
                  <CardContent className="flex items-center gap-3 py-3 sm:gap-4">
                    <span
                      className="shrink-0 text-lg font-bold tabular-nums text-muted-foreground w-6 text-center"
                      aria-label={`Rank ${idx + 1}`}
                    >
                      {(idx + 1).toLocaleString(numberLocale)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-medium">{e.displayName}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {e.departmentLabel} · {e.universityShortName} ·{' '}
                        {reviewLabel(e.totalReviews)}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold tabular-nums">
                          {e.overallScore.toFixed(1)}
                        </span>
                        <span className="text-xs text-muted-foreground">{outOfFive}</span>
                      </div>
                      {e.wouldRecommendPct !== null ? (
                        <Badge variant="secondary" className="text-[10px]">
                          {Math.round(e.wouldRecommendPct).toLocaleString(numberLocale)}%
                        </Badge>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ol>

        <div className="text-center">
          <Link
            href="/professors"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {seeAll}
          </Link>
        </div>
      </div>
    </section>
  )
}
