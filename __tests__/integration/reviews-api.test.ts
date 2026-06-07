// ─────────────────────────────────────────────────────────────────────────────
// Integration tests for POST /api/reviews — the anonymity transaction.
//
// These hit the real test DB (port 5435 locally, 5433 in CI) and call the
// actual route handler. Redis + NextAuth are mocked by setup.integration.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { POST } from '@/app/api/reviews/route'
import { db } from '@/lib/db'
import {
  cleanDb,
  jsonPost,
  mockSession,
  mockUnauthenticated,
  seedMinimal,
  type SeededRow,
} from '@/test/integration-helpers'

const URL = 'http://localhost/api/reviews'

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    university_id: 1, // overwritten below from seed
    department_id: 1,
    professor_name_en: 'Dr. Mohammad Rahman',
    course_code: 'CSE 301',
    course_name: 'Data Structures',
    teaching_quality: 5,
    grading_fairness: 4,
    course_difficulty: 3,
    attendance_strictness: 4,
    would_recommend: true,
    review_text: 'Excellent teacher. Clear examples and fair grading throughout the term.',
    tags: ['বোর্ডে_বোঝান'],
    honeypot_field: '',
    ...overrides,
  }
}

describe('POST /api/reviews', () => {
  let seeded: SeededRow

  beforeEach(async () => {
    await cleanDb()
    seeded = await seedMinimal()
  })
  afterEach(async () => {
    await cleanDb()
  })

  // ── Auth gate ─────────────────────────────────────────────────────────────

  it('returns 401 when no session', async () => {
    mockUnauthenticated()
    const res = await POST(jsonPost(URL, validBody()))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('UNAUTHENTICATED')

    // No DB writes happened
    expect(await db.review.count()).toBe(0)
    expect(await db.reviewSubmission.count()).toBe(0)
  })

  // ── Happy path ───────────────────────────────────────────────────────────

  it('creates a review, a review_submissions row, and updates running averages', async () => {
    mockSession(seeded.user1Id)
    const res = await POST(
      jsonPost(URL, {
        ...validBody(),
        university_id: seeded.uniId,
        department_id: seeded.deptId,
      }),
    )
    expect(res.status).toBe(201)
    const body = (await res.json()) as { message: string; professor_slug: string }
    expect(body.professor_slug).toBeTruthy()

    // 1) Exactly one review
    const reviews = await db.review.findMany()
    expect(reviews).toHaveLength(1)
    expect(reviews[0]!.teachingQuality).toBe(5)
    expect(reviews[0]!.wouldRecommend).toBe(true)

    // 2) Exactly one review_submissions row, linked to THIS user
    const subs = await db.reviewSubmission.findMany()
    expect(subs).toHaveLength(1)
    expect(subs[0]!.userId).toBe(seeded.user1Id)

    // 3) professor_courses running averages updated, review_count = 1
    const pcs = await db.professorCourse.findMany()
    expect(pcs).toHaveLength(1)
    expect(pcs[0]!.reviewCount).toBe(1)
    expect(Number(pcs[0]!.avgTeachingQuality!.toString())).toBeCloseTo(5, 5)
    expect(Number(pcs[0]!.wouldRecommendPct!.toString())).toBeCloseTo(100, 5)
  })

  // ── The anonymity contract ───────────────────────────────────────────────

  it('reviews row has NO user_id column accessible — anonymity is structural', async () => {
    mockSession(seeded.user1Id)
    await POST(
      jsonPost(URL, {
        ...validBody(),
        university_id: seeded.uniId,
        department_id: seeded.deptId,
      }),
    )

    // Query the actual table — no userId field exists on the model OR the row
    const review = await db.review.findFirstOrThrow()
    // @ts-expect-error — userId must NOT exist on the Review type
    expect(review.userId).toBeUndefined()

    // No FK from reviews back to review_submissions either
    const cols = (await db.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'reviews'`,
    )) as Array<{ column_name: string }>
    const colNames = cols.map((c) => c.column_name)
    expect(colNames).not.toContain('user_id')
    expect(colNames).not.toContain('review_submission_id')
  })

  // ── Duplicate guard ──────────────────────────────────────────────────────

  it('rejects a duplicate review from the same user with 409', async () => {
    mockSession(seeded.user1Id)
    const body = {
      ...validBody(),
      university_id: seeded.uniId,
      department_id: seeded.deptId,
    }

    const first = await POST(jsonPost(URL, body))
    expect(first.status).toBe(201)

    const second = await POST(jsonPost(URL, body))
    expect(second.status).toBe(409)
    const j = await second.json()
    expect(j.code).toBe('ALREADY_REVIEWED')

    // Still only one review
    expect(await db.review.count()).toBe(1)
    expect(await db.reviewSubmission.count()).toBe(1)
  })

  it('allows two different users to review the same professor+course', async () => {
    const body = {
      ...validBody(),
      university_id: seeded.uniId,
      department_id: seeded.deptId,
    }

    mockSession(seeded.user1Id)
    expect((await POST(jsonPost(URL, body))).status).toBe(201)

    mockSession(seeded.user2Id)
    expect((await POST(jsonPost(URL, { ...body, teaching_quality: 3 }))).status).toBe(201)

    expect(await db.review.count()).toBe(2)

    // Running average should be (5+3)/2 = 4
    const pc = await db.professorCourse.findFirstOrThrow()
    expect(pc.reviewCount).toBe(2)
    expect(Number(pc.avgTeachingQuality!.toString())).toBeCloseTo(4, 5)
  })

  // ── Honeypot ──────────────────────────────────────────────────────────────

  it('rejects a bot submission via honeypot field with 400', async () => {
    mockSession(seeded.user1Id)
    const res = await POST(
      jsonPost(URL, {
        ...validBody(),
        university_id: seeded.uniId,
        department_id: seeded.deptId,
        honeypot_field: 'spam@example.com',
      }),
    )
    expect(res.status).toBe(400)
    expect(await db.review.count()).toBe(0)
  })

  // ── Moderation ────────────────────────────────────────────────────────────

  it('hard-blocks profanity with 400 and writes nothing', async () => {
    mockSession(seeded.user1Id)
    const res = await POST(
      jsonPost(URL, {
        ...validBody(),
        university_id: seeded.uniId,
        department_id: seeded.deptId,
        review_text: 'This professor is shit and everyone knows it for sure.',
      }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('MODERATION_HARD_BLOCK')
    expect(await db.review.count()).toBe(0)
    expect(await db.reviewSubmission.count()).toBe(0)
  })

  it('soft-flags ALL CAPS — review is written but moderation_status = soft_flagged', async () => {
    mockSession(seeded.user1Id)
    const res = await POST(
      jsonPost(URL, {
        ...validBody(),
        university_id: seeded.uniId,
        department_id: seeded.deptId,
        review_text: 'THIS COURSE WAS A COMPLETE WASTE OF TIME FROM START TO FINISH',
      }),
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.moderation_status).toBe('soft_flagged')

    const review = await db.review.findFirstOrThrow()
    expect(review.moderationStatus).toBe('soft_flagged')
    expect(review.moderationReason).toBe('all_caps')
  })

  // ── Validation ───────────────────────────────────────────────────────────

  it('rejects an out-of-range rating with 400', async () => {
    mockSession(seeded.user1Id)
    const res = await POST(
      jsonPost(URL, {
        ...validBody(),
        university_id: seeded.uniId,
        department_id: seeded.deptId,
        teaching_quality: 99,
      }),
    )
    expect(res.status).toBe(400)
    expect(await db.review.count()).toBe(0)
  })

  it('rejects when neither professor_id nor (uni+dept+name) provided', async () => {
    mockSession(seeded.user1Id)
    const res = await POST(
      jsonPost(URL, {
        // omit professor identifiers entirely
        course_name: 'Foo',
        teaching_quality: 5,
        grading_fairness: 5,
        course_difficulty: 5,
        attendance_strictness: 5,
        would_recommend: true,
        tags: [],
        honeypot_field: '',
      }),
    )
    expect(res.status).toBe(400)
    expect(await db.review.count()).toBe(0)
  })
})
