// ─────────────────────────────────────────────────────────────────────────────
// Report helpers — pure, no DB access. Used by the API route and the tests.
// The actual `reports` rows are written via Prisma; the auto-hide threshold
// is enforced inside the route's transaction.
// ─────────────────────────────────────────────────────────────────────────────

import { createHmac } from 'node:crypto'
import type { ReportReason } from '@prisma/client'

/** Reasons exposed to the public form. Mirrors the Prisma enum. */
export const REPORT_REASONS = [
  'personal',
  'fake',
  'offensive',
  'wrong_professor',
  'other',
] as const satisfies ReadonlyArray<ReportReason>

/**
 * Number of pending reports on a review that triggers auto-hide.
 * SRS §4.9 FR-MOD-A-04. Admin can always reinstate.
 */
export const AUTO_HIDE_THRESHOLD = 3

export function shouldAutoHide(pendingReportCount: number): boolean {
  return pendingReportCount >= AUTO_HIDE_THRESHOLD
}

/** TTL for the Redis dedup key. After this, a user may report the same review again. */
export const REPORT_DEDUP_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days

/**
 * Redis key marking that a Google account has already reported a review.
 * Keyed on the Google `sub`, not users.id, so deleting the account and
 * signing in again can't re-report the same review toward auto-hide. HMAC'd
 * so a Redis dump alone doesn't reveal which account reported what.
 */
export function reportDedupKey(googleSub: string, reviewId: number, secret: string): string {
  const digest = createHmac('sha256', secret)
    .update(`report\0${googleSub}\0${reviewId}`)
    .digest('hex')
  return `reported:${digest.slice(0, 32)}`
}
