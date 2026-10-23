import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { loadSemesterTrend } from '@/lib/semester-trend'
import { cleanDb, seedMinimal } from '@/test/integration-helpers'

describe('loadSemesterTrend', () => {
  let pcId: number

  beforeEach(async () => {
    await cleanDb()
    const seeded = await seedMinimal()
    const prof = await db.professor.create({
      data: {
        universityId: seeded.uniId,
        departmentId: seeded.deptId,
        nameEn: 'Trend',
        slug: 'trend',
      },
    })
    const course = await db.course.create({
      data: { departmentId: seeded.deptId, courseCode: 'ST 1', courseName: 'Semester' },
    })
    pcId = (
      await db.professorCourse.create({ data: { professorId: prof.id, courseId: course.id } })
    ).id
  })
  afterEach(async () => {
    await cleanDb()
  })

  function review(
    teaching: number,
    term: 'spring' | 'summer' | 'fall' | null,
    year: number | null,
    status: 'visible' | 'hidden' = 'visible',
  ) {
    return db.review.create({
      data: {
        professorCourseId: pcId,
        teachingQuality: teaching,
        gradingFairness: 3,
        courseDifficulty: 3,
        attendanceStrictness: 3,
        wouldRecommend: true,
        semesterTerm: term,
        semesterYear: year,
        status,
      },
    })
  }

  it('averages teaching quality per semester in chronological order', async () => {
    await review(5, 'spring', 2026)
    await review(3, 'spring', 2026)
    await review(2, 'fall', 2025)
    await review(2, 'fall', 2025)
    const trend = await loadSemesterTrend([pcId])
    expect(trend).toEqual([
      { term: 'fall', year: 2025, count: 2, avgTeaching: 2 },
      { term: 'spring', year: 2026, count: 2, avgTeaching: 4 },
    ])
  })

  it('ignores hidden reviews, reviews without a semester and thin terms', async () => {
    await review(5, 'spring', 2026)
    await review(5, 'spring', 2026)
    await review(1, 'spring', 2026, 'hidden')
    await review(1, null, null)
    await review(1, 'fall', 2025)
    // Only one term qualifies → not a trend.
    expect(await loadSemesterTrend([pcId])).toEqual([])
  })

  it('rejects a term without a year at the database level', async () => {
    await expect(review(4, 'fall', null)).rejects.toThrow()
    await expect(review(4, null, 2025)).rejects.toThrow()
  })

  it('returns nothing for no courses', async () => {
    expect(await loadSemesterTrend([])).toEqual([])
  })
})
