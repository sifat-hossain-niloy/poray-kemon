import type { Metadata } from 'next'
import { LocaleLink as Link } from '@/components/i18n/LocaleLink'
import { getLocale } from '@/lib/i18n'
import { ABOUT_BN, ABOUT_EN } from '@/lib/i18n/about'
import { Card, CardContent } from '@/components/ui/card'

// ISR — the about page changes rarely. Locale-keyed cache slot.
export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const content = locale === 'en' ? ABOUT_EN : ABOUT_BN
  return {
    title: content.title,
    description: content.mission.paragraphs[0]?.slice(0, 160),
  }
}

export default async function AboutPage() {
  const locale = await getLocale()
  const content = locale === 'en' ? ABOUT_EN : ABOUT_BN

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight">{content.title}</h1>
        <p className="mt-2 text-xs text-muted-foreground">{content.lastUpdated}</p>
      </header>

      <article className="space-y-8">
        <Section heading={content.mission.heading}>
          {content.mission.paragraphs.map((p, i) => (
            <p key={i} className="leading-relaxed">
              {p}
            </p>
          ))}
        </Section>

        <Section heading={content.anonymity.heading}>
          {content.anonymity.paragraphs.map((p, i) => (
            <p key={i} className="leading-relaxed">
              {p}
            </p>
          ))}
          <Card className="mt-3">
            <CardContent className="py-4">
              <ul className="space-y-2 text-sm">
                {content.anonymity.bullets.map((b, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden="true" className="select-none text-primary">
                      ✓
                    </span>
                    <Bullet>{b}</Bullet>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </Section>

        <Section heading={content.data.heading}>
          <ul className="space-y-2 text-sm">
            {content.data.bullets.map((b, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true" className="select-none text-muted-foreground">
                  •
                </span>
                <Bullet>{b}</Bullet>
              </li>
            ))}
          </ul>
        </Section>

        <Section heading={content.moderation.heading}>
          {content.moderation.paragraphs.map((p, i) => (
            <p key={i} className="leading-relaxed">
              {p}
            </p>
          ))}
        </Section>

        <Section heading={content.contact.heading}>
          {content.contact.paragraphs.map((p, i) => (
            <p key={i} className="leading-relaxed">
              {p}
            </p>
          ))}
        </Section>
      </article>

      <div className="mt-12 flex justify-center">
        <Link
          href="/"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {locale === 'en' ? '← Back to home' : '← হোমে ফিরুন'}
        </Link>
      </div>
    </main>
  )
}

function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
      <div className="space-y-2 text-sm text-foreground/90">{children}</div>
    </section>
  )
}

/**
 * Render text that may contain `inline code` segments highlighted with
 * <code>. Splits on backticks at runtime — keeps the source readable.
 */
function Bullet({ children }: { children: string }) {
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
