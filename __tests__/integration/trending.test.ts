// ─────────────────────────────────────────────────────────────────────────────
// Integration tests for lib/trending.ts — the homepage "trending" query.
// ─────────────────────────────────────────────────────────────────────────────

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/lib/db'
import { computeTrending } from '@/lib/trending'
import { cleanDb, seedMinimal, type SeededRow } from '@/test/integration-helpers'

const DAY = 24 * 60 * 60 * 1000

describe('computeTrending', () => {
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
    aggregate?: { reviewCount: number; overallScore: number },
  ) {
    n += 1
    const prof = await db.professor.create({
      data: {
        universityId: seeded.uniId,
        departmentId: seeded.deptId,
        nameEn,
        nameBn: nameEn,
        slug: `trend-prof-${n}`,
      },
    })
    const course = await db.course.create({
      data: { departmentId: seeded.deptId, courseCode: `TR ${n}`, courseName: `Trend ${n}` },
    })
    const pc = await db.professorCourse.create({
      data: {
        professorId: prof.id,
        courseId: course.id,
        reviewCount: aggregate?.reviewCount ?? 0,
        overallScore: aggregate?.overallScore ?? null,
      },
    })
    return { prof, pc }
  }

  async function reviews(
    pcId: number,
    count: number,
    over: Partial<{
      ageDays: number
      status: 'visible' | 'hidden'
      moderationStatus: 'live' | 'soft_flagged' | 'flagged_hidden'
    }> = {},
  ) {
    for (let i = 0; i < count; i++) {
      await db.review.create({
        data: {
          professorCourseId: pcId,
          teachingQuality: 4,
          gradingFairness: 4,
          courseDifficulty: 3,
          attendanceStrictness: 3,
          wouldRecommend: true,
          submittedAt: new Date(Date.now() - (over.ageDays ?? 1) * DAY - i * 1000),
          status: over.status ?? 'visible',
          moderationStatus: over.moderationStatus ?? 'live',
        },
      })
    }
  }

  it('ranks by reviews inside the window and ignores older ones', async () => {
    const busy = await professor('Busy')
    const quiet = await professor('Quiet')
    const stale = await professor('Stale')
    await reviews(busy.pc.id, 3)
    await reviews(quiet.pc.id, 1)
    await reviews(stale.pc.id, 10, { ageDays: 45 })

    const out = await computeTrending()
    expect(out.map((e) => e.displayName)).toEqual(['Busy', 'Quiet'])
    expect(out[0]?.recentReviews).toBe(3)
  })

  it('counts soft-flagged reviews but not hidden ones', async () => {
    const a = await professor('Soft flagged')
    const b = await professor('Hidden burst')
    await reviews(a.pc.id, 2, { moderationStatus: 'soft_flagged' })
    await reviews(b.pc.id, 5, { status: 'hidden' })
    await reviews(b.pc.id, 5, { moderationStatus: 'flagged_hidden' })

    const out = await computeTrending()
    expect(out.map((e) => e.displayName)).toEqual(['Soft flagged'])
    expect(out[0]?.recentReviews).toBe(2)
  })

  it('breaks ties by the most recent review and honours the limit', async () => {
    const older = await professor('Older')
    const newer = await professor('Newer')
    const third = await professor('Third')
    await reviews(older.pc.id, 2, { ageDays: 10 })
    await reviews(newer.pc.id, 2, { ageDays: 2 })
    await reviews(third.pc.id, 1)

    const out = await computeTrending({ limit: 2 })
    expect(out.map((e) => e.displayName)).toEqual(['Newer', 'Older'])
  })

  it('reports the all-time weighted score from the aggregates', async () => {
    const p = await professor('Scored', { reviewCount: 4, overallScore: 4.25 })
    await reviews(p.pc.id, 1)
    const [entry] = await computeTrending()
    expect(entry?.overallScore).toBeCloseTo(4.25, 5)
    expect(entry?.universityShortName).toBe('TU')
    expect(entry?.departmentLabel).toBe('CSE')
  })

  it('returns an empty list when nothing was reviewed recently', async () => {
    const p = await professor('Old news')
    await reviews(p.pc.id, 3, { ageDays: 90 })
    expect(await computeTrending()).toEqual([])
  })
})
