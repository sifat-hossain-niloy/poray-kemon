import { describe, it, expect } from 'vitest'
import { ratingDistribution, topTags } from '@/lib/review-insights'

describe('topTags', () => {
  it('orders by count, then alphabetically for ties', () => {
    const out = topTags(
      [
        { tag: 'b', count: 2 },
        { tag: 'a', count: 2 },
        { tag: 'c', count: 5 },
      ],
      3,
    )
    expect(out.map((t) => t.tag)).toEqual(['c', 'a', 'b'])
  })

  it('respects the limit and drops zero counts', () => {
    const out = topTags(
      [
        { tag: 'a', count: 0 },
        { tag: 'b', count: 1 },
        { tag: 'c', count: 3 },
      ],
      1,
    )
    expect(out).toEqual([{ tag: 'c', count: 3 }])
  })

  it('drops tags that are not in the known set', () => {
    const out = topTags(
      [
        { tag: 'legacy', count: 9 },
        { tag: 'ok', count: 1 },
      ],
      5,
      new Set(['ok']),
    )
    expect(out.map((t) => t.tag)).toEqual(['ok'])
  })
})

describe('ratingDistribution', () => {
  it('buckets star values and scales widths to the largest bucket', () => {
    const d = ratingDistribution([
      { value: 5, count: 4 },
      { value: 3, count: 2 },
      { value: 1, count: 1 },
    ])
    expect(d.counts).toEqual([1, 0, 2, 0, 4])
    expect(d.total).toBe(7)
    expect(d.widths).toEqual([25, 0, 50, 0, 100])
  })

  it('ignores out-of-range values and handles the empty case', () => {
    const d = ratingDistribution([
      { value: 0, count: 3 },
      { value: 6, count: 3 },
    ])
    expect(d.total).toBe(0)
    expect(d.widths).toEqual([0, 0, 0, 0, 0])
  })
})
