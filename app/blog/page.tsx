import type { Metadata } from 'next'
import { LocaleLink as Link } from '@/components/i18n/LocaleLink'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getAllPosts } from '@/lib/blog/posts'
import { getLocale } from '@/lib/i18n'
import { localeAlternates } from '@/lib/i18n/alternates'

export const revalidate = 3600

const TITLE = 'Blog | Poray Kemon'
const DESCRIPTION =
  'Short essays on how anonymous course reviews work, how to write a fair review, and what students can learn from real classroom feedback.'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  const alt = localeAlternates('/blog', locale)
  return {
    title: TITLE,
    description: DESCRIPTION,
    alternates: { canonical: alt.canonical, languages: alt.languages },
    openGraph: { title: TITLE, description: DESCRIPTION, url: alt.canonical, type: 'website' },
    twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
  }
}

export default async function BlogIndexPage() {
  const [posts, locale] = await Promise.all([getAllPosts(), getLocale()])

  const readingLabel = (n: number) => (locale === 'en' ? `${n} min read` : `${n} মিনিট পড়া`)
  const heading = locale === 'en' ? 'Blog' : 'ব্লগ'
  const subheading =
    locale === 'en'
      ? 'Notes on anonymous reviews, honest feedback, and the platform itself.'
      : 'বেনামী রিভিউ, সৎ ফিডব্যাক ও এই প্ল্যাটফর্ম সম্পর্কে টুকরো লেখা।'

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <header className="mb-10">
        <h1 className="text-4xl font-bold tracking-tight">{heading}</h1>
        <p className="mt-2 text-muted-foreground">{subheading}</p>
      </header>

      <div className="space-y-4">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
          >
            <Card className="h-full transition-colors group-hover:border-primary/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg leading-snug">{post.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-foreground/80 leading-relaxed">{post.description}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {post.publishedAt} · {readingLabel(post.readingMinutes)}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  )
}
