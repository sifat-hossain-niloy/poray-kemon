import { db } from '@/lib/db'
import { getCache, setCache, CACHE_KEYS, CACHE_TTL } from '@/lib/redis'
import { getLocale, getStrings } from '@/lib/i18n'
import { SearchBox } from '@/components/search/SearchBox'
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
  const [stats, strings, locale] = await Promise.all([getSiteStats(), getStrings(), getLocale()])
  const numberLocale = locale === 'en' ? 'en-US' : 'bn-BD'

  const browseLabel =
    locale === 'en' ? `Browse ${strings.nav.universities}` : `${strings.nav.universities} দেখুন`
  const footerTagline =
    locale === 'en'
      ? `${strings.site.name} · For Bangladesh's students, by Bangladesh's student`
      : `${strings.site.name} · বাংলাদেশের শিক্ষার্থীদের জন্য, শিক্ষার্থীর তৈরি`
  const footerAnonymity = locale === 'en' ? 'Fully anonymous' : 'সম্পূর্ণ বেনামী'

  return (
    <div className="flex flex-col flex-1">
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <div className="max-w-2xl w-full mx-auto space-y-8">
          {/* Heading */}
          <div className="space-y-3">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
              {strings.site.name}
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">{strings.site.tagline}</p>
          </div>

          {/* Live debounced search — results appear as you type */}
          <SearchBox variant="hero" autoFocus />

          {/* Site stats */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            <StatCard
              value={stats.totalReviews}
              label={strings.stats.totalReviews(stats.totalReviews)}
              numberLocale={numberLocale}
            />
            <StatCard
              value={stats.totalProfessors}
              label={strings.stats.totalProfessors(stats.totalProfessors)}
              numberLocale={numberLocale}
            />
            <StatCard
              value={stats.totalUniversities}
              label={strings.stats.totalUniversities(stats.totalUniversities)}
              numberLocale={numberLocale}
            />
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href="/universities"
              className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-6 py-3 text-sm font-medium shadow-sm transition-colors hover:bg-muted"
            >
              {browseLabel}
            </Link>
            <Link
              href="/review/new"
              className="inline-flex items-center justify-center rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              {strings.nav.writeReview}
            </Link>
          </div>
        </div>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        <p>
          {footerTagline} · <span className="font-medium">{footerAnonymity}</span>
        </p>
      </footer>
    </div>
  )
}

// ── Helper ────────────────────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  numberLocale,
}: {
  value: number
  label: string
  numberLocale: string
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-border bg-card p-4 shadow-sm">
      <span className="text-2xl font-bold text-foreground tabular-nums">
        {value.toLocaleString(numberLocale)}
      </span>
      <span className="mt-1 text-xs text-muted-foreground leading-snug">{label}</span>
    </div>
  )
}
