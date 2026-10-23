// ─────────────────────────────────────────────────────────────────────────────
// Integration tests for lib/my-activity.ts — the data behind /me.
// The property that matters most: one account never sees another's links.
// ─────────────────────────────────────────────────────────────────────────────

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { isReviewRemoved, loadMyActivity } from '@/lib/my-activity'
import { cleanDb, seedMinimal, type SeededRow } from '@/test/integration-helpers'

async function professorCourse(seeded: SeededRow, profName: string, code: string) {
  const professor = await db.professor.create({
    data: {
      universityId: seeded.uniId,
      departmentId: seeded.deptId,
      nameEn: profName,
      slug: `${profName.toLowerCase().replace(/\W+/g, '-')}-${code}`,
    },
  })
  const course = await db.course.create({
    data: {
      departmentId: seeded.deptId,
      courseCode: code,
      courseName: `Course ${code}`,
      slug: code,
    },
  })
  return db.professorCourse.create({ data: { professorId: professor.id, courseId: course.id } })
}

async function review(
  pcId: number,
  over: Partial<{ status: 'visible' | 'hidden'; moderationStatus: 'live' | 'flagged_hidden' }> = {},
) {
  return db.review.create({
    data: {
      professorCourseId: pcId,
      teachingQuality: 4,
      gradingFairness: 4,
      courseDifficulty: 3,
      attendanceStrictness: 3,
      wouldRecommend: true,
      reviewText: 'Clear lectures and fair grading across the whole semester.',
      ...over,
    },
  })
}

describe('loadMyActivity', () => {
  let seeded: SeededRow

  beforeEach(async () => {
    await cleanDb()
    seeded = await seedMinimal()
  })
  afterEach(async () => {
    await cleanDb()
  })

  it('returns only the requesting account’s submissions, sorted by name', async () => {
    const pcZ = await professorCourse(seeded, 'Zakir Hossain', 'CSE101')
    const pcA = await professorCourse(seeded, 'Anisur Rahman', 'CSE102')
    const pcOther = await professorCourse(seeded, 'Bilkis Akter', 'CSE103')
    await db.reviewSubmission.createMany({
      data: [
        { userId: seeded.user1Id, professorCourseId: pcZ.id },
        { userId: seeded.user1Id, professorCourseId: pcA.id },
        { userId: seeded.user2Id, professorCourseId: pcOther.id },
      ],
    })

    const mine = await loadMyActivity(seeded.user1Id)
    expect(mine.reviewed.map((r) => r.course.courseCode)).toEqual(['CSE102', 'CSE101'])

    const theirs = await loadMyActivity(seeded.user2Id)
    expect(theirs.reviewed.map((r) => r.course.courseCode)).toEqual(['CSE103'])

    expect((await loadMyActivity(seeded.user3Id)).reviewed).toEqual([])
  })

  it('lists helpful votes newest first and masks removed reviews', async () => {
    const pc = await professorCourse(seeded, 'Anisur Rahman', 'CSE201')
    const live = await review(pc.id)
    const hidden = await review(pc.id, { status: 'hidden', moderationStatus: 'flagged_hidden' })
    await db.helpfulVote.create({
      data: { userId: seeded.user1Id, reviewId: live.id, createdAt: new Date('2026-01-01') },
    })
    await db.helpfulVote.create({
      data: { userId: seeded.user1Id, reviewId: hidden.id, createdAt: new Date('2026-02-01') },
    })
    await db.helpfulVote.create({ data: { userId: seeded.user2Id, reviewId: live.id } })

    const { helpful } = await loadMyActivity(seeded.user1Id)
    expect(helpful.map((h) => h.reviewId)).toEqual([hidden.id, live.id])
    expect(helpful[0]).toMatchObject({ removed: true, reviewText: null })
    expect(helpful[1]).toMatchObject({ removed: false })
    expect(helpful[1]?.reviewText).toContain('Clear lectures')
  })

  it('returns university requests with status and admin note', async () => {
    await db.universityRequest.create({
      data: { userId: seeded.user1Id, nameEn: 'Hill Tracts University', type: 'public' },
    })
    await db.universityRequest.create({
      data: {
        userId: seeded.user2Id,
        nameEn: 'Someone Else University',
        type: 'private',
        status: 'rejected',
        adminNote: 'Duplicate',
      },
    })
    const { requests } = await loadMyActivity(seeded.user1Id)
    expect(requests).toHaveLength(1)
    expect(requests[0]).toMatchObject({ nameEn: 'Hill Tracts University', status: 'pending' })
  })

  it('returns a null user for an unknown id instead of throwing', async () => {
    const out = await loadMyActivity('00000000-0000-4000-8000-000000000000')
    expect(out.user).toBeNull()
    expect(out.reviewed).toEqual([])
  })
})

describe('isReviewRemoved', () => {
  it('treats hidden status and hidden/deleted moderation as removed', () => {
    expect(isReviewRemoved({ status: 'visible', moderationStatus: 'live' })).toBe(false)
    expect(isReviewRemoved({ status: 'visible', moderationStatus: 'soft_flagged' })).toBe(false)
    expect(isReviewRemoved({ status: 'hidden', moderationStatus: 'live' })).toBe(true)
    expect(isReviewRemoved({ status: 'visible', moderationStatus: 'flagged_hidden' })).toBe(true)
    expect(isReviewRemoved({ status: 'visible', moderationStatus: 'deleted' })).toBe(true)
  })
})
