// ─────────────────────────────────────────────────────────────────────────────
// Search — pg_trgm fuzzy matching across universities, departments, professors.
//
// We use Prisma's $queryRaw so we can take advantage of:
//   - pg_trgm similarity() for typo-tolerant matching ("Rhman" → "Rahman")
//   - ILIKE for substring matching
//   - ranked SELECTs with UNION ALL
//
// Anonymity note: search never touches reviews/review_submissions, so no risk.
// ─────────────────────────────────────────────────────────────────────────────

import { db } from '@/lib/db'

export type SearchResultKind = 'university' | 'department' | 'professor'

export interface SearchResult {
  kind: SearchResultKind
  id: number
  slug: string
  title: string // e.g. "Dr. Mohammad Rahman" or "BUET"
  subtitle: string // e.g. "BUET · CSE" or "প্রকৌশল বিশ্ববিদ্যালয়"
  href: string
  score: number
}

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
           CONCAT(u.slug, '/', d.slug) AS slug,
           CONCAT(u.short_name, ' · ', d.short_name) AS title,
           d.name_en AS subtitle,
           GREATEST(
             similarity(d.short_name, ${q}),
             similarity(d.name_en, ${q})
           )::float AS score
      FROM departments d
      JOIN universities u ON u.id = d.university_id
     WHERE d.short_name ILIKE ${ilikePattern}
        OR d.name_en   ILIKE ${ilikePattern}
        OR similarity(d.name_en, ${q})   > 0.3
        OR similarity(d.short_name, ${q}) > 0.3

    UNION ALL

    SELECT 'professor' AS kind,
           p.id,
           p.slug,
           p.name_en AS title,
           CONCAT(u.short_name, ' · ', d.short_name) AS subtitle,
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

  return rows.map((r) => ({
    kind: r.kind,
    id: r.id,
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle,
    score: r.score,
    href:
      r.kind === 'university'
        ? `/universities/${r.slug}`
        : r.kind === 'department'
          ? `/universities/${r.slug}` // already "uni-slug/dept-slug"
          : `/professors/${r.slug}`,
  }))
}
