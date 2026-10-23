// ─────────────────────────────────────────────────────────────────────────────
// Per-account daily review quota (SRS §5.5 NFR-SEC-07)
//
// The SRS phrases this as "per hashed IP", but NFR-PRIV-01 forbids keeping
// IPs at all, and every submitter is already a Google account, so the quota
// is per account instead.
//
// Anonymity constraints shape the key:
//   * Fixed calendar-day buckets (Asia/Dhaka), not a rolling 24h TTL. A
//     rolling TTL would let anyone with a Redis dump compute the exact time
//     an account first submitted that day — a timing join against
//     reviews.submitted_at, which is precisely what decoupling
//     review_submissions from reviews was meant to rule out.
//   * The key is an HMAC of (Google sub, day) under the app secret, so a Redis
//     dump alone cannot be mapped back to accounts.
//   * Keyed on the Google `sub`, not users.id: deleting the account and
//     signing in again makes a new users row with a new UUID but the same
//     sub, and must not hand out a fresh quota.
// ─────────────────────────────────────────────────────────────────────────────

import { createHmac } from 'node:crypto'
import { redis } from '@/lib/redis'

/** Enough for a full semester's course load in one sitting. */
export const REVIEWS_PER_DAY = 6

// Bangladesh has no DST, so a fixed offset is exact.
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

/** The Asia/Dhaka calendar day `now` falls in, and seconds until it ends. */
export function dhakaDayBucket(now: Date): { day: string; secondsLeft: number } {
  const shifted = now.getTime() + DHAKA_OFFSET_MS
  const dayStart = Math.floor(shifted / DAY_MS) * DAY_MS
  return {
    day: new Date(dayStart).toISOString().slice(0, 10),
    secondsLeft: Math.max(1, Math.ceil((dayStart + DAY_MS - shifted) / 1000)),
  }
}

export function reviewQuotaKey(googleSub: string, day: string, secret: string): string {
  // NUL separators + a purpose tag keep this from colliding with other
  // HMACs of the sub under the same secret (see reportDedupKey).
  const digest = createHmac('sha256', secret).update(`quota\0${googleSub}\0${day}`).digest('hex')
  return `rl:review:${digest.slice(0, 32)}`
}

/** Keys the per-account Redis entries (review quota, report dedup). Rotating
 *  it only resets those short-lived entries, unlike ACCOUNT_TOMBSTONE_SECRET. */
export function abuseKeySecret(): string {
  return process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? 'dev-only-rate-limit-secret'
}

/** True when the account may submit another review today. Redis being
 *  absent or down fails open — the quota is abuse friction, not an
 *  integrity guarantee (the one-review-per-course constraint is in SQL). */
export async function hasReviewQuota(googleSub: string, now = new Date()): Promise<boolean> {
  if (!redis) return true
  try {
    const { day } = dhakaDayBucket(now)
    const used = Number((await redis.get(reviewQuotaKey(googleSub, day, abuseKeySecret()))) ?? 0)
    return used < REVIEWS_PER_DAY
  } catch {
    return true
  }
}

/** Count one successful submission against today's quota. Called only after
 *  the review transaction commits, so rejected submissions are free. */
export async function consumeReviewQuota(googleSub: string, now = new Date()): Promise<void> {
  if (!redis) return
  try {
    const { day, secondsLeft } = dhakaDayBucket(now)
    const key = reviewQuotaKey(googleSub, day, abuseKeySecret())
    const used = await redis.incr(key)
    if (used === 1) await redis.expire(key, secondsLeft)
  } catch {
    // Non-fatal — see hasReviewQuota.
  }
}
