import { describe, it, expect } from 'vitest'
import { combineProfessorStats, type CourseAggregate } from '@/lib/professor-stats'

function makeCourse(over: Partial<CourseAggregate> = {}): CourseAggregate {
  return {
    reviewCount: 0,
    avgTeachingQuality: null,
    avgGradingFairness: null,
    avgCourseDifficulty: null,
    avgAttendance: null,
    wouldRecommendPct: null,
    overallScore: null,
    ...over,
  }
}

describe('combineProfessorStats', () => {
  it('returns all-nulls for a professor with no reviews', () => {
    const out = combineProfessorStats([])
    expect(out.totalReviews).toBe(0)
    expect(out.coursesWithReviews).toBe(0)
    expect(out.overallScore).toBeNull()
    expect(out.avgTeachingQuality).toBeNull()
  })

  it('ignores courses with 0 reviews when combining', () => {
    const out = combineProfessorStats([
      makeCourse(),
      makeCourse({
        reviewCount: 4,
        avgTeachingQuality: 5,
        avgGradingFairness: 4,
        avgCourseDifficulty: 3,
        avgAttendance: 2,
        wouldRecommendPct: 100,
      }),
    ])
    expect(out.totalReviews).toBe(4)
    expect(out.coursesWithReviews).toBe(1)
    expect(out.avgTeachingQuality).toBe(5)
  })

  it('weights averages by review_count across courses', () => {
    // Course A: 1 review, teaching=5
    // Course B: 4 reviews, teaching=2
    // Weighted teaching = (5*1 + 2*4) / 5 = 2.6
    const out = combineProfessorStats([
      makeCourse({
        reviewCount: 1,
        avgTeachingQuality: 5,
        avgGradingFairness: 5,
        avgCourseDifficulty: 5,
        avgAttendance: 5,
        wouldRecommendPct: 100,
      }),
      makeCourse({
        reviewCount: 4,
        avgTeachingQuality: 2,
        avgGradingFairness: 1,
        avgCourseDifficulty: 4,
        avgAttendance: 3,
        wouldRecommendPct: 25,
      }),
    ])
    expect(out.totalReviews).toBe(5)
    expect(out.coursesWithReviews).toBe(2)
    expect(out.avgTeachingQuality).toBeCloseTo(2.6, 10)
    expect(out.avgGradingFairness).toBeCloseTo(1.8, 10)
    expect(out.wouldRecommendPct).toBeCloseTo(40, 10)
  })

  it('produces an overallScore consistent with the per-review weights', () => {
    const out = combineProfessorStats([
      makeCourse({
        reviewCount: 2,
        avgTeachingQuality: 4,
        avgGradingFairness: 3,
        avgCourseDifficulty: 3,
        avgAttendance: 2,
        wouldRecommendPct: 50,
      }),
    ])
    // 4*0.5 + 3*0.3 + (50/100)*5*0.2 = 2 + 0.9 + 0.5 = 3.4
    expect(out.overallScore).toBeCloseTo(3.4, 10)
  })

  it('treats null aggregates as 0 contribution (defensive)', () => {
    const out = combineProfessorStats([
      makeCourse({
        reviewCount: 3,
        // nulls everywhere — shouldn't NaN
      }),
    ])
    expect(out.totalReviews).toBe(3)
    expect(out.avgTeachingQuality).toBe(0)
    expect(out.overallScore).toBe(0)
  })
})
