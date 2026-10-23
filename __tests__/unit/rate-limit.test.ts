import { describe, it, expect } from 'vitest'
import { dhakaDayBucket, reviewQuotaKey } from '@/lib/rate-limit'

describe('dhakaDayBucket', () => {
  it('rolls the day over at Dhaka midnight (18:00 UTC), not UTC midnight', () => {
    expect(dhakaDayBucket(new Date('2026-10-23T17:59:59Z')).day).toBe('2026-10-23')
    expect(dhakaDayBucket(new Date('2026-10-23T18:00:00Z')).day).toBe('2026-10-24')
  })

  it('expires the bucket exactly at the end of the Dhaka day', () => {
    expect(dhakaDayBucket(new Date('2026-10-23T17:59:00Z')).secondsLeft).toBe(60)
    expect(dhakaDayBucket(new Date('2026-10-23T18:00:00Z')).secondsLeft).toBe(24 * 60 * 60)
  })

  it('gives every moment of the same day the same expiry instant', () => {
    const a = new Date('2026-10-23T19:00:00Z')
    const b = new Date('2026-10-24T03:30:00Z')
    expect(a.getTime() + dhakaDayBucket(a).secondsLeft * 1000).toBe(
      b.getTime() + dhakaDayBucket(b).secondsLeft * 1000,
    )
  })
})

describe('reviewQuotaKey', () => {
  const user = '6f1c1a3e-6c7b-4a62-9b50-1a2b3c4d5e6f'

  it('does not contain the account id', () => {
    expect(reviewQuotaKey(user, '2026-10-23', 's')).not.toContain(user)
  })

  it('is stable for the same inputs and differs across days and secrets', () => {
    const k = reviewQuotaKey(user, '2026-10-23', 's')
    expect(reviewQuotaKey(user, '2026-10-23', 's')).toBe(k)
    expect(reviewQuotaKey(user, '2026-10-24', 's')).not.toBe(k)
    expect(reviewQuotaKey(user, '2026-10-23', 't')).not.toBe(k)
  })
})
