// ─────────────────────────────────────────────────────────────────────────────
// Helpers for integration tests.
//
// - cleanDb: TRUNCATE all tables (FK-safe via CASCADE), reset identity
// - seedMinimal: one university + one department + three users for setup
// - mockSession / unmockSession: inject a NextAuth session for the API route
// ─────────────────────────────────────────────────────────────────────────────

import { vi } from 'vitest'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

const TABLES_IN_TRUNCATE_ORDER = [
  'helpful_votes',
  'reports',
  'review_submissions',
  'reviews',
  'professor_courses',
  'courses',
  'professors',
  'departments',
  'universities',
  'users',
  'admin_users',
]

/**
 * Wipe every table and reset its serial counters. RESTART IDENTITY CASCADE
 * keeps FK constraints happy and makes assertions like "id=1" deterministic.
 */
export async function cleanDb(): Promise<void> {
  await db.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES_IN_TRUNCATE_ORDER.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  )
}

export interface SeededRow {
  uniId: number
  deptId: number
  user1Id: string
  user2Id: string
  user3Id: string
}

export async function seedMinimal(): Promise<SeededRow> {
  const uni = await db.university.create({
    data: {
      nameEn: 'Test University',
      shortName: 'TU',
      slug: 'tu',
      type: 'public',
    },
    select: { id: true },
  })

  const dept = await db.department.create({
    data: {
      universityId: uni.id,
      nameEn: 'Computer Science',
      shortName: 'CSE',
      slug: 'cse',
    },
    select: { id: true },
  })

  const [u1, u2, u3] = await Promise.all([
    db.user.create({
      data: { googleId: 'gid-1', displayName: 'Alice' },
      select: { id: true },
    }),
    db.user.create({
      data: { googleId: 'gid-2', displayName: 'Bob' },
      select: { id: true },
    }),
    db.user.create({
      data: { googleId: 'gid-3', displayName: 'Carol' },
      select: { id: true },
    }),
  ])

  return { uniId: uni.id, deptId: dept.id, user1Id: u1.id, user2Id: u2.id, user3Id: u3.id }
}

/** Inject a session for the next `auth()` call. */
export function mockSession(userId: string, name = 'TestUser'): void {
  // `auth` is overloaded (server-fn / middleware / route-handler shapes), so
  // cast to a simpler vi.Mock surface for testing purposes.
  ;(auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: { id: userId, name, email: '', image: null },
    expires: new Date(Date.now() + 60_000).toISOString(),
  })
}

export function mockUnauthenticated(): void {
  ;(auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null)
}

/** Convenience: build a JSON POST Request that the route handler can consume. */
export function jsonPost(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
