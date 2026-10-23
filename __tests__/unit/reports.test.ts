import { describe, it, expect } from 'vitest'
import {
  AUTO_HIDE_THRESHOLD,
  REPORT_DEDUP_TTL_SECONDS,
  REPORT_REASONS,
  reportDedupKey,
  shouldAutoHide,
} from '@/lib/reports'

describe('shouldAutoHide', () => {
  it('returns false below threshold', () => {
    expect(shouldAutoHide(0)).toBe(false)
    expect(shouldAutoHide(1)).toBe(false)
    expect(shouldAutoHide(2)).toBe(false)
  })

  it('returns true at the threshold', () => {
    expect(shouldAutoHide(AUTO_HIDE_THRESHOLD)).toBe(true)
  })

  it('returns true above the threshold', () => {
    expect(shouldAutoHide(AUTO_HIDE_THRESHOLD + 1)).toBe(true)
    expect(shouldAutoHide(100)).toBe(true)
  })
})

describe('reportDedupKey', () => {
  const sub = '108234567890123456789'

  it('is namespaced and holds neither the sub nor the review id in the clear', () => {
    const k = reportDedupKey(sub, 42, 's')
    expect(k).toMatch(/^reported:[0-9a-f]{32}$/)
    expect(k).not.toContain(sub)
    expect(k).not.toContain(':42')
  })

  it('produces distinct keys for distinct accounts', () => {
    expect(reportDedupKey('s1', 1, 's')).not.toBe(reportDedupKey('s2', 1, 's'))
  })

  it('produces distinct keys for distinct reviews', () => {
    expect(reportDedupKey('s1', 1, 's')).not.toBe(reportDedupKey('s1', 2, 's'))
  })

  it('does not collide on concatenation ("1", 23) vs ("12", 3)', () => {
    expect(reportDedupKey('1', 23, 's')).not.toBe(reportDedupKey('12', 3, 's'))
  })

  it('depends on the secret', () => {
    expect(reportDedupKey(sub, 1, 's')).not.toBe(reportDedupKey(sub, 1, 't'))
  })
})

describe('constants', () => {
  it('exposes 5 report reasons (SRS §4.5 FR-MOD-02)', () => {
    expect(REPORT_REASONS).toEqual(['personal', 'fake', 'offensive', 'wrong_professor', 'other'])
  })

  it('dedup TTL is positive and at least a day', () => {
    expect(REPORT_DEDUP_TTL_SECONDS).toBeGreaterThan(0)
    expect(REPORT_DEDUP_TTL_SECONDS).toBeGreaterThanOrEqual(24 * 60 * 60)
  })
})
