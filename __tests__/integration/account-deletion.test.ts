// ─────────────────────────────────────────────────────────────────────────────
// Integration tests for DELETE /api/me — self-serve account deletion.
//
// The two properties that matter:
//   * deleting an account must not reopen the one-review-per-course guard for
//     the same Google account (tombstones), and
//   * the per-account abuse limits (daily review quota, report dedup) follow
//     the Google sub, so delete + re-sign-in doesn't reset them, and
//   * nothing written on deletion can be joined back to `reviews`.
// ─────────────────────────────────────────────────────────────────────────────

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DELETE } from '@/app/api/me/route'
import { POST as postReview } from '@/app/api/reviews/route'
import { POST as toggleHelpful } from '@/app/api/reviews/[id]/helpful/route'
import { POST as postReport } from '@/app/api/reports/route'
import { db } from '@/lib/db'
import { tombstoneKey } from '@/lib/account-tombstone'
import { REVIEWS_PER_DAY } from '@/lib/rate-limit'
import { __redisStore } from '@/test/setup.integration'
import {
  cleanDb,
  jsonPost,
  mockSession,
  mockUnauthenticated,
  seedMinimal,
  type SeededRow,
} from '@/test/integration-helpers'

const SECRET = process.env.ACCOUNT_TOMBSTONE_SECRET!

function deleteRequest(body: unknown = { confirm: true }): Request {
  return new Request('http://localhost/api/me', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('DELETE /api/me', () => {
  let seeded: SeededRow

  async function review(userId: string, courseCode: string): Promise<Response> {
    mockSession(userId)
    return postReview(
      jsonPost('http://localhost/api/reviews', {
        university_id: seeded.uniId,
        department_id: seeded.deptId,
        professor_name_en: 'Dr. Mohammad Rahman',
        course_code: courseCode,
        course_name: `Course ${courseCode}`,
        teaching_quality: 5,
        grading_fairness: 4,
        course_difficulty: 3,
        attendance_strictness: 4,
        would_recommend: true,
        review_text: 'Clear lectures, fair grading and useful feedback on every assignment.',
        tags: [],
        honeypot_field: '',
      }),
    )
  }

  async function vote(userId: string, reviewId: number): Promise<void> {
    mockSession(userId)
    const res = await toggleHelpful(new Request('http://localhost', { method: 'POST' }), {
      params: Promise.resolve({ id: String(reviewId) }),
    })
    expect(res.status).toBe(200)
  }

  async function deleteAccount(userId: string): Promise<Response> {
    mockSession(userId)
    return DELETE(deleteRequest())
  }

  /** What the NextAuth signIn callback does for a sub with no users row. */
  async function signInAgain(googleSub: string): Promise<string> {
    const user = await db.user.create({ data: { googleId: googleSub }, select: { id: true } })
    return user.id
  }

  beforeEach(async () => {
    await cleanDb()
    seeded = await seedMinimal()
  })
  afterEach(async () => {
    await cleanDb()
  })

  // ── Guards ────────────────────────────────────────────────────────────────

  it('returns 401 without a session', async () => {
    mockUnauthenticated()
    const res = await DELETE(deleteRequest())
    expect(res.status).toBe(401)
    expect(await db.user.count()).toBe(3)
  })

  it('returns 400 without an explicit {"confirm": true} body', async () => {
    mockSession(seeded.user1Id)
    for (const body of [{}, { confirm: 'yes' }, { confirm: false }]) {
      const res = await DELETE(deleteRequest(body))
      expect(res.status).toBe(400)
    }
    expect(await db.user.findUnique({ where: { id: seeded.user1Id } })).not.toBeNull()
  })

  it('refuses with 503 and deletes nothing when the tombstone secret is missing', async () => {
    expect((await review(seeded.user1Id, 'CSE 301')).status).toBe(201)

    const saved = process.env.ACCOUNT_TOMBSTONE_SECRET
    delete process.env.ACCOUNT_TOMBSTONE_SECRET
    try {
      const res = await deleteAccount(seeded.user1Id)
      expect(res.status).toBe(503)
      expect((await res.json()).code).toBe('DELETION_UNAVAILABLE')
    } finally {
      process.env.ACCOUNT_TOMBSTONE_SECRET = saved
    }

    expect(await db.user.findUnique({ where: { id: seeded.user1Id } })).not.toBeNull()
    expect(await db.reviewSubmission.count()).toBe(1)
    expect(await db.reviewSubmissionTombstone.count()).toBe(0)
  })

  it('returns 404 for a session whose account is already gone', async () => {
    expect((await deleteAccount(seeded.user1Id)).status).toBe(200)
    expect((await deleteAccount(seeded.user1Id)).status).toBe(404)
  })

  // ── What gets deleted, what stays ─────────────────────────────────────────

  it('deletes the account and everything linked to it, but keeps the reviews', async () => {
    expect((await review(seeded.user1Id, 'CSE 301')).status).toBe(201)
    expect((await review(seeded.user1Id, 'CSE 302')).status).toBe(201)
    expect((await review(seeded.user2Id, 'CSE 301')).status).toBe(201)
    await db.universityRequest.create({
      data: { userId: seeded.user1Id, nameEn: 'Some New University', type: 'private' },
    })

    const res = await deleteAccount(seeded.user1Id)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ deleted: true })

    expect(await db.user.findUnique({ where: { id: seeded.user1Id } })).toBeNull()
    expect(await db.reviewSubmission.count({ where: { userId: seeded.user1Id } })).toBe(0)
    expect(await db.universityRequest.count()).toBe(0)

    // Reviews and aggregates are untouched: we can't tell which are theirs.
    expect(await db.review.count()).toBe(3)
    const pcs = await db.professorCourse.findMany({ select: { reviewCount: true } })
    expect(pcs.map((p) => p.reviewCount).sort()).toEqual([1, 2])

    // Other accounts are untouched.
    expect(await db.reviewSubmission.count({ where: { userId: seeded.user2Id } })).toBe(1)

    // One tombstone per deleted submission, keyed on the Google sub.
    const tombstones = await db.reviewSubmissionTombstone.findMany()
    const pcIds = (await db.professorCourse.findMany({ select: { id: true } })).map((p) => p.id)
    expect(tombstones.map((t) => t.keyHash).sort()).toEqual(
      pcIds.map((id) => tombstoneKey(SECRET, 'gid-1', id)).sort(),
    )
  })

  // ── The duplicate-review guard survives deletion ──────────────────────────

  it('delete → sign in again → re-reviewing a previously reviewed course is 409', async () => {
    expect((await review(seeded.user1Id, 'CSE 301')).status).toBe(201)
    expect((await deleteAccount(seeded.user1Id)).status).toBe(200)

    const newUserId = await signInAgain('gid-1')
    expect(newUserId).not.toBe(seeded.user1Id)

    const res = await review(newUserId, 'CSE 301')
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('ALREADY_REVIEWED')

    expect(await db.review.count()).toBe(1)
    const pc = await db.professorCourse.findFirstOrThrow({ select: { reviewCount: true } })
    expect(pc.reviewCount).toBe(1)
    expect(await db.reviewSubmission.count({ where: { userId: newUserId } })).toBe(0)
  })

  it('delete → sign in again → reviewing a new course is fine', async () => {
    expect((await review(seeded.user1Id, 'CSE 301')).status).toBe(201)
    expect((await deleteAccount(seeded.user1Id)).status).toBe(200)
    const newUserId = await signInAgain('gid-1')

    expect((await review(newUserId, 'CSE 302')).status).toBe(201)
  })

  it('the tombstone blocks only that Google account, not other accounts', async () => {
    expect((await review(seeded.user1Id, 'CSE 301')).status).toBe(201)
    expect((await deleteAccount(seeded.user1Id)).status).toBe(200)

    expect((await review(seeded.user2Id, 'CSE 301')).status).toBe(201)
  })

  it('the guard holds across repeated delete/re-sign-in cycles', async () => {
    expect((await review(seeded.user1Id, 'CSE 301')).status).toBe(201)
    expect((await deleteAccount(seeded.user1Id)).status).toBe(200)

    const second = await signInAgain('gid-1')
    expect((await review(second, 'CSE 302')).status).toBe(201)
    expect((await deleteAccount(second)).status).toBe(200)

    const third = await signInAgain('gid-1')
    expect((await review(third, 'CSE 301')).status).toBe(409)
    expect((await review(third, 'CSE 302')).status).toBe(409)
    expect((await review(third, 'CSE 303')).status).toBe(201)
  })

  it('a session that outlived its account cannot submit a review', async () => {
    expect((await deleteAccount(seeded.user1Id)).status).toBe(200)

    const res = await review(seeded.user1Id, 'CSE 301')
    expect(res.status).toBe(401)
    expect(await db.review.count()).toBe(0)
  })

  // ── Abuse limits survive deletion ─────────────────────────────────────────

  async function report(userId: string, reviewId: number): Promise<Response> {
    mockSession(userId)
    return postReport(
      jsonPost('http://localhost/api/reports', { review_id: reviewId, reason: 'fake' }),
    )
  }

  it('delete → sign in again → today’s review quota is still used up', async () => {
    for (let i = 0; i < REVIEWS_PER_DAY; i++) {
      expect((await review(seeded.user1Id, `CSE ${401 + i}`)).status).toBe(201)
    }
    expect((await deleteAccount(seeded.user1Id)).status).toBe(200)

    const newUserId = await signInAgain('gid-1')
    const res = await review(newUserId, 'CSE 499')
    expect(res.status).toBe(429)
    expect((await res.json()).code).toBe('RATE_LIMITED')
    expect(await db.review.count()).toBe(REVIEWS_PER_DAY)

    // A different Google account still has its own quota.
    expect((await review(seeded.user2Id, 'CSE 499')).status).toBe(201)
  })

  it('delete → sign in again → the partial quota carries over, not resets', async () => {
    for (let i = 0; i < REVIEWS_PER_DAY - 1; i++) {
      expect((await review(seeded.user1Id, `CSE ${401 + i}`)).status).toBe(201)
    }
    expect((await deleteAccount(seeded.user1Id)).status).toBe(200)

    const newUserId = await signInAgain('gid-1')
    expect((await review(newUserId, 'CSE 498')).status).toBe(201)
    expect((await review(newUserId, 'CSE 499')).status).toBe(429)
  })

  it('delete → sign in again → reporting the same review again is deduplicated', async () => {
    expect((await review(seeded.user3Id, 'CSE 301')).status).toBe(201)
    const target = await db.review.findFirstOrThrow({ select: { id: true } })

    expect((await report(seeded.user1Id, target.id)).status).toBe(201)
    expect((await deleteAccount(seeded.user1Id)).status).toBe(200)

    const second = await signInAgain('gid-1')
    expect((await report(second, target.id)).status).toBe(201) // idempotent
    expect((await deleteAccount(second)).status).toBe(200)

    const third = await signInAgain('gid-1')
    expect((await report(third, target.id)).status).toBe(201)

    // One account, one report: nowhere near the auto-hide threshold.
    expect(await db.report.count({ where: { reviewId: target.id } })).toBe(1)
    const after = await db.review.findUniqueOrThrow({
      where: { id: target.id },
      select: { moderationStatus: true },
    })
    expect(after.moderationStatus).toBe('live')

    // Other accounts can still report it.
    expect((await report(seeded.user2Id, target.id)).status).toBe(201)
    expect(await db.report.count({ where: { reviewId: target.id } })).toBe(2)
  })

  it('a session that outlived its account cannot file a report', async () => {
    expect((await review(seeded.user3Id, 'CSE 301')).status).toBe(201)
    const target = await db.review.findFirstOrThrow({ select: { id: true } })
    expect((await deleteAccount(seeded.user1Id)).status).toBe(200)

    expect((await report(seeded.user1Id, target.id)).status).toBe(401)
    expect(await db.report.count()).toBe(0)
  })

  it('no Redis key holds a users.id or a Google sub in the clear', async () => {
    expect((await review(seeded.user3Id, 'CSE 301')).status).toBe(201)
    const target = await db.review.findFirstOrThrow({ select: { id: true } })
    expect((await report(seeded.user1Id, target.id)).status).toBe(201)
    expect((await deleteAccount(seeded.user1Id)).status).toBe(200)
    const newUserId = await signInAgain('gid-1')
    expect((await report(newUserId, target.id)).status).toBe(201)

    const keys = [...__redisStore.keys()]
    expect(keys.some((k) => k.startsWith('rl:review:'))).toBe(true)
    expect(keys.some((k) => k.startsWith('reported:'))).toBe(true)
    for (const key of keys) {
      for (const id of [seeded.user1Id, seeded.user3Id, newUserId, 'gid-1', 'gid-3']) {
        expect(key).not.toContain(id)
      }
    }
  })

  // ── Helpful votes ─────────────────────────────────────────────────────────

  it('removes the account’s helpful votes and decrements helpful_count', async () => {
    expect((await review(seeded.user3Id, 'CSE 301')).status).toBe(201)
    expect((await review(seeded.user3Id, 'CSE 302')).status).toBe(201)
    const [a, b] = await db.review.findMany({ orderBy: { id: 'asc' }, select: { id: true } })
    if (!a || !b) throw new Error('expected two reviews')

    await vote(seeded.user1Id, a.id)
    await vote(seeded.user1Id, b.id)
    await vote(seeded.user2Id, a.id)

    expect((await deleteAccount(seeded.user1Id)).status).toBe(200)

    const counts = await db.review.findMany({
      orderBy: { id: 'asc' },
      select: { helpfulCount: true },
    })
    expect(counts.map((c) => c.helpfulCount)).toEqual([1, 0])
    expect(await db.helpfulVote.count({ where: { userId: seeded.user1Id } })).toBe(0)
    expect(await db.helpfulVote.count({ where: { userId: seeded.user2Id } })).toBe(1)

    // Re-signing-in and voting again just restores the vote; no inflation.
    const again = await signInAgain('gid-1')
    await vote(again, a.id)
    const reviewA = await db.review.findUniqueOrThrow({
      where: { id: a.id },
      select: { helpfulCount: true },
    })
    expect(reviewA.helpfulCount).toBe(2)
  })

  // ── Nothing in the tombstone can be joined to reviews ─────────────────────

  it('the tombstone table holds only an opaque hash: no course, user, id or time', async () => {
    expect((await review(seeded.user1Id, 'CSE 301')).status).toBe(201)
    expect((await review(seeded.user1Id, 'CSE 302')).status).toBe(201)
    expect((await deleteAccount(seeded.user1Id)).status).toBe(200)

    const cols = await db.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'review_submission_tombstones'
    `
    expect(cols.map((c) => c.column_name)).toEqual(['key_hash'])

    const fks = await db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM information_schema.table_constraints
      WHERE constraint_type = 'FOREIGN KEY'
        AND (table_name = 'review_submission_tombstones'
          OR constraint_name LIKE '%tombstone%')
    `
    expect(Number(fks[0]?.n)).toBe(0)

    // The hashes don't embed anything that exists elsewhere in the database.
    const reviews = await db.review.findMany({
      select: { id: true, professorCourseId: true, submittedAt: true },
    })
    const tombstones = await db.reviewSubmissionTombstone.findMany()
    expect(tombstones).toHaveLength(2)
    for (const { keyHash } of tombstones) {
      expect(keyHash).toMatch(/^[0-9a-f]{64}$/)
      expect(keyHash).not.toContain('gid-1')
      for (const r of reviews) {
        expect(keyHash).not.toBe(String(r.id))
        expect(keyHash).not.toBe(String(r.professorCourseId))
      }
    }

    // Without the secret, the hash for a known (sub, course) cannot be
    // recomputed, so a DB dump plus a sub reveals nothing.
    const pcIds = reviews.map((r) => r.professorCourseId)
    const keys = new Set(tombstones.map((t) => t.keyHash))
    for (const id of pcIds) {
      expect(keys.has(tombstoneKey('a-different-secret-of-sufficient-length', 'gid-1', id))).toBe(
        false,
      )
    }
  })
})
