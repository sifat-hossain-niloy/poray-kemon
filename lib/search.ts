// ─────────────────────────────────────────────────────────────────────────────
// Search — pg_trgm fuzzy matching across universities, departments, professors.
//
// We use Prisma's $queryRaw so we can take advantage of:
//   - pg_trgm similarity() for typo-tolerant matching ("Rhman" → "Rahman")
//   - ILIKE for substring matching
//   - ranked SELECTs with UNION ALL
//
// Anonymity note: search never touches review_submissions. Professor hits
// are enriched with public aggregates (score, count, tags) only.
// ─────────────────────────────────────────────────────────────────────────────

import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { obfuscateName } from '@/lib/name-obfuscation'

export type SearchResultKind = 'university' | 'department' | 'professor'

export interface SearchResult {
  kind: SearchResultKind
  id: number
  slug: string
  title: string // e.g. "Dr. Mohammad Rahman" or "BUET"
  subtitle: string // e.g. "BUET · CSE" or "প্রকৌশল বিশ্ববিদ্যালয়"
  href: string
  score: number
  /** Professors only (SRS §4.4 FR-SEARCH-02). */
  stats?: ProfessorSearchStats
}

export interface ProfessorSearchStats {
  overallScore: number | null
  reviewCount: number
  /** Up to two most-used tag keys across counted reviews. */
  topTags: string[]
}

export const SEARCH_TOP_TAGS = 2

interface RawRow {
  kind: SearchResultKind
  id: number
  slug: string
  title: string
  subtitle: string
  score: number
}

/**
 * Search across universities, departments, and professors.
 * Returns combined, ranked results.
 *
 * @param query  Raw user input. Trimmed and lowercased before matching.
 * @param limit  Max total results across all kinds. Default 20.
 */
export async function search(query: string, limit = 20): Promise<SearchResult[]> {
  const q = query.trim()
  if (q.length < 2) return []

  // Lowercase pattern for ILIKE — Postgres ILIKE is already case-insensitive
  // but explicit % wildcards on both sides handle substring matches.
  const ilikePattern = `%${q}%`

  // Raw SQL — Prisma can't express UNION + similarity() + ILIKE in one query.
  // Parameterised via Prisma's tagged-template ($queryRaw escapes values).
  const rows = await db.$queryRaw<RawRow[]>`
    SELECT 'university' AS kind,
           u.id,
           u.slug,
           u.short_name AS title,
           COALESCE(u.name_bn, u.name_en) AS subtitle,
           GREATEST(
             similarity(u.short_name, ${q}),
             similarity(u.name_en, ${q}),
             COALESCE(similarity(u.name_bn, ${q}), 0)
           )::float AS score
      FROM universities u
     WHERE u.short_name ILIKE ${ilikePattern}
        OR u.name_en   ILIKE ${ilikePattern}
        OR u.name_bn   ILIKE ${ilikePattern}
        OR similarity(u.name_en, ${q})   > 0.3
        OR similarity(u.short_name, ${q}) > 0.3

    UNION ALL

    SELECT 'department' AS kind,
           d.id,
           -- The href builder below prepends /universities/, so this slug
           -- must include the intermediate /departments/ segment to match
           -- the actual route: /universities/{uni}/departments/{dept}.
           CONCAT(u.slug, '/departments/', d.slug) AS slug,
           -- Prefer the abbreviation when present (more recognisable),
           -- fall back to the full name when the dept has no short_name.
           CONCAT(u.short_name, ' · ', COALESCE(d.short_name, d.name_en)) AS title,
           d.name_en AS subtitle,
           GREATEST(
             COALESCE(similarity(d.short_name, ${q}), 0),
             similarity(d.name_en, ${q})
           )::float AS score
      FROM departments d
      JOIN universities u ON u.id = d.university_id
     WHERE d.short_name ILIKE ${ilikePattern}
        OR d.name_en   ILIKE ${ilikePattern}
        OR similarity(d.name_en, ${q})   > 0.3
        OR COALESCE(similarity(d.short_name, ${q}), 0) > 0.3

    UNION ALL

    SELECT 'professor' AS kind,
           p.id,
           -- URL identifier: professors use the opaque public_id, never the
           -- name-based slug (defamation safety — see lib/public-id.ts).
           p.public_id AS slug,
           p.name_en AS title,
           CONCAT(u.short_name, ' · ', COALESCE(d.short_name, d.name_en)) AS subtitle,
           GREATEST(
             similarity(p.name_en, ${q}),
             COALESCE(similarity(p.name_bn, ${q}), 0)
           )::float AS score
      FROM professors p
      JOIN universities u ON u.id = p.university_id
      JOIN departments  d ON d.id = p.department_id
     WHERE p.name_en ILIKE ${ilikePattern}
        OR p.name_bn ILIKE ${ilikePattern}
        OR similarity(p.name_en, ${q}) > 0.3

    ORDER BY score DESC
    LIMIT ${limit}
  `

  const professorIds = rows.filter((r) => r.kind === 'professor').map((r) => r.id)
  const stats = await professorSearchStats(professorIds)

  return rows.map((r) => ({
    kind: r.kind,
    id: r.id,
    slug: r.slug,
    // Obfuscate the professor title in public search results. University +
    // department titles pass through as-is — the substitution only applies
    // to English professor names (see lib/name-obfuscation.ts).
    title: r.kind === 'professor' ? obfuscateName(r.title) : r.title,
    subtitle: r.subtitle,
    score: r.score,
    href:
      r.kind === 'university'
        ? `/universities/${r.slug}`
        : r.kind === 'department'
          ? `/universities/${r.slug}` // already "uni-slug/dept-slug"
          : `/professors/${r.slug}`,
    ...(r.kind === 'professor'
      ? { stats: stats.get(r.id) ?? { overallScore: null, reviewCount: 0, topTags: [] } }
      : {}),
  }))
}

/** Score, review count and top tags for a page of professor hits — two
 *  queries regardless of how many professors matched. */
export async function professorSearchStats(
  professorIds: number[],
): Promise<Map<number, ProfessorSearchStats>> {
  const out = new Map<number, ProfessorSearchStats>()
  if (professorIds.length === 0) return out
  const ids = Prisma.join(professorIds)

  const [aggregates, tags] = await Promise.all([
    db.$queryRaw<Array<{ professor_id: number; review_count: number; overall: string | null }>>`
      SELECT professor_id,
             SUM(review_count)::int AS review_count,
             (SUM(overall_score * review_count) / NULLIF(SUM(review_count), 0))::text AS overall
        FROM professor_courses
       WHERE professor_id IN (${ids}) AND review_count > 0
       GROUP BY professor_id
    `,
    db.$queryRaw<Array<{ professor_id: number; tag: string }>>`
      SELECT professor_id, tag FROM (
        SELECT pc.professor_id, t.tag,
               ROW_NUMBER() OVER (
                 PARTITION BY pc.professor_id ORDER BY COUNT(*) DESC, t.tag
               ) AS rn
          FROM reviews r
          JOIN professor_courses pc ON pc.id = r.professor_course_id,
               unnest(r.tags) AS t(tag)
         WHERE pc.professor_id IN (${ids})
           AND r.status = 'visible'
           AND r.moderation_status IN ('live', 'soft_flagged')
         GROUP BY pc.professor_id, t.tag
      ) ranked
      WHERE rn <= ${SEARCH_TOP_TAGS}
      ORDER BY professor_id, rn
    `,
  ])

  for (const a of aggregates) {
    out.set(a.professor_id, {
      overallScore: a.overall === null ? null : Number(a.overall),
      reviewCount: a.review_count,
      topTags: [],
    })
  }
  for (const t of tags) {
    const entry = out.get(t.professor_id)
    if (entry) entry.topTags.push(t.tag)
  }
  return out
}
