// Integration tests for POST /api/reports — dedup + 3-strike auto-hide.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { POST } from '@/app/api/reports/route'
import { db } from '@/lib/db'
import {
  cleanDb,
  jsonPost,
  mockSession,
  mockUnauthenticated,
  seedMinimal,
  type SeededRow,
} from '@/test/integration-helpers'
import { __redisStore } from '@/test/setup.integration'
import { reportDedupKey } from '@/lib/reports'

const URL = 'http://localhost/api/reports'

async function createReview(seeded: SeededRow): Promise<number> {
  const prof = await db.professor.create({
    data: {
      universityId: seeded.uniId,
      departmentId: seeded.deptId,
      nameEn: 'Dr. X',
      slug: 'dr-x',
    },
    select: { id: true },
  })
  const course = await db.course.create({
    data: { departmentId: seeded.deptId, courseName: 'C', slug: 'c' },
    select: { id: true },
  })
  const pc = await db.professorCourse.create({
    data: { professorId: prof.id, courseId: course.id },
    select: { id: true },
  })
  const r = await db.review.create({
    data: {
      professorCourseId: pc.id,
      teachingQuality: 4,
      gradingFairness: 4,
      courseDifficulty: 4,
      attendanceStrictness: 4,
      wouldRecommend: true,
    },
    select: { id: true },
  })
  return r.id
}

describe('POST /api/reports', () => {
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

  // ── Auth + validation ────────────────────────────────────────────────────

  it('returns 401 when no session', async () => {
    mockUnauthenticated()
    const res = await POST(jsonPost(URL, { review_id: reviewId, reason: 'fake' }))
    expect(res.status).toBe(401)
    expect(await db.report.count()).toBe(0)
  })

  it('returns 400 on invalid reason', async () => {
    mockSession(seeded.user1Id)
    const res = await POST(jsonPost(URL, { review_id: reviewId, reason: 'lol' }))
    expect(res.status).toBe(400)
    expect(await db.report.count()).toBe(0)
  })

  it('returns 404 when the review does not exist', async () => {
    mockSession(seeded.user1Id)
    const res = await POST(jsonPost(URL, { review_id: 99999, reason: 'fake' }))
    expect(res.status).toBe(404)
  })

  // ── Happy path ───────────────────────────────────────────────────────────

  it('creates a report and sets a Redis dedup key', async () => {
    mockSession(seeded.user1Id)
    const res = await POST(
      jsonPost(URL, { review_id: reviewId, reason: 'fake', details: 'looks fake' }),
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.auto_hidden).toBe(false)

    const reports = await db.report.findMany()
    expect(reports).toHaveLength(1)
    expect(reports[0]!.reason).toBe('fake')
    expect(reports[0]!.details).toBe('looks fake')

    // Reports table has NO user_id — anonymity to admin too
    expect(Object.keys(reports[0]!)).not.toContain('userId')
    expect(Object.keys(reports[0]!)).not.toContain('user_id')

    // Redis dedup key was set
    expect(__redisStore.has(reportDedupKey(seeded.user1Id, reviewId))).toBe(true)
  })

  // ── Dedup ─────────────────────────────────────────────────────────────────

  it('idempotent: same user reporting twice does NOT create a second row', async () => {
    mockSession(seeded.user1Id)
    const first = await POST(jsonPost(URL, { review_id: reviewId, reason: 'fake' }))
    expect(first.status).toBe(201)

    const second = await POST(jsonPost(URL, { review_id: reviewId, reason: 'fake' }))
    expect(second.status).toBe(201) // idempotent, not 409
    expect(await db.report.count()).toBe(1)
  })

  // ── 3-strike auto-hide ───────────────────────────────────────────────────

  it('does NOT auto-hide on 2 reports', async () => {
    mockSession(seeded.user1Id)
    await POST(jsonPost(URL, { review_id: reviewId, reason: 'fake' }))
    mockSession(seeded.user2Id)
    await POST(jsonPost(URL, { review_id: reviewId, reason: 'offensive' }))

    const review = await db.review.findUniqueOrThrow({ where: { id: reviewId } })
    expect(review.moderationStatus).toBe('live')
  })

  it('auto-hides the review when the 3rd distinct user reports it', async () => {
    mockSession(seeded.user1Id)
    const r1 = await POST(jsonPost(URL, { review_id: reviewId, reason: 'fake' }))
    expect((await r1.json()).auto_hidden).toBe(false)

    mockSession(seeded.user2Id)
    const r2 = await POST(jsonPost(URL, { review_id: reviewId, reason: 'offensive' }))
    expect((await r2.json()).auto_hidden).toBe(false)

    mockSession(seeded.user3Id)
    const r3 = await POST(jsonPost(URL, { review_id: reviewId, reason: 'personal' }))
    const body = await r3.json()
    expect(body.auto_hidden).toBe(true)
    expect(body.threshold).toBe(3)

    const review = await db.review.findUniqueOrThrow({ where: { id: reviewId } })
    expect(review.moderationStatus).toBe('flagged_hidden')
    expect(await db.report.count()).toBe(3)
  })
})
