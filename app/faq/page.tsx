import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale } from '@/lib/i18n'
import { FAQ_BN, FAQ_EN } from '@/lib/i18n/faq'
import { Card, CardContent } from '@/components/ui/card'

export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const content = locale === 'en' ? FAQ_EN : FAQ_BN
  const canonical = '/faq'
  return {
    title: content.title,
    description: content.intro,
    alternates: { canonical },
    openGraph: {
      title: content.title,
      description: content.intro,
      url: canonical,
      type: 'website',
    },
    twitter: { card: 'summary', title: content.title, description: content.intro },
  }
}

export default async function FaqPage() {
  const locale = await getLocale()
  const content = locale === 'en' ? FAQ_EN : FAQ_BN

  // FAQPage JSON-LD — lets Google render the "People also ask" style
  // expandable answers directly on the SERP tile.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: content.items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }

  const backLabel = locale === 'en' ? '← Back to home' : '← হোমে ফিরুন'
  const aboutLabel = locale === 'en' ? 'Read the anonymity contract →' : 'বেনামীয়তার চুক্তি →'

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight">{content.title}</h1>
        <p className="mt-3 text-muted-foreground">{content.intro}</p>
        <p className="mt-2 text-xs text-muted-foreground">{content.lastUpdated}</p>
      </header>

      <div className="space-y-4">
        {content.items.map((item, i) => (
          <Card key={i}>
            <CardContent className="py-5">
              <h2 className="text-base font-semibold leading-snug">{item.question}</h2>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">{item.answer}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-12 flex flex-col items-center gap-3">
        <Link
          href="/about"
          className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
        >
          {aboutLabel}
        </Link>
        <Link
          href="/"
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {backLabel}
        </Link>
      </div>
    </main>
  )
}
