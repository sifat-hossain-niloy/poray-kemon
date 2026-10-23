import type { Metadata } from 'next'
import { LocaleLink as Link } from '@/components/i18n/LocaleLink'
import { getLocale } from '@/lib/i18n'
import { localeAlternates } from '@/lib/i18n/alternates'
import { PRIVACY_BN, PRIVACY_EN } from '@/lib/i18n/privacy'
import { Card, CardContent } from '@/components/ui/card'

// ISR — the policy changes rarely. Locale-keyed cache slot.
export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const content = locale === 'en' ? PRIVACY_EN : PRIVACY_BN
  const alt = localeAlternates('/privacy', locale)
  return {
    title: content.title,
    description: content.summary.slice(0, 160),
    alternates: { canonical: alt.canonical, languages: alt.languages },
  }
}

export default async function PrivacyPage() {
  const locale = await getLocale()
  const content = locale === 'en' ? PRIVACY_EN : PRIVACY_BN

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <header className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">{content.title}</h1>
        <p className="mt-2 text-xs text-muted-foreground">{content.lastUpdated}</p>
      </header>

      <Card className="mb-10 border-primary/30 bg-primary/5">
        <CardContent className="py-4 text-sm leading-relaxed">{content.summary}</CardContent>
      </Card>

      <article className="space-y-8">
        {content.sections.map((section) => (
          <section key={section.heading} className="space-y-3">
            <h2 className="text-xl font-semibold tracking-tight">{section.heading}</h2>
            <div className="space-y-2 text-sm text-foreground/90">
              {section.paragraphs?.map((p, i) => (
                <p key={i} className="leading-relaxed">
                  <Inline>{p}</Inline>
                </p>
              ))}
              {section.bullets ? (
                <ul className="space-y-2">
                  {section.bullets.map((b, i) => (
                    <li key={i} className="flex gap-2">
                      <span aria-hidden="true" className="select-none text-muted-foreground">
                        •
                      </span>
                      <Inline>{b}</Inline>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        ))}
      </article>

      <div className="mt-12 flex justify-center gap-6 text-sm">
        <Link
          href="/about"
          className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {locale === 'en' ? 'How anonymity works' : 'কীভাবে বেনামী থাকে'}
        </Link>
        <Link
          href="/"
          className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {locale === 'en' ? '← Back to home' : '← হোমে ফিরুন'}
        </Link>
      </div>
    </main>
  )
}

/** Renders `inline code` segments in <code>; the policy names cookies and
 *  identifiers literally so readers can check them in their browser. */
function Inline({ children }: { children: string }) {
  const parts = children.split(/(`[^`]+`)/g)
  return (
    <span>
      {parts.map((p, i) =>
        p.startsWith('`') && p.endsWith('`') ? (
          <code key={i} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">
            {p.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  )
}
