import type { MetadataRoute } from 'next'
import { db } from '@/lib/db'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://poraykemon.com'

// Regenerated on every request in prod (dynamic) so newly-added
// universities/professors show up in search engines within a crawl.
export const dynamic = 'force-dynamic'

// A single sitemap covers everything we want indexed today. If the
// catalog grows past ~40k URLs we should split into per-university
// sub-sitemaps and reference them from a sitemap index.
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
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/universities`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/professors`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/reviews`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/guidelines`, changeFrequency: 'monthly', priority: 0.5 },
  ]

  const universityUrls: MetadataRoute.Sitemap = universities.map((u) => ({
    url: `${SITE_URL}/universities/${u.slug}`,
    lastModified: u.createdAt,
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }))

  const departmentUrls: MetadataRoute.Sitemap = departments
    .filter((d): d is typeof d & { slug: string } => d.slug !== null)
    .map((d) => ({
      url: `${SITE_URL}/universities/${d.university.slug}/departments/${d.slug}`,
      lastModified: d.createdAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

  // Only include professors who have at least one review — an empty
  // professor page has no indexable content and dilutes the crawl budget.
  const professorUrls: MetadataRoute.Sitemap = professors.map((p) => ({
    url: `${SITE_URL}/professors/${p.publicId}`,
    lastModified: p.createdAt,
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }))

  return [...staticPages, ...universityUrls, ...departmentUrls, ...professorUrls]
}
