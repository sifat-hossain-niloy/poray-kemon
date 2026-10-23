import { afterEach, describe, expect, it } from 'vitest'
import { tombstoneKey, tombstoneSecret } from '@/lib/account-tombstone'

const SECRET = 'unit-test-tombstone-secret-0123456789abcdef'

describe('tombstoneKey', () => {
  it('is deterministic for the same secret, sub and professor_course', () => {
    expect(tombstoneKey(SECRET, '1234567890', 42)).toBe(tombstoneKey(SECRET, '1234567890', 42))
  })

  it('is a 64-char hex digest that contains neither input', () => {
    const key = tombstoneKey(SECRET, '1234567890', 42)
    expect(key).toMatch(/^[0-9a-f]{64}$/)
    expect(key).not.toContain('1234567890')
  })

  it('differs by sub, by professor_course and by secret', () => {
    const base = tombstoneKey(SECRET, '1234567890', 42)
    expect(tombstoneKey(SECRET, '1234567891', 42)).not.toBe(base)
    expect(tombstoneKey(SECRET, '1234567890', 43)).not.toBe(base)
    expect(tombstoneKey(`${SECRET}x`, '1234567890', 42)).not.toBe(base)
  })

  it('does not collide when digits move between sub and professor_course', () => {
    expect(tombstoneKey(SECRET, '12', 3)).not.toBe(tombstoneKey(SECRET, '1', 23))
  })
})

describe('tombstoneSecret', () => {
  const original = process.env.ACCOUNT_TOMBSTONE_SECRET
  afterEach(() => {
    if (original === undefined) delete process.env.ACCOUNT_TOMBSTONE_SECRET
    else process.env.ACCOUNT_TOMBSTONE_SECRET = original
  })

  it('returns null when unset', () => {
    delete process.env.ACCOUNT_TOMBSTONE_SECRET
    expect(tombstoneSecret()).toBeNull()
  })

  it('returns null for a secret shorter than 32 characters', () => {
    process.env.ACCOUNT_TOMBSTONE_SECRET = 'too-short'
    expect(tombstoneSecret()).toBeNull()
  })

  it('returns the secret when long enough', () => {
    process.env.ACCOUNT_TOMBSTONE_SECRET = SECRET
    expect(tombstoneSecret()).toBe(SECRET)
  })
})
