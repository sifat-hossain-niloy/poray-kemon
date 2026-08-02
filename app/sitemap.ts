import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'
import { getAllPosts } from '@/lib/blog/posts'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://poraykemon.com'

// Regenerated on every request in prod (dynamic) so newly-added
// universities/professors show up in search engines within a crawl.
export const dynamic = 'force-dynamic'

// Every canonical URL is emitted once per locale. hreflang alternates point
// each localized URL at its siblings so Google can index /en and /bn as
// distinct-language versions of the same content.
function localized(
  path: string,
  extras: Omit<MetadataRoute.Sitemap[number], 'url' | 'alternates'>,
): MetadataRoute.Sitemap {
  const enUrl = `${SITE_URL}/en${path === '/' ? '' : path}`
  const bnUrl = `${SITE_URL}/bn${path === '/' ? '' : path}`
  const languages = { en: enUrl, bn: bnUrl, 'x-default': enUrl }
  return [
    { url: enUrl, alternates: { languages }, ...extras },
    { url: bnUrl, alternates: { languages }, ...extras },
  ]
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [universities, departments, professors] = await Promise.all([
    db.university.findMany({ select: { slug: true, createdAt: true } }),
    db.department.findMany({
      where: { slug: { not: null } },
      select: {
        slug: true,
        createdAt: true,
        university: { select: { slug: true } },
      },
    }),
    db.professor.findMany({
      where: {
        professorCourses: { some: { reviewCount: { gt: 0 } } },
      },
      select: { publicId: true, createdAt: true },
    }),
  ])

  const staticPages: MetadataRoute.Sitemap = [
    ...localized('/', { changeFrequency: 'daily', priority: 1.0 }),
    ...localized('/universities', { changeFrequency: 'weekly', priority: 0.9 }),
    ...localized('/professors', { changeFrequency: 'daily', priority: 0.9 }),
    ...localized('/reviews', { changeFrequency: 'daily', priority: 0.8 }),
    ...localized('/blog', { changeFrequency: 'weekly', priority: 0.7 }),
    ...localized('/faq', { changeFrequency: 'monthly', priority: 0.6 }),
    ...localized('/about', { changeFrequency: 'monthly', priority: 0.5 }),
    ...localized('/guidelines', { changeFrequency: 'monthly', priority: 0.5 }),
  ]

  const blogPosts = getAllPosts()
  const blogUrls: MetadataRoute.Sitemap = blogPosts.flatMap((p) =>
    localized(`/blog/${p.slug}`, {
      lastModified: new Date(p.publishedAt),
      changeFrequency: 'monthly',
      priority: 0.6,
    }),
  )

  const universityUrls: MetadataRoute.Sitemap = universities.flatMap((u) =>
    localized(`/universities/${u.slug}`, {
      lastModified: u.createdAt,
      changeFrequency: 'weekly',
      priority: 0.8,
    }),
  )

  const departmentUrls: MetadataRoute.Sitemap = departments
    .filter((d): d is typeof d & { slug: string } => d.slug !== null)
    .flatMap((d) =>
      localized(`/universities/${d.university.slug}/departments/${d.slug}`, {
        lastModified: d.createdAt,
        changeFrequency: 'weekly',
        priority: 0.7,
      }),
    )

  // Only include professors who have at least one review — an empty
  // professor page has no indexable content and dilutes the crawl budget.
  const professorUrls: MetadataRoute.Sitemap = professors.flatMap((p) =>
    localized(`/professors/${p.publicId}`, {
      lastModified: p.createdAt,
      changeFrequency: 'weekly',
      priority: 0.6,
    }),
  )

  return [...staticPages, ...blogUrls, ...universityUrls, ...departmentUrls, ...professorUrls]
}
