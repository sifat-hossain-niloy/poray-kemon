// ─────────────────────────────────────────────────────────────────────────────
// Department page listing controls (SRS §4.4 FR-SEARCH-05)
//
// Sort:   highest rated (default) · most reviewed · most recently reviewed
// Filter: course difficulty (easy / medium / hard) · would-recommend only
//
// Everything is driven by URL search params so the controls are plain links
// and work without JavaScript (NFR-UX-04). Parsing is forgiving: unknown
// values fall back to defaults instead of 400-ing a shared link.
// ─────────────────────────────────────────────────────────────────────────────

export type DepartmentSort = 'rating' | 'reviews' | 'recent'
export type DifficultyBucket = 'easy' | 'medium' | 'hard'
export type DepartmentView = 'professors' | 'courses'

export interface DepartmentListingParams {
  view: DepartmentView
  sort: DepartmentSort
  difficulty: DifficultyBucket | null
  recommendedOnly: boolean
}

export const DEFAULT_LISTING: DepartmentListingParams = {
  view: 'professors',
  sort: 'rating',
  difficulty: null,
  recommendedOnly: false,
}

/** A professor counts as "recommended" when at least half their reviewers
 *  said they'd recommend them. */
export const RECOMMEND_THRESHOLD_PCT = 50

type RawParams = Record<string, string | string[] | undefined>

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v
}

export function parseListingParams(raw: RawParams): DepartmentListingParams {
  const view = first(raw.view)
  const sort = first(raw.sort)
  const difficulty = first(raw.difficulty)
  return {
    view: view === 'courses' ? 'courses' : 'professors',
    sort: sort === 'reviews' || sort === 'recent' ? sort : 'rating',
    difficulty:
      difficulty === 'easy' || difficulty === 'medium' || difficulty === 'hard' ? difficulty : null,
    recommendedOnly: first(raw.recommended) === '1',
  }
}

/** Serialise back to a query string, omitting defaults so canonical links
 *  stay short (`?sort=reviews` rather than `?view=professors&sort=reviews…`). */
export function listingQuery(params: DepartmentListingParams): string {
  const qs = new URLSearchParams()
  if (params.view !== DEFAULT_LISTING.view) qs.set('view', params.view)
  if (params.sort !== DEFAULT_LISTING.sort) qs.set('sort', params.sort)
  if (params.difficulty) qs.set('difficulty', params.difficulty)
  if (params.recommendedOnly) qs.set('recommended', '1')
  const s = qs.toString()
  return s ? `?${s}` : ''
}

/** Thirds of the 1–5 scale. 1 = very easy, 5 = very hard. */
export function difficultyBucket(avg: number | null): DifficultyBucket | null {
  if (avg === null) return null
  if (avg < 2.5) return 'easy'
  if (avg < 3.5) return 'medium'
  return 'hard'
}

export interface ListableProfessor {
  overallScore: number | null
  totalReviews: number
  avgCourseDifficulty: number | null
  wouldRecommendPct: number | null
  lastReviewedAt: Date | null
}

export function applyListing<T extends ListableProfessor>(
  rows: T[],
  params: Pick<DepartmentListingParams, 'sort' | 'difficulty' | 'recommendedOnly'>,
): T[] {
  const filtered = rows.filter((r) => {
    if (params.difficulty && difficultyBucket(r.avgCourseDifficulty) !== params.difficulty) {
      return false
    }
    if (
      params.recommendedOnly &&
      (r.wouldRecommendPct === null || r.wouldRecommendPct < RECOMMEND_THRESHOLD_PCT)
    ) {
      return false
    }
    return true
  })

  const score = (r: T) => r.overallScore ?? -1
  const time = (r: T) => r.lastReviewedAt?.getTime() ?? -1
  const comparators: Record<DepartmentSort, (a: T, b: T) => number> = {
    rating: (a, b) => score(b) - score(a) || b.totalReviews - a.totalReviews,
    reviews: (a, b) => b.totalReviews - a.totalReviews || score(b) - score(a),
    recent: (a, b) => time(b) - time(a) || score(b) - score(a),
  }
  return [...filtered].sort(comparators[params.sort])
}
