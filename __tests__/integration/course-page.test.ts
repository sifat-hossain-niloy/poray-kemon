import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { loadCourseAlternatives } from '@/lib/course-alternatives'
import { filterWhere } from '@/lib/course-review-filters'
import { obfuscateName } from '@/lib/name-obfuscation'
import { cleanDb, seedMinimal, type SeededRow } from '@/test/integration-helpers'

describe('course page data', () => {
  let seeded: SeededRow
  let courseId: number
  let n = 0

  beforeEach(async () => {
    await cleanDb()
    seeded = await seedMinimal()
    courseId = (
      await db.course.create({
        data: { departmentId: seeded.deptId, courseCode: 'CP 1', courseName: 'Course Page' },
      })
    ).id
  })
  afterEach(async () => {
    await cleanDb()
  })

  async function teacher(
    nameEn: string,
    agg?: { n: number; overall: number },
    onCourse = courseId,
  ) {
    n += 1
    const prof = await db.professor.create({
      data: { universityId: seeded.uniId, departmentId: seeded.deptId, nameEn, slug: `cp-${n}` },
    })
    const pc = await db.professorCourse.create({
      data: {
        professorId: prof.id,
        courseId: onCourse,
        reviewCount: agg?.n ?? 0,
        overallScore: agg?.overall ?? null,
        wouldRecommendPct: agg ? 80 : null,
      },
    })
    return { prof, pc }
  }

  it('lists other teachers of the same course, best rated first, unrated last', async () => {
    const me = await teacher('Me', { n: 5, overall: 3 })
    await teacher('Unrated')
    await teacher('Good', { n: 2, overall: 4.5 })
    await teacher('Better evidence', { n: 9, overall: 4.5 })
    const otherCourse = await db.course.create({
      data: { departmentId: seeded.deptId, courseCode: 'CP 2', courseName: 'Other' },
    })
    await teacher('Different course', { n: 9, overall: 5 }, otherCourse.id)

    const alts = await loadCourseAlternatives(courseId, me.prof.id)
    expect(alts.map((a) => a.displayName)).toEqual(
      ['Better evidence', 'Good', 'Unrated'].map(obfuscateName),
    )
    expect(alts[2]).toMatchObject({ overallScore: null, wouldRecommendPct: null, reviewCount: 0 })
  })

  it('filters reviews by recommendation, written text and tag in Postgres', async () => {
    const { pc } = await teacher('Filtered', { n: 3, overall: 4 })
    const make = (wouldRecommend: boolean, reviewText: string | null, tags: string[]) =>
      db.review.create({
        data: {
          professorCourseId: pc.id,
          teachingQuality: 4,
          gradingFairness: 4,
          courseDifficulty: 3,
          attendanceStrictness: 3,
          wouldRecommend,
          reviewText,
          tags,
        },
      })
    const a = await make(true, 'Wonderful explanations every single week of the term.', ['সহজলভ্য'])
    const b = await make(false, null, ['সহজলভ্য', 'নম্বরে_কঞ্জুস'])
    const c = await make(true, null, [])

    const ids = async (f: Parameters<typeof filterWhere>[0]) =>
      (
        await db.review.findMany({
          where: { professorCourseId: pc.id, ...filterWhere(f) },
          orderBy: { id: 'asc' },
        })
      ).map((r) => r.id)

    expect(await ids({ recommend: 'yes', withText: false, tag: null })).toEqual([a.id, c.id])
    expect(await ids({ recommend: null, withText: true, tag: null })).toEqual([a.id])
    expect(await ids({ recommend: null, withText: false, tag: 'সহজলভ্য' })).toEqual([a.id, b.id])
    expect(await ids({ recommend: 'no', withText: false, tag: 'সহজলভ্য' })).toEqual([b.id])
  })
})
