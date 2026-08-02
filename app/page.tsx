import { db } from '@/lib/db'
import { getCache, setCache, CACHE_KEYS, CACHE_TTL } from '@/lib/redis'
import { getLocale, getStrings } from '@/lib/i18n'
import { SearchBox } from '@/components/search/SearchBox'
import { FirstVisitDisclaimer } from '@/components/homepage/FirstVisitDisclaimer'
import { LocaleLink as Link } from '@/components/i18n/LocaleLink'

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

// Homepage reads live counts from Postgres/Redis. Force dynamic so Next 16
// doesn't try to prerender it at build time (build has no DB reachable).
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [stats, strings, locale] = await Promise.all([getSiteStats(), getStrings(), getLocale()])
  const numberLocale = locale === 'en' ? 'en-US' : 'bn-BD'

  const browseLabel =
    locale === 'en' ? `Browse ${strings.nav.universities}` : `${strings.nav.universities} দেখুন`
  const footerTagline =
    locale === 'en'
      ? `${strings.site.name} · For Bangladeshi students`
      : `${strings.site.name} · বাংলাদেশের শিক্ষার্থীদের জন্য`
  const footerAnonymity = locale === 'en' ? 'Fully anonymous' : 'সম্পূর্ণ বেনামী'
  const guidelinesLabel = locale === 'en' ? 'Guidelines' : 'নির্দেশিকা'
  const anonymityLabel = locale === 'en' ? 'How anonymity works' : 'কীভাবে বেনামী থাকে'

  const anonymityBlock = locale === 'en' ? EN_ANONYMITY : BN_ANONYMITY

  return (
    <div className="flex flex-col flex-1">
      <FirstVisitDisclaimer locale={locale === 'en' ? 'en' : 'bn'} />

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

          {/* Live debounced search, results appear as you type */}
          <SearchBox variant="hero" autoFocus />

          {/* Site stats — each card links to its own listing so a
              new visitor can jump straight into content. */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            <StatCard
              href="/reviews"
              value={stats.totalReviews}
              label={strings.stats.totalReviews(stats.totalReviews)}
              numberLocale={numberLocale}
            />
            <StatCard
              href="/professors"
              value={stats.totalProfessors}
              label={strings.stats.totalProfessors(stats.totalProfessors)}
              numberLocale={numberLocale}
            />
            <StatCard
              href="/universities"
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

      {/* ── Anonymity assurance ────────────────────────────────────────────── */}
      <section
        aria-labelledby="pk-anonymity-heading"
        className="border-t border-border bg-muted/30 px-4 py-14 sm:py-16"
      >
        <div className="mx-auto max-w-3xl space-y-8">
          <div className="text-center space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              {anonymityBlock.eyebrow}
            </p>
            <h2 id="pk-anonymity-heading" className="text-2xl sm:text-3xl font-bold tracking-tight">
              {anonymityBlock.heading}
            </h2>
            <p className="text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              {anonymityBlock.subheading}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {anonymityBlock.pillars.map((p) => (
              <div key={p.title} className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm font-semibold text-foreground">{p.title}</p>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Link
              href="/guidelines"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              {anonymityBlock.readMore} →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        <p className="space-x-2">
          <span>{footerTagline}</span>
          <span aria-hidden>·</span>
          <span className="font-medium">{footerAnonymity}</span>
          <span aria-hidden>·</span>
          <Link href="/guidelines" className="hover:text-foreground hover:underline">
            {guidelinesLabel}
          </Link>
          <span aria-hidden>·</span>
          <Link href="/about#anonymity" className="hover:text-foreground hover:underline">
            {anonymityLabel}
          </Link>
        </p>
      </footer>
    </div>
  )
}

// ── Anonymity copy ──────────────────────────────────────────────────────────

interface AnonymityCopy {
  eyebrow: string
  heading: string
  subheading: string
  pillars: { title: string; body: string }[]
  readMore: string
}

const EN_ANONYMITY: AnonymityCopy = {
  eyebrow: 'Anonymous by construction',
  heading: 'Your review can never be traced to you',
  subheading:
    "We designed the database so that we, the maintainers, cannot tell who wrote any given review. It's not a promise we're asking you to trust; it's a schema you can verify.",
  pillars: [
    {
      title: 'No user ID on reviews',
      body: 'The reviews table has no column linking to your account. It cannot be added later without breaking the app.',
    },
    {
      title: 'Separate submission ledger',
      body: 'We track "you reviewed this course" in a different table with no shared identifier, so duplicates get blocked without linking you to content.',
    },
    {
      title: 'No email stored',
      body: "We use Google sign-in only to detect duplicates. We never receive your email and there's nowhere in our database to keep it.",
    },
  ],
  readMore: 'Read the full architecture',
}

const BN_ANONYMITY: AnonymityCopy = {
  eyebrow: 'গঠনগতভাবে বেনামী',
  heading: 'আপনার রিভিউ কখনো আপনার পর্যন্ত পৌঁছাবে না',
  subheading:
    'ডেটাবেস এমনভাবে তৈরি করা যাতে আমরা নিজেরাও কে কোন রিভিউ লিখেছে বলতে না পারি। এটা প্রতিশ্রুতি নয়, কোডে যাচাই করে দেখার মতো একটি স্কিমা।',
  pillars: [
    {
      title: 'রিভিউয়ে কোনো ইউজার ID নেই',
      body: 'reviews টেবিলে আপনার অ্যাকাউন্টের সাথে যুক্ত কোনো কলাম নেই। পরে যোগ করলে অ্যাপ ভেঙে যাবে।',
    },
    {
      title: 'আলাদা সাবমিশন লেজার',
      body: '“আপনি এই কোর্স রিভিউ করেছেন”, এই তথ্য ভিন্ন টেবিলে রাখা হয়। কোনো সাধারণ আইডি নেই বলে ডুপ্লিকেট ব্লক হয়, কিন্তু কনটেন্টের সাথে জোড়া লাগানো যায় না।',
    },
    {
      title: 'ইমেইল সংরক্ষণ নয়',
      body: 'ডুপ্লিকেট ঠেকাতে Google সাইন-ইন ব্যবহার করি, ইমেইল কখনো পাই না, আমাদের ডেটাবেসে রাখারও জায়গা নেই।',
    },
  ],
  readMore: 'সম্পূর্ণ আর্কিটেকচার পড়ুন',
}

// ── Helper ────────────────────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  numberLocale,
  href,
}: {
  value: number
  label: string
  numberLocale: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted"
    >
      <span className="text-2xl font-bold text-foreground tabular-nums">
        {value.toLocaleString(numberLocale)}
      </span>
      <span className="mt-1 text-xs text-muted-foreground leading-snug">{label}</span>
    </Link>
  )
}
