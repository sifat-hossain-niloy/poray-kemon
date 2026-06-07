// Integration tests for POST/GET /api/reviews/[id]/helpful — toggle behaviour.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GET, POST } from '@/app/api/reviews/[id]/helpful/route'
import { db } from '@/lib/db'
import {
  cleanDb,
  mockSession,
  mockUnauthenticated,
  seedMinimal,
  type SeededRow,
} from '@/test/integration-helpers'

// Helper: create one professor + course + review to vote on
async function createReview(seeded: SeededRow): Promise<number> {
  const prof = await db.professor.create({
    data: {
      universityId: seeded.uniId,
      departmentId: seeded.deptId,
      nameEn: 'Dr. Rahman',
      slug: 'dr-rahman',
    },
    select: { id: true },
  })
  const course = await db.course.create({
    data: {
      departmentId: seeded.deptId,
      courseCode: 'CSE 301',
      courseName: 'DS',
      slug: 'cse-301-ds',
    },
    select: { id: true },
  })
  const pc = await db.professorCourse.create({
    data: { professorId: prof.id, courseId: course.id },
    select: { id: true },
  })
  const review = await db.review.create({
    data: {
      professorCourseId: pc.id,
      teachingQuality: 5,
      gradingFairness: 4,
      courseDifficulty: 3,
      attendanceStrictness: 3,
      wouldRecommend: true,
    },
    select: { id: true },
  })
  return review.id
}

function ctx(id: number) {
  return { params: Promise.resolve({ id: String(id) }) }
}

describe('helpful voting API', () => {
  let seeded: SeededRow
  let reviewId: number

  beforeEach(async () => {
    await cleanDb()
    seeded = await seedMinimal()
    reviewId = await createReview(seeded)
  })
  afterEach(async () => {
    await cleanDb()
  })

  // ── GET (read state) ──────────────────────────────────────────────────────

  it('GET returns helpful_count + voted=false when no session', async () => {
    mockUnauthenticated()
    const res = await GET(new Request('http://x'), ctx(reviewId))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ helpful_count: 0, voted: false })
  })

  it('GET returns 404 for a non-existent review', async () => {
    mockUnauthenticated()
    const res = await GET(new Request('http://x'), ctx(99999))
    expect(res.status).toBe(404)
  })

  // ── POST (toggle) ─────────────────────────────────────────────────────────

  it('POST requires auth — returns 401', async () => {
    mockUnauthenticated()
    const res = await POST(new Request('http://x', { method: 'POST' }), ctx(reviewId))
    expect(res.status).toBe(401)
  })

  it('POST toggles ON: inserts a vote and increments counter', async () => {
    mockSession(seeded.user1Id)
    const res = await POST(new Request('http://x', { method: 'POST' }), ctx(reviewId))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ voted: true, helpful_count: 1 })

    const vote = await db.helpfulVote.findFirstOrThrow()
    expect(vote.userId).toBe(seeded.user1Id)

    const review = await db.review.findUniqueOrThrow({ where: { id: reviewId } })
    expect(review.helpfulCount).toBe(1)
  })

  it('POST toggles OFF on second call from the same user', async () => {
    mockSession(seeded.user1Id)
    await POST(new Request('http://x', { method: 'POST' }), ctx(reviewId)) // vote
    const res = await POST(new Request('http://x', { method: 'POST' }), ctx(reviewId)) // un-vote
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ voted: false, helpful_count: 0 })

    expect(await db.helpfulVote.count()).toBe(0)
    const review = await db.review.findUniqueOrThrow({ where: { id: reviewId } })
    expect(review.helpfulCount).toBe(0)
  })

  it('counter aggregates votes from different users', async () => {
    mockSession(seeded.user1Id)
    await POST(new Request('http://x', { method: 'POST' }), ctx(reviewId))
    mockSession(seeded.user2Id)
    await POST(new Request('http://x', { method: 'POST' }), ctx(reviewId))
    mockSession(seeded.user3Id)
    await POST(new Request('http://x', { method: 'POST' }), ctx(reviewId))

    const review = await db.review.findUniqueOrThrow({ where: { id: reviewId } })
    expect(review.helpfulCount).toBe(3)
    expect(await db.helpfulVote.count()).toBe(3)
  })

  it('POST on a missing review returns 404', async () => {
    mockSession(seeded.user1Id)
    const res = await POST(new Request('http://x', { method: 'POST' }), ctx(99999))
    expect(res.status).toBe(404)
  })

  it('rejects an invalid review id', async () => {
    mockSession(seeded.user1Id)
    const res = await POST(new Request('http://x', { method: 'POST' }), {
      params: Promise.resolve({ id: 'abc' }),
    })
    expect(res.status).toBe(400)
  })
})
