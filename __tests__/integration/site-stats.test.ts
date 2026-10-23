import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { computeSiteStats } from '@/lib/site-stats'
import { cleanDb, seedMinimal, type SeededRow } from '@/test/integration-helpers'

describe('computeSiteStats (FR-STAT-03)', () => {
  let seeded: SeededRow

  beforeEach(async () => {
    await cleanDb()
    seeded = await seedMinimal()
  })
  afterEach(async () => {
    await cleanDb()
  })

  it('counts rated professors, reviewed courses and counted reviews only', async () => {
    const [rated, unrated] = await Promise.all(
      ['Rated', 'Unrated'].map((nameEn, i) =>
        db.professor.create({
          data: { universityId: seeded.uniId, departmentId: seeded.deptId, nameEn, slug: `s${i}` },
        }),
      ),
    )
    const [c1, c2, c3] = await Promise.all(
      ['SS 1', 'SS 2', 'SS 3'].map((code) =>
        db.course.create({
          data: { departmentId: seeded.deptId, courseCode: code, courseName: code },
        }),
      ),
    )
    const pc1 = await db.professorCourse.create({
      data: { professorId: rated!.id, courseId: c1!.id, reviewCount: 3 },
    })
    await db.professorCourse.create({
      data: { professorId: rated!.id, courseId: c2!.id, reviewCount: 1 },
    })
    // A pairing with no reviews makes neither the professor nor the course "rated".
    await db.professorCourse.create({
      data: { professorId: unrated!.id, courseId: c3!.id, reviewCount: 0 },
    })
    const review = (over: object) =>
      db.review.create({
        data: {
          professorCourseId: pc1.id,
          teachingQuality: 4,
          gradingFairness: 4,
          courseDifficulty: 3,
          attendanceStrictness: 3,
          wouldRecommend: true,
          ...over,
        },
      })
    await review({})
    await review({ moderationStatus: 'soft_flagged' })
    await review({ moderationStatus: 'flagged_hidden' })
    await review({ status: 'deleted', moderationStatus: 'deleted' })

    expect(await computeSiteStats()).toEqual({
      totalReviews: 2,
      professorsRated: 1,
      universitiesCovered: 1,
      coursesReviewed: 2,
    })
  })

  it('is all zeros on an empty catalog except universities', async () => {
    expect(await computeSiteStats()).toEqual({
      totalReviews: 0,
      professorsRated: 0,
      universitiesCovered: 1,
      coursesReviewed: 0,
    })
  })
})
