// ─────────────────────────────────────────────────────────────────────────────
// Homepage site-wide stats (SRS §4.6 FR-STAT-03): total reviews, professors
// rated, universities covered, courses reviewed.
//
// "Reviews" uses the same counted set as the aggregates (visible +
// live/soft_flagged) so the headline number agrees with every score on the
// site. "Rated" / "reviewed" mean at least one counted review.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from '@/lib/db'
import { getCache, setCache, CACHE_KEYS, CACHE_TTL } from '@/lib/redis'

export interface SiteStats {
  totalReviews: number
  professorsRated: number
  universitiesCovered: number
  coursesReviewed: number
}

export async function computeSiteStats(): Promise<SiteStats> {
  const [totalReviews, professorsRated, universitiesCovered, coursesReviewed] = await Promise.all([
    db.review.count({
      where: { status: 'visible', moderationStatus: { in: ['live', 'soft_flagged'] } },
    }),
    db.professor.count({ where: { professorCourses: { some: { reviewCount: { gt: 0 } } } } }),
    db.university.count(),
    db.course.count({ where: { professorCourses: { some: { reviewCount: { gt: 0 } } } } }),
  ])
  return { totalReviews, professorsRated, universitiesCovered, coursesReviewed }
}

export async function getSiteStats(): Promise<SiteStats> {
  const cached = await getCache<SiteStats>(CACHE_KEYS.siteStats)
  if (cached) return cached
  const stats = await computeSiteStats()
  await setCache(CACHE_KEYS.siteStats, stats, CACHE_TTL.siteStats)
  return stats
}
