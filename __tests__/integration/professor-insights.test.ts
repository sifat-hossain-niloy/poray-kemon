// ─────────────────────────────────────────────────────────────────────────────
// Integration tests for lib/professor-insights.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { loadProfessorInsights } from '@/lib/professor-insights'
import { cleanDb, seedMinimal, type SeededRow } from '@/test/integration-helpers'

describe('loadProfessorInsights', () => {
  let seeded: SeededRow
  let pcA: number
  let pcB: number

  beforeEach(async () => {
    await cleanDb()
    seeded = await seedMinimal()
    const prof = await db.professor.create({
      data: {
        universityId: seeded.uniId,
        departmentId: seeded.deptId,
        nameEn: 'Insight Prof',
        slug: 'insight-prof',
      },
    })
    const [c1, c2] = await Promise.all([
      db.course.create({
        data: { departmentId: seeded.deptId, courseCode: 'IN 1', courseName: 'One' },
      }),
      db.course.create({
        data: { departmentId: seeded.deptId, courseCode: 'IN 2', courseName: 'Two' },
      }),
    ])
    pcA = (await db.professorCourse.create({ data: { professorId: prof.id, courseId: c1.id } })).id
    pcB = (await db.professorCourse.create({ data: { professorId: prof.id, courseId: c2.id } })).id
  })
  afterEach(async () => {
    await cleanDb()
  })

  function review(
    pcId: number,
    teaching: number,
    tags: string[],
    over: Partial<{
      status: 'visible' | 'hidden'
      moderationStatus: 'live' | 'soft_flagged' | 'flagged_hidden'
    }> = {},
  ) {
    return db.review.create({
      data: {
        professorCourseId: pcId,
        teachingQuality: teaching,
        gradingFairness: 3,
        courseDifficulty: 3,
        attendanceStrictness: 3,
        wouldRecommend: true,
        tags,
        ...over,
      },
    })
  }

  it('counts tags per course and in total, over counted reviews only', async () => {
    await review(pcA, 5, ['সহজলভ্য', 'বোর্ডে_বোঝান'])
    await review(pcA, 4, ['সহজলভ্য'])
    await review(pcB, 3, ['সহজলভ্য'], { moderationStatus: 'soft_flagged' })
    await review(pcB, 1, ['পক্ষপাতমূলক'], { status: 'hidden' })
    await review(pcB, 1, ['পক্ষপাতমূলক'], { moderationStatus: 'flagged_hidden' })

    const out = await loadProfessorInsights({
      professorCourseIds: [pcA, pcB],
      previewReviewIds: [],
      viewerId: null,
    })
    const totals = Object.fromEntries(out.professorTags.map((t) => [t.tag, t.count]))
    expect(totals).toEqual({ সহজলভ্য: 3, বোর্ডে_বোঝান: 1 })
    expect(out.tagsByCourse.get(pcB)).toEqual([{ tag: 'সহজলভ্য', count: 1 }])
  })

  it('builds the teaching-quality distribution from counted reviews', async () => {
    await review(pcA, 5, [])
    await review(pcA, 5, [])
    await review(pcB, 2, [])
    await review(pcB, 1, [], { status: 'hidden' })

    const { distribution } = await loadProfessorInsights({
      professorCourseIds: [pcA, pcB],
      previewReviewIds: [],
      viewerId: null,
    })
    expect(distribution.counts).toEqual([0, 1, 0, 0, 2])
    expect(distribution.total).toBe(3)
  })

  it("marks only the viewer's own reviewed courses and votes", async () => {
    const r = await review(pcA, 4, [])
    await db.reviewSubmission.create({ data: { userId: seeded.user1Id, professorCourseId: pcA } })
    await db.reviewSubmission.create({ data: { userId: seeded.user2Id, professorCourseId: pcB } })
    await db.helpfulVote.create({ data: { userId: seeded.user1Id, reviewId: r.id } })

    const mine = await loadProfessorInsights({
      professorCourseIds: [pcA, pcB],
      previewReviewIds: [r.id],
      viewerId: seeded.user1Id,
    })
    expect([...mine.reviewedCourseIds]).toEqual([pcA])
    expect([...mine.votedReviewIds]).toEqual([r.id])

    const anonymous = await loadProfessorInsights({
      professorCourseIds: [pcA, pcB],
      previewReviewIds: [r.id],
      viewerId: null,
    })
    expect(anonymous.reviewedCourseIds.size).toBe(0)
    expect(anonymous.votedReviewIds.size).toBe(0)
  })

  it('handles a professor with no courses', async () => {
    const out = await loadProfessorInsights({
      professorCourseIds: [],
      previewReviewIds: [],
      viewerId: seeded.user1Id,
    })
    expect(out.professorTags).toEqual([])
    expect(out.distribution.total).toBe(0)
  })
})
