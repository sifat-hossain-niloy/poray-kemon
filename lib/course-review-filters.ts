// ─────────────────────────────────────────────────────────────────────────────
// Review filters on the professor+course page. URL-driven (plain links, no
// JS needed) and composable with the existing ?sort= and ?page= params.
// ─────────────────────────────────────────────────────────────────────────────

import type { Prisma } from '@prisma/client'

export type RecommendFilter = 'yes' | 'no'

export interface CourseReviewFilters {
  recommend: RecommendFilter | null
  /** Only reviews with written text. */
  withText: boolean
  tag: string | null
}

export const NO_FILTERS: CourseReviewFilters = { recommend: null, withText: false, tag: null }

type Raw = Record<string, string | string[] | undefined>
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)

/** Unknown values are dropped rather than rejected so shared links never 404. */
export function parseCourseReviewFilters(
  raw: Raw,
  knownTags: ReadonlySet<string>,
): CourseReviewFilters {
  const recommend = first(raw.recommend)
  const tag = first(raw.tag)
  return {
    recommend: recommend === 'yes' || recommend === 'no' ? recommend : null,
    withText: first(raw.text) === '1',
    tag: tag && knownTags.has(tag) ? tag : null,
  }
}

export function hasActiveFilters(f: CourseReviewFilters): boolean {
  return f.recommend !== null || f.withText || f.tag !== null
}

/** Query-string entries for the active filters (defaults omitted). */
export function filterParams(f: CourseReviewFilters): [string, string][] {
  const out: [string, string][] = []
  if (f.recommend) out.push(['recommend', f.recommend])
  if (f.withText) out.push(['text', '1'])
  if (f.tag) out.push(['tag', f.tag])
  return out
}

export function filterWhere(f: CourseReviewFilters): Prisma.ReviewWhereInput {
  return {
    ...(f.recommend ? { wouldRecommend: f.recommend === 'yes' } : {}),
    ...(f.withText ? { reviewText: { not: null } } : {}),
    ...(f.tag ? { tags: { has: f.tag } } : {}),
  }
}
