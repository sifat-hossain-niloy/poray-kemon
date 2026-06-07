import { db } from '@/lib/db'
import { getCache, setCache, CACHE_KEYS, CACHE_TTL } from '@/lib/redis'
import { STRINGS } from '@/lib/strings'
import Link from 'next/link'

// ── Site stats fetched once per minute via Redis ──────────────────────────────

interface SiteStats {
  totalReviews: number
  totalProfessors: number
  totalUniversities: number
}

async function getSiteStats(): Promise<SiteStats> {
  const cached = await getCache<SiteStats>(CACHE_KEYS.siteStats)
  if (cached) return cached

  const [totalReviews, totalProfessors, totalUniversities] = await Promise.all([
    db.review.count({ where: { status: 'visible', moderationStatus: 'live' } }),
    db.professor.count(),
    db.university.count(),
  ])

  const stats: SiteStats = { totalReviews, totalProfessors, totalUniversities }
  await setCache(CACHE_KEYS.siteStats, stats, CACHE_TTL.siteStats)
  return stats
}

// Server Component — no 'use client'. Rendered at request time (dynamic).
export default async function HomePage() {
  const stats = await getSiteStats()

  return (
    <div className="flex flex-col flex-1">
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <div className="max-w-2xl w-full mx-auto space-y-8">
          {/* Heading */}
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
              {STRINGS.site.name}
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">{STRINGS.site.tagline}</p>
          </div>

          {/* Search bar — client interaction handled in SearchBox component (next step) */}
          <div className="relative w-full">
            <form action="/search" method="GET">
              <div className="relative">
                <svg
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  aria-hidden="true"
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
                  placeholder={STRINGS.site.searchPlaceholder}
                  className="w-full rounded-2xl border border-border bg-card px-5 py-4 pl-12 text-base shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
              </div>
            </form>
          </div>

          {/* Site stats */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            <StatCard
              value={stats.totalReviews}
              label={STRINGS.stats.totalReviews(stats.totalReviews)}
            />
            <StatCard
              value={stats.totalProfessors}
              label={STRINGS.stats.totalProfessors(stats.totalProfessors)}
            />
            <StatCard
              value={stats.totalUniversities}
              label={STRINGS.stats.totalUniversities(stats.totalUniversities)}
            />
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href="/universities"
              className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-6 py-3 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
            >
              {STRINGS.nav.universities} দেখুন
            </Link>
            <Link
              href="/review/new"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              {STRINGS.nav.writeReview}
            </Link>
          </div>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        <p>
          {STRINGS.site.name} · বাংলাদেশের শিক্ষার্থীদের জন্য, শিক্ষার্থীদের তৈরি ·{' '}
          <span className="font-medium">সম্পূর্ণ বেনামী</span>
        </p>
      </footer>
    </div>
  )
}

// ── Helper ────────────────────────────────────────────────────────────────────

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-border bg-card p-4 shadow-sm">
      <span className="text-2xl font-bold text-foreground tabular-nums">
        {value.toLocaleString('bn-BD')}
      </span>
      <span className="mt-1 text-xs text-muted-foreground leading-snug">{label}</span>
    </div>
  )
}
