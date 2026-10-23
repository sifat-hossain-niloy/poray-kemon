// ─────────────────────────────────────────────────────────────────────────────
// Review-submission tombstones — keep the duplicate-review guard alive after
// an account is deleted, without keeping anything that points at a review.
//
// The key is HMAC(secret, google_sub, professor_course_id):
//   * keyed on the Google `sub`, not users.id, because re-signing-in after a
//     deletion creates a new users row with a new UUID but the same sub;
//   * keyed with a dedicated secret so a database dump alone cannot be used
//     to test "did sub X review course Y?" — that needs the secret too;
//   * the secret is NOT derived from NEXTAUTH_SECRET: rotating the session
//     secret is routine, and doing so would silently void every tombstone.
// ─────────────────────────────────────────────────────────────────────────────

import { createHmac } from 'node:crypto'

const SECRET_ENV = 'ACCOUNT_TOMBSTONE_SECRET'
// Short secrets make the key space for (sub, course) guessable offline.
const MIN_SECRET_LENGTH = 32

export function tombstoneSecret(): string | null {
  const secret = process.env[SECRET_ENV]
  return secret && secret.length >= MIN_SECRET_LENGTH ? secret : null
}

export function tombstoneKey(secret: string, googleSub: string, professorCourseId: number): string {
  // NUL separators keep ("1", 23) and ("12", 3) from hashing the same input.
  return createHmac('sha256', secret).update(`v1\0${googleSub}\0${professorCourseId}`).digest('hex')
}
