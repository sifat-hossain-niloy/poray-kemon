// ─────────────────────────────────────────────────────────────────────────────
// Trending professors (SRS §10 Phase 2: "most reviewed in last 30 days").
// ─────────────────────────────────────────────────────────────────────────────

import { db } from '@/lib/db'
import { obfuscateName } from '@/lib/name-obfuscation'

export const TRENDING_WINDOW_DAYS = 30
export const TRENDING_LIMIT = 6

export interface TrendingEntry {
  publicId: string
  displayName: string
  universityShortName: string
  departmentLabel: string
  recentReviews: number
  overallScore: number | null
}

export async function computeTrending({
  windowDays = TRENDING_WINDOW_DAYS,
  limit = TRENDING_LIMIT,
}: { windowDays?: number; limit?: number } = {}): Promise<TrendingEntry[]> {
  // Only counted reviews (visible + live/soft_flagged) — a burst of
  // reports-and-hidden reviews must not push someone onto the homepage.
  // The score shown is the professor's all-time weighted overall, not the
  // window's, so a trending card never disagrees with the profile page.
  const rows = await db.$queryRaw<
    Array<{
      public_id: string
      name_en: string
      name_bn: string | null
      uni_short_name: string
      dept_short_name: string | null
      dept_name_en: string
      recent_reviews: number
      overall_score: string | null
    }>
  >`
    WITH recent AS (
      SELECT pc.professor_id, COUNT(*)::int AS recent_reviews, MAX(r.submitted_at) AS last_at
      FROM reviews r
      JOIN professor_courses pc ON pc.id = r.professor_course_id
      WHERE r.submitted_at > NOW() - make_interval(days => ${windowDays}::int)
        AND r.status = 'visible'
        AND r.moderation_status IN ('live', 'soft_flagged')
      GROUP BY pc.professor_id
      ORDER BY recent_reviews DESC, last_at DESC
      LIMIT ${limit}
    )
    SELECT p.public_id, p.name_en, p.name_bn,
           u.short_name AS uni_short_name,
           d.short_name AS dept_short_name, d.name_en AS dept_name_en,
           recent.recent_reviews,
           (SELECT SUM(pc2.overall_score * pc2.review_count) / NULLIF(SUM(pc2.review_count), 0)
              FROM professor_courses pc2
             WHERE pc2.professor_id = p.id AND pc2.review_count > 0)::text AS overall_score
    FROM recent
    JOIN professors p ON p.id = recent.professor_id
    JOIN universities u ON u.id = p.university_id
    JOIN departments d ON d.id = p.department_id
    ORDER BY recent.recent_reviews DESC, recent.last_at DESC
  `
  return rows.map((r) => ({
    publicId: r.public_id,
    displayName: r.name_bn ?? obfuscateName(r.name_en),
    universityShortName: r.uni_short_name,
    departmentLabel: r.dept_short_name ?? r.dept_name_en,
    recentReviews: r.recent_reviews,
    overallScore: r.overall_score === null ? null : Number(r.overall_score),
  }))
}
