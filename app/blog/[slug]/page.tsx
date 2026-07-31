import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAllSlugs, getPost, type BlockNode } from '@/lib/blog/posts'
import { getLocale } from '@/lib/i18n'

export const revalidate = 3600

interface PageProps {
  params: Promise<{ slug: string }>
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://poraykemon.com'

export async function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const post = getPost(slug)
  if (!post) return { title: 'Not found' }
  const canonical = `/blog/${post.slug}`
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical },
    openGraph: {
      title: post.title,
      description: post.description,
      url: canonical,
      type: 'article',
      publishedTime: post.publishedAt,
    },
    twitter: { card: 'summary_large_image', title: post.title, description: post.description },
  }
}

export default async function BlogPostPage({ params }: PageProps) {
  const [{ slug }, locale] = await Promise.all([params, getLocale()])
  const post = getPost(slug)
  if (!post) notFound()

  // BlogPosting JSON-LD — lets Google mark this as an article and use
  // the description as the SERP snippet when the title matches a query.
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
    author: { '@type': 'Organization', name: 'Poray Kemon' },
    publisher: { '@type': 'Organization', name: 'Poray Kemon' },
  }

  const readingLabel =
    locale === 'en' ? `${post.readingMinutes} min read` : `${post.readingMinutes} মিনিট পড়া`
  const backLabel = locale === 'en' ? '← All posts' : '← সব পোস্ট'

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mb-4">
        <Link
          href="/blog"
          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          {backLabel}
        </Link>
      </div>
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight leading-tight sm:text-4xl">
          {post.title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {post.publishedAt} · {readingLabel}
        </p>
      </header>

      <article className="space-y-5 text-[15px] leading-relaxed">
        {post.body.map((block, i) => (
          <Block key={i} node={block} />
        ))}
      </article>
    </main>
  )
}

function Block({ node }: { node: BlockNode }) {
  if (node.type === 'p') return <p>{node.text}</p>
  if (node.type === 'h2')
    return <h2 className="mt-8 text-xl font-semibold tracking-tight">{node.text}</h2>
  if (node.type === 'ul')
    return (
      <ul className="list-disc space-y-2 pl-5">
        {node.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    )
  if (node.type === 'quote')
    return (
      <blockquote className="border-l-4 border-primary/40 bg-muted/40 px-4 py-3 italic text-foreground/90">
        {node.text}
      </blockquote>
    )
  return null
}
