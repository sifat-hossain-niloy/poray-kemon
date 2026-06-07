import { describe, it, expect } from 'vitest'
import { runningAvg, runningRecommendPct, overallScore } from '@/lib/aggregation'

describe('runningAvg', () => {
  it('returns the new value when count is 0', () => {
    expect(runningAvg(0, 0, 4)).toBe(4)
    // oldAvg is ignored when count is 0
    expect(runningAvg(99, 0, 4)).toBe(4)
  })

  it('averages two values when adding the second', () => {
    expect(runningAvg(4, 1, 2)).toBe(3) // (4+2)/2
  })

  it('matches a naive average across many inserts', () => {
    const values = [3, 5, 2, 4, 4, 1, 5, 5, 3, 2]
    let avg = 0
    let count = 0
    for (const v of values) {
      avg = runningAvg(avg, count, v)
      count += 1
    }
    const naive = values.reduce((s, n) => s + n, 0) / values.length
    expect(avg).toBeCloseTo(naive, 10)
  })
})

describe('runningRecommendPct', () => {
  it('starts at 100 with one yes', () => {
    expect(runningRecommendPct(0, 0, true)).toBe(100)
  })
  it('starts at 0 with one no', () => {
    expect(runningRecommendPct(0, 0, false)).toBe(0)
  })
  it('lands at 50 for one yes + one no', () => {
    const after1 = runningRecommendPct(0, 0, true) // 100
    const after2 = runningRecommendPct(after1, 1, false)
    expect(after2).toBe(50)
  })
})

describe('overallScore', () => {
  it('all perfect → 5', () => {
    expect(overallScore({ teaching: 5, grading: 5, recommendPct: 100 })).toBeCloseTo(5, 10)
  })
  it('all zero → 0', () => {
    expect(overallScore({ teaching: 0, grading: 0, recommendPct: 0 })).toBe(0)
  })
  it('weights teaching highest', () => {
    const a = overallScore({ teaching: 5, grading: 0, recommendPct: 0 }) // 2.5
    const b = overallScore({ teaching: 0, grading: 5, recommendPct: 0 }) // 1.5
    expect(a).toBeGreaterThan(b)
  })
})
