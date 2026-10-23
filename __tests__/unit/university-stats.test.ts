import { describe, it, expect } from 'vitest'
import {
  rollupDepartments,
  rollupUniversity,
  topProfessors,
  type UniversityCourseRow,
} from '@/lib/university-stats'

function row(over: Partial<UniversityCourseRow>): UniversityCourseRow {
  return {
    professorId: 1,
    departmentId: 10,
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

const rated = (over: Partial<UniversityCourseRow>) =>
  row({
    reviewCount: 4,
    avgTeachingQuality: 4,
    avgGradingFairness: 4,
    avgCourseDifficulty: 3,
    avgAttendance: 3,
    wouldRecommendPct: 100,
    ...over,
  })

describe('rollupDepartments', () => {
  it('weights department scores by review count across professors', () => {
    const out = rollupDepartments([
      rated({ professorId: 1, reviewCount: 3, avgTeachingQuality: 5, avgGradingFairness: 5 }),
      rated({ professorId: 2, reviewCount: 1, avgTeachingQuality: 1, avgGradingFairness: 1 }),
    ])
    const dept = out.get(10)
    expect(dept?.totalReviews).toBe(4)
    expect(dept?.ratedProfessors).toBe(2)
    // teaching 4, grading 4, recommend 100% → 4*0.5 + 4*0.3 + 5*0.2
    expect(dept?.overallScore).toBeCloseTo(4.2, 5)
  })

  it('counts a professor with several courses once', () => {
    const out = rollupDepartments([
      rated({ professorId: 1 }),
      rated({ professorId: 1 }),
      row({ professorId: 2 }),
    ])
    expect(out.get(10)?.ratedProfessors).toBe(1)
  })

  it('reports a null score for departments whose rows have no reviews', () => {
    const out = rollupDepartments([row({ departmentId: 11 })])
    expect(out.get(11)?.overallScore).toBeNull()
    expect(out.get(11)?.totalReviews).toBe(0)
  })
})

describe('topProfessors', () => {
  it('drops professors below the review floor', () => {
    const out = topProfessors([rated({ professorId: 1, reviewCount: 2 })], 5)
    expect(out).toHaveLength(0)
  })

  it('combines a professor across courses before applying the floor', () => {
    const out = topProfessors(
      [rated({ professorId: 1, reviewCount: 2 }), rated({ professorId: 1, reviewCount: 1 })],
      5,
    )
    expect(out).toHaveLength(1)
    expect(out[0]?.totalReviews).toBe(3)
  })

  it('sorts by score, then review count, and respects the limit', () => {
    const out = topProfessors(
      [
        rated({ professorId: 1, avgTeachingQuality: 3 }),
        rated({ professorId: 2, avgTeachingQuality: 5 }),
        rated({ professorId: 3, avgTeachingQuality: 5, reviewCount: 9 }),
        rated({ professorId: 4, avgTeachingQuality: 2 }),
      ],
      3,
    )
    expect(out.map((p) => p.professorId)).toEqual([3, 2, 1])
  })
})

describe('rollupUniversity', () => {
  it('summarises every row and counts distinct rated professors', () => {
    const out = rollupUniversity([
      rated({ professorId: 1, departmentId: 10 }),
      rated({ professorId: 2, departmentId: 11 }),
      row({ professorId: 3, departmentId: 11 }),
    ])
    expect(out.totalReviews).toBe(8)
    expect(out.ratedProfessors).toBe(2)
    expect(out.wouldRecommendPct).toBe(100)
  })
})
