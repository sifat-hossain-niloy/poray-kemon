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
  it('namespaces user + review', () => {
    expect(reportDedupKey('abc-123', 42)).toBe('reported:abc-123:42')
  })

  it('produces distinct keys for distinct users', () => {
    expect(reportDedupKey('u1', 1)).not.toBe(reportDedupKey('u2', 1))
  })

  it('produces distinct keys for distinct reviews', () => {
    expect(reportDedupKey('u1', 1)).not.toBe(reportDedupKey('u1', 2))
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
