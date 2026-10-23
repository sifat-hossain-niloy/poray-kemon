// ─────────────────────────────────────────────────────────────────────────────
// University-level rollups (SRS §4.4 FR-SEARCH-04, §4.6 FR-STAT-04)
//
// The university page needs two views over the same professor_courses rows:
//   - per-department review count + weighted score
//   - the top N professors at the university
// Both are derived in JS from one query so the page costs a single round
// trip, and the maths lives here so it can be unit-tested without a DB.
// ─────────────────────────────────────────────────────────────────────────────

import { combineProfessorStats, type CourseAggregate } from './professor-stats'

/** One professor_courses row, flattened with the owning professor's ids. */
export interface UniversityCourseRow extends CourseAggregate {
  professorId: number
  departmentId: number
}

export interface DepartmentRollup {
  departmentId: number
  totalReviews: number
  /** Distinct professors with at least one review in this department. */
  ratedProfessors: number
  overallScore: number | null
}

export interface ProfessorRollup {
  professorId: number
  departmentId: number
  totalReviews: number
  overallScore: number
  wouldRecommendPct: number | null
}

/** Same floor as the homepage leaderboard: one glowing review shouldn't
 *  park a professor at the top of their university. */
export const TOP_PROFESSORS_MIN_REVIEWS = 3

function groupBy<K, V>(rows: V[], key: (row: V) => K): Map<K, V[]> {
  const out = new Map<K, V[]>()
  for (const row of rows) {
    const k = key(row)
    const bucket = out.get(k)
    if (bucket) bucket.push(row)
    else out.set(k, [row])
  }
  return out
}

export function rollupDepartments(rows: UniversityCourseRow[]): Map<number, DepartmentRollup> {
  const out = new Map<number, DepartmentRollup>()
  for (const [departmentId, deptRows] of groupBy(rows, (r) => r.departmentId)) {
    const combined = combineProfessorStats(deptRows)
    const rated = new Set(deptRows.filter((r) => r.reviewCount > 0).map((r) => r.professorId))
    out.set(departmentId, {
      departmentId,
      totalReviews: combined.totalReviews,
      ratedProfessors: rated.size,
      overallScore: combined.overallScore,
    })
  }
  return out
}

/** Highest weighted score first; review count breaks ties so the score
 *  backed by more evidence wins. */
export function topProfessors(
  rows: UniversityCourseRow[],
  limit: number,
  minReviews = TOP_PROFESSORS_MIN_REVIEWS,
): ProfessorRollup[] {
  const ranked: ProfessorRollup[] = []
  for (const [professorId, profRows] of groupBy(rows, (r) => r.professorId)) {
    const combined = combineProfessorStats(profRows)
    if (combined.overallScore === null || combined.totalReviews < minReviews) continue
    const first = profRows[0]
    if (!first) continue
    ranked.push({
      professorId,
      departmentId: first.departmentId,
      totalReviews: combined.totalReviews,
      overallScore: combined.overallScore,
      wouldRecommendPct: combined.wouldRecommendPct,
    })
  }
  ranked.sort((a, b) => b.overallScore - a.overallScore || b.totalReviews - a.totalReviews)
  return ranked.slice(0, limit)
}

/** Whole-university summary for the header strip. */
export function rollupUniversity(rows: UniversityCourseRow[]) {
  const combined = combineProfessorStats(rows)
  const rated = new Set(rows.filter((r) => r.reviewCount > 0).map((r) => r.professorId))
  return {
    totalReviews: combined.totalReviews,
    ratedProfessors: rated.size,
    overallScore: combined.overallScore,
    wouldRecommendPct: combined.wouldRecommendPct,
  }
}
