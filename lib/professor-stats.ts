// ─────────────────────────────────────────────────────────────────────────────
// Professor-level aggregate stats (SRS §4.6 FR-STAT-02)
//
// A professor with multiple courses gets a "combined" score at the top of
// their profile, weighted by review_count per course. This file owns the
// pure math so it can be unit-tested without a DB.
// ─────────────────────────────────────────────────────────────────────────────

/** One per-course aggregate. Numbers come straight from professor_courses. */
export interface CourseAggregate {
  reviewCount: number
  avgTeachingQuality: number | null
  avgGradingFairness: number | null
  avgCourseDifficulty: number | null
  avgAttendance: number | null
  wouldRecommendPct: number | null
  overallScore: number | null
}

export interface CombinedProfessorStats {
  totalReviews: number
  /** Number of distinct courses with at least one review. */
  coursesWithReviews: number
  avgTeachingQuality: number | null
  avgGradingFairness: number | null
  avgCourseDifficulty: number | null
  avgAttendance: number | null
  wouldRecommendPct: number | null
  /** Weighted overall score, mirrors the per-course overall_score formula. */
  overallScore: number | null
}

/**
 * Combine a professor's per-course aggregates into one weighted summary.
 * Weights are review_count, matching how the SRS describes the display
 * hierarchy.
 *
 * A course with 0 reviews contributes nothing. If the professor has 0
 * total reviews, all averages return null so the UI can render an empty
 * state instead of misleading zeros.
 */
export function combineProfessorStats(courses: CourseAggregate[]): CombinedProfessorStats {
  let totalReviews = 0
  let coursesWithReviews = 0
  let teachingNum = 0
  let gradingNum = 0
  let difficultyNum = 0
  let attendanceNum = 0
  let recommendNum = 0

  for (const c of courses) {
    if (c.reviewCount <= 0) continue
    coursesWithReviews += 1
    totalReviews += c.reviewCount
    teachingNum += (c.avgTeachingQuality ?? 0) * c.reviewCount
    gradingNum += (c.avgGradingFairness ?? 0) * c.reviewCount
    difficultyNum += (c.avgCourseDifficulty ?? 0) * c.reviewCount
    attendanceNum += (c.avgAttendance ?? 0) * c.reviewCount
    recommendNum += (c.wouldRecommendPct ?? 0) * c.reviewCount
  }

  if (totalReviews === 0) {
    return {
      totalReviews: 0,
      coursesWithReviews: 0,
      avgTeachingQuality: null,
      avgGradingFairness: null,
      avgCourseDifficulty: null,
      avgAttendance: null,
      wouldRecommendPct: null,
      overallScore: null,
    }
  }

  const avgTeaching = teachingNum / totalReviews
  const avgGrading = gradingNum / totalReviews
  const recommendPct = recommendNum / totalReviews

  // Same weights as `lib/aggregation.overallScore`:
  //   50% teaching, 30% grading, 20% recommendation (scaled to /5)
  const overall = avgTeaching * 0.5 + avgGrading * 0.3 + (recommendPct / 100) * 5 * 0.2

  return {
    totalReviews,
    coursesWithReviews,
    avgTeachingQuality: avgTeaching,
    avgGradingFairness: avgGrading,
    avgCourseDifficulty: difficultyNum / totalReviews,
    avgAttendance: attendanceNum / totalReviews,
    wouldRecommendPct: recommendPct,
    overallScore: overall,
  }
}
