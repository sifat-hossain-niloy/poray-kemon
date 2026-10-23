import { describe, it, expect } from 'vitest'
import { bestIndices, compareHref, parseCompareIds, MAX_COMPARE } from '@/lib/compare'

describe('parseCompareIds', () => {
  it('reads a comma list, uppercases and trims', () => {
    expect(parseCompareIds(' yjxqw8dr , BVFJ77TR')).toEqual(['YJXQW8DR', 'BVFJ77TR'])
  })

  it('accepts repeated params and drops invalid ids and duplicates', () => {
    expect(parseCompareIds(['YJXQW8DR', 'not-an-id,YJXQW8DR', 'AEIOU123'])).toEqual(['YJXQW8DR'])
  })

  it(`caps the selection at ${MAX_COMPARE}`, () => {
    const ids = ['11111111', '22222222', '33333333', '44444444']
    expect(parseCompareIds(ids.join(','))).toEqual(ids.slice(0, MAX_COMPARE))
  })

  it('returns [] for nothing', () => {
    expect(parseCompareIds(undefined)).toEqual([])
    expect(parseCompareIds('')).toEqual([])
  })
})

describe('compareHref', () => {
  it('builds the shareable URL', () => {
    expect(compareHref([])).toBe('/compare')
    expect(compareHref(['YJXQW8DR', 'BVFJ77TR'])).toBe('/compare?ids=YJXQW8DR,BVFJ77TR')
  })
})

describe('bestIndices', () => {
  it('marks the highest value', () => {
    expect([...bestIndices([3.2, 4.1, 2.0])]).toEqual([1])
  })

  it('marks every column tied for best', () => {
    expect([...bestIndices([4.5, 3, 4.5])].sort()).toEqual([0, 2])
  })

  it('ignores nulls and needs at least two values', () => {
    expect([...bestIndices([null, 4, 3])]).toEqual([1])
    expect(bestIndices([null, 4]).size).toBe(0)
  })

  it('marks nothing when all values tie within epsilon', () => {
    expect(bestIndices([4.001, 4.0, 4.003]).size).toBe(0)
  })
})
