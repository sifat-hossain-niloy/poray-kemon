import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://poraykemon.com'

// Allow the public catalog + read-only listings to be indexed. Disallow the
// admin surface, the API, and the review-submit form (nothing useful there
// for a crawler, and /review/new is auth-gated anyway).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/review/new', '/moderator/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
