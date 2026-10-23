// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/me — self-serve account deletion
//
// One transaction:
//   1. Lock the users row FOR UPDATE. Inserting a helpful vote or a review
//      submission takes a KEY SHARE lock on it for the FK check, so writes
//      racing this deletion block here and then fail on the missing user
//      instead of slipping in after we read the user's rows.
//   2. DELETE review_submissions RETURNING professor_course_id, and write one
//      tombstone per row (lib/account-tombstone.ts) so the same Google account
//      cannot review those professor+courses again after re-signing-in.
//   3. DELETE helpful_votes RETURNING review_id, decrementing each review's
//      helpful_count in the same statement. Using RETURNING (not a prior
//      SELECT) means a vote the user un-did concurrently is never decremented
//      twice.
//   4. DELETE the users row; university_requests go with it via ON DELETE
//      CASCADE.
//
// Reviews are untouched: nothing links a review to its author, and the
// tombstones keep it that way (no course id, no timestamp, no user id).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getStrings } from '@/lib/i18n'
import { tombstoneKey, tombstoneSecret } from '@/lib/account-tombstone'

export const dynamic = 'force-dynamic'

// An explicit body makes a bare `fetch('/api/me', { method: 'DELETE' })`
// (a typo, a stray script) a 400 rather than an irreversible deletion.
const deleteAccountSchema = z.object({ confirm: z.literal(true) })

export async function DELETE(req: Request) {
  const strings = await getStrings()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: strings.errors.unauthorized, code: 'UNAUTHENTICATED' },
      { status: 401 },
    )
  }
  const userId = session.user.id

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!deleteAccountSchema.safeParse(raw).success) {
    return NextResponse.json(
      { error: 'Body must be {"confirm": true}', code: 'CONFIRMATION_REQUIRED' },
      { status: 400 },
    )
  }

  // Deleting without a tombstone would reopen every course this account
  // reviewed, so refuse outright rather than delete half-safely.
  const secret = tombstoneSecret()
  if (!secret) {
    console.error('[me/DELETE] ACCOUNT_TOMBSTONE_SECRET is unset or shorter than 32 characters')
    return NextResponse.json(
      { error: strings.account.unavailable, code: 'DELETION_UNAVAILABLE' },
      { status: 503 },
    )
  }

  let deleted: boolean
  try {
    deleted = await db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ google_id: string }[]>`
        SELECT google_id FROM users WHERE id = ${userId}::uuid FOR UPDATE
      `
      const googleSub = locked[0]?.google_id
      if (!googleSub) return false

      const submissions = await tx.$queryRaw<{ professor_course_id: number }[]>`
        DELETE FROM review_submissions
        WHERE user_id = ${userId}::uuid
        RETURNING professor_course_id
      `
      if (submissions.length > 0) {
        await tx.reviewSubmissionTombstone.createMany({
          data: submissions.map((s) => ({
            keyHash: tombstoneKey(secret, googleSub, s.professor_course_id),
          })),
          // A course reviewed under an earlier, already-deleted account of the
          // same sub was blocked at submit time, so a collision here means the
          // row is already exactly what we would write.
          skipDuplicates: true,
        })
      }

      await tx.$executeRaw`
        WITH removed AS (
          DELETE FROM helpful_votes
          WHERE user_id = ${userId}::uuid
          RETURNING review_id
        )
        UPDATE reviews r
        SET helpful_count = GREATEST(r.helpful_count - 1, 0)
        FROM removed
        WHERE r.id = removed.review_id
      `

      await tx.user.delete({ where: { id: userId } })
      return true
    })
  } catch (err) {
    console.error('[me/DELETE] transaction failed:', err)
    return NextResponse.json({ error: strings.account.failed }, { status: 500 })
  }

  if (!deleted) {
    return NextResponse.json({ error: strings.errors.notFound, code: 'NOT_FOUND' }, { status: 404 })
  }

  return NextResponse.json({ deleted: true })
}
