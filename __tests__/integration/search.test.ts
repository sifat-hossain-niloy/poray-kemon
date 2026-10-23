import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { search } from '@/lib/search'
import { cleanDb, seedMinimal, type SeededRow } from '@/test/integration-helpers'

describe('search', () => {
  let seeded: SeededRow

  beforeEach(async () => {
    await cleanDb()
    seeded = await seedMinimal()
  })
  afterEach(async () => {
    await cleanDb()
  })

  async function professor(nameEn: string, departmentId = seeded.deptId) {
    return db.professor.create({
      data: {
        universityId: seeded.uniId,
        departmentId,
        nameEn,
        slug: nameEn.toLowerCase().replace(/\W+/g, '-'),
      },
    })
  }

  async function course(profId: number, code: string, agg: { n: number; overall: number }) {
    const c = await db.course.create({
      data: { departmentId: seeded.deptId, courseCode: code, courseName: code },
    })
    return db.professorCourse.create({
      data: { professorId: profId, courseId: c.id, reviewCount: agg.n, overallScore: agg.overall },
    })
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

  it('attaches weighted score, review count and top two tags to professor hits', async () => {
    const p = await professor('Mahbub Rahman')
    const a = await course(p.id, 'SR 1', { n: 3, overall: 4 })
    await course(p.id, 'SR 2', { n: 1, overall: 2 })
    await tagged(a.id, ['সহজলভ্য', 'বোর্ডে_বোঝান'])
    await tagged(a.id, ['সহজলভ্য', 'উপস্থিতি_কড়া'])
    await tagged(a.id, ['উপস্থিতি_কড়া'])
    await tagged(a.id, ['পক্ষপাতমূলক', 'পক্ষপাতমূলক', 'পক্ষপাতমূলক'], 'hidden')

    const [hit] = (await search('Mahbub')).filter((r) => r.kind === 'professor')
    expect(hit?.stats?.reviewCount).toBe(4)
    expect(hit?.stats?.overallScore).toBeCloseTo(3.5, 5)
    // Ties broken alphabetically; hidden reviews never contribute.
    expect(hit?.stats?.topTags).toEqual(['উপস্থিতি_কড়া', 'সহজলভ্য'])
  })

  it('gives unreviewed professors an empty stats block, and other kinds none', async () => {
    await professor('Test Unreviewed')
    const results = await search('Test')
    const prof = results.find((r) => r.kind === 'professor')
    const uni = results.find((r) => r.kind === 'university')
    expect(prof?.stats).toEqual({ overallScore: null, reviewCount: 0, topTags: [] })
    expect(uni).toBeDefined()
    expect(uni?.stats).toBeUndefined()
  })

  it('falls back to the department name when it has no short name', async () => {
    const dept = await db.department.create({
      data: { universityId: seeded.uniId, nameEn: 'Peace and Conflict Studies', slug: 'pacs' },
    })
    await professor('Nusrat Jahan', dept.id)
    const [hit] = (await search('Nusrat')).filter((r) => r.kind === 'professor')
    expect(hit?.subtitle).toBe('TU · Peace and Conflict Studies')
  })
})
