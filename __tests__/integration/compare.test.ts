import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { loadComparison } from '@/lib/compare-loader'
import { cleanDb, seedMinimal, type SeededRow } from '@/test/integration-helpers'

const KNOWN = new Set(['সহজলভ্য', 'বোর্ডে_বোঝান', 'উপস্থিতি_কড়া'])

describe('loadComparison', () => {
  let seeded: SeededRow
  let n = 0

  beforeEach(async () => {
    await cleanDb()
    seeded = await seedMinimal()
  })
  afterEach(async () => {
    await cleanDb()
  })

  async function professor(
    nameEn: string,
    courses: { reviewCount: number; teaching: number; grading: number; recommend: number }[],
  ) {
    n += 1
    const prof = await db.professor.create({
      data: { universityId: seeded.uniId, departmentId: seeded.deptId, nameEn, slug: `cmp-${n}` },
    })
    const pcs = []
    for (const [i, c] of courses.entries()) {
      const course = await db.course.create({
        data: { departmentId: seeded.deptId, courseCode: `CMP ${n}${i}`, courseName: `C${n}${i}` },
      })
      pcs.push(
        await db.professorCourse.create({
          data: {
            professorId: prof.id,
            courseId: course.id,
            reviewCount: c.reviewCount,
            avgTeachingQuality: c.teaching,
            avgGradingFairness: c.grading,
            avgCourseDifficulty: 3,
            avgAttendance: 3,
            wouldRecommendPct: c.recommend,
          },
        }),
      )
    }
    return { prof, pcs }
  }

  function tagged(pcId: number, tags: string[], status: 'visible' | 'hidden' = 'visible') {
    return db.review.create({
      data: {
        professorCourseId: pcId,
        teachingQuality: 4,
        gradingFairness: 4,
        courseDifficulty: 3,
        attendanceStrictness: 3,
        wouldRecommend: true,
        tags,
        status,
      },
    })
  }

  it('keeps the requested column order and drops unknown ids', async () => {
    const a = await professor('Alpha', [])
    const b = await professor('Beta', [])
    const out = await loadComparison([b.prof.publicId, 'ZZZZZZZZ', a.prof.publicId], KNOWN)
    expect(out.map((p) => p.publicId)).toEqual([b.prof.publicId, a.prof.publicId])
  })

  it('combines a professor across courses weighted by review count', async () => {
    const p = await professor('Weighted', [
      { reviewCount: 3, teaching: 5, grading: 5, recommend: 100 },
      { reviewCount: 1, teaching: 1, grading: 1, recommend: 0 },
    ])
    const [row] = await loadComparison([p.prof.publicId], KNOWN)
    expect(row?.stats.totalReviews).toBe(4)
    expect(row?.stats.avgTeachingQuality).toBeCloseTo(4, 5)
    expect(row?.stats.wouldRecommendPct).toBeCloseTo(75, 5)
  })

  it('returns top tags from visible reviews, known tags only', async () => {
    const p = await professor('Tagged', [
      { reviewCount: 3, teaching: 4, grading: 4, recommend: 100 },
    ])
    const pc = p.pcs[0]!
    await tagged(pc.id, ['সহজলভ্য', 'বোর্ডে_বোঝান'])
    await tagged(pc.id, ['সহজলভ্য', 'legacy-free-text'])
    await tagged(pc.id, ['উপস্থিতি_কড়া', 'উপস্থিতি_কড়া'], 'hidden')
    const [row] = await loadComparison([p.prof.publicId], KNOWN)
    expect(row?.topTags).toEqual(['সহজলভ্য', 'বোর্ডে_বোঝান'])
  })

  it('handles an unrated professor and an empty selection', async () => {
    const p = await professor('Unrated', [])
    const [row] = await loadComparison([p.prof.publicId], KNOWN)
    expect(row?.stats.overallScore).toBeNull()
    expect(row?.topTags).toEqual([])
    expect(await loadComparison([], KNOWN)).toEqual([])
  })
})
