// ─────────────────────────────────────────────────────────────────────────────
// Integration tests for the staff audit trail and the handler-level staff
// guards added alongside it.
// ─────────────────────────────────────────────────────────────────────────────

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { ADMIN_COOKIE_NAME, createAdminSessionToken } from '@/lib/admin-auth'
import { PATCH as moderate } from '@/app/api/admin/reviews/[id]/moderation/route'
import { POST as resolveReport } from '@/app/api/admin/reports/[id]/resolve/route'
import { POST as mergeDepartments } from '@/app/api/admin/departments/merge/route'
import { DELETE as deleteStaff } from '@/app/api/admin/users/[id]/route'
import { POST as login } from '@/app/api/admin/login/route'
import { cleanDb, seedMinimal, type SeededRow } from '@/test/integration-helpers'

// CI provides no ADMIN_SESSION_SECRET; the signer only needs a stable one.
process.env.ADMIN_SESSION_SECRET ||= 'integration-test-admin-secret-0123456789'

const jar = vi.hoisted(() => new Map<string, string>())
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name) } : undefined),
    set: (nameOrOpts: string | { name: string; value: string }, value?: string) => {
      if (typeof nameOrOpts === 'string') jar.set(nameOrOpts, value ?? '')
      else jar.set(nameOrOpts.name, nameOrOpts.value)
    },
    delete: (name: string) => jar.delete(name),
  }),
  headers: async () => new Headers(),
}))

async function signInAs(adminId: number, role: 'super_admin' | 'admin' | 'moderator') {
  jar.set(ADMIN_COOKIE_NAME, await createAdminSessionToken(adminId, role))
}

const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) })
const json = (body: unknown, method = 'POST') =>
  new Request('http://localhost/api/admin/x', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('staff audit log', () => {
  let seeded: SeededRow
  let superId: number
  let modId: number
  let reviewId: number

  beforeEach(async () => {
    jar.clear()
    await cleanDb()
    seeded = await seedMinimal()
    const hash = await bcrypt.hash('correct horse battery', 4)
    superId = (
      await db.adminUser.create({
        data: { username: 'root', passwordHash: hash, role: 'super_admin' },
      })
    ).id
    modId = (
      await db.adminUser.create({
        data: { username: 'mod-rina', passwordHash: hash, role: 'moderator' },
      })
    ).id
    const prof = await db.professor.create({
      data: { universityId: seeded.uniId, departmentId: seeded.deptId, nameEn: 'P', slug: 'p' },
    })
    const course = await db.course.create({
      data: { departmentId: seeded.deptId, courseCode: 'AU 1', courseName: 'Audit' },
    })
    const pc = await db.professorCourse.create({
      data: {
        professorId: prof.id,
        courseId: course.id,
        reviewCount: 1,
        avgTeachingQuality: 4,
        avgGradingFairness: 4,
        avgCourseDifficulty: 3,
        avgAttendance: 3,
        wouldRecommendPct: 100,
        overallScore: 4,
      },
    })
    reviewId = (
      await db.review.create({
        data: {
          professorCourseId: pc.id,
          teachingQuality: 4,
          gradingFairness: 4,
          courseDifficulty: 3,
          attendanceStrictness: 3,
          wouldRecommend: true,
        },
      })
    ).id
  })
  afterEach(async () => {
    jar.clear()
    await cleanDb()
  })

  it('rejects moderation without a staff session, even past the proxy', async () => {
    const res = await moderate(json({ action: 'hide' }, 'PATCH'), ctx(reviewId))
    expect(res.status).toBe(401)
    expect((await db.review.findUniqueOrThrow({ where: { id: reviewId } })).moderationStatus).toBe(
      'live',
    )
    expect(await db.adminAuditLog.count()).toBe(0)
  })

  it('records who hid a review, with before/after state and notes', async () => {
    await signInAs(modId, 'moderator')
    const res = await moderate(json({ action: 'hide', notes: 'doxxing' }, 'PATCH'), ctx(reviewId))
    expect(res.status).toBe(200)

    const [entry] = await db.adminAuditLog.findMany()
    expect(entry).toMatchObject({
      adminId: modId,
      adminUsername: 'mod-rina',
      action: 'review.hide',
      targetType: 'review',
      targetId: String(reviewId),
    })
    expect(entry?.details).toEqual({
      from: { moderationStatus: 'live', status: 'visible' },
      to: { moderationStatus: 'flagged_hidden', status: 'visible' },
      notes: 'doxxing',
    })
  })

  it('records report resolution with the affected review', async () => {
    const report = await db.report.create({ data: { reviewId, reason: 'fake' } })
    await signInAs(modId, 'moderator')
    const res = await resolveReport(json({ action: 'remove' }), ctx(report.id))
    expect(res.status).toBe(200)
    const entry = await db.adminAuditLog.findFirstOrThrow()
    expect(entry.action).toBe('report.remove')
    expect(entry.details).toEqual({ reviewId })
  })

  it('writes nothing when the role check rejects the action', async () => {
    await signInAs(modId, 'moderator')
    const res = await mergeDepartments(json({ target_id: seeded.deptId, source_ids: [999] }))
    expect(res.status).toBe(403)
    expect(await db.adminAuditLog.count()).toBe(0)
  })

  it('keeps the username after the acting staff account is deleted', async () => {
    await signInAs(modId, 'moderator')
    await moderate(json({ action: 'hide' }, 'PATCH'), ctx(reviewId))

    await signInAs(superId, 'super_admin')
    const res = await deleteStaff(new Request('http://localhost', { method: 'DELETE' }), ctx(modId))
    expect(res.status).toBe(200)

    const entries = await db.adminAuditLog.findMany({ orderBy: { id: 'asc' } })
    expect(entries.map((e) => e.action)).toEqual(['review.hide', 'staff.delete'])
    expect(entries[0]).toMatchObject({ adminId: null, adminUsername: 'mod-rina' })
    expect(entries[1]).toMatchObject({
      adminId: superId,
      targetId: String(modId),
      details: { username: 'mod-rina', role: 'moderator' },
    })
  })

  it('records successful logins only', async () => {
    const form = (password: string) =>
      new Request('http://localhost/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: 'mod-rina', password }),
      })
    await login(form('wrong password'))
    expect(await db.adminAuditLog.count()).toBe(0)

    await login(form('correct horse battery'))
    const entry = await db.adminAuditLog.findFirstOrThrow()
    expect(entry).toMatchObject({ action: 'auth.login', adminId: modId })
  })
})
