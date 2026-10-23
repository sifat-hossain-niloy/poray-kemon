import { describe, it, expect } from 'vitest'
import {
  applyListing,
  difficultyBucket,
  listingQuery,
  parseListingParams,
  DEFAULT_LISTING,
  type ListableProfessor,
} from '@/lib/department-listing'

function prof(id: string, over: Partial<ListableProfessor> = {}) {
  return {
    id,
    overallScore: 3,
    totalReviews: 5,
    avgCourseDifficulty: 3,
    wouldRecommendPct: 60,
    lastReviewedAt: new Date('2026-01-01'),
    ...over,
  }
}

describe('parseListingParams', () => {
  it('falls back to defaults for missing or unknown values', () => {
    expect(parseListingParams({})).toEqual(DEFAULT_LISTING)
    expect(parseListingParams({ sort: 'bogus', difficulty: 'extreme', view: 'x' })).toEqual(
      DEFAULT_LISTING,
    )
  })

  it('reads every supported control, taking the first of repeated params', () => {
    expect(
      parseListingParams({
        view: 'courses',
        sort: ['recent', 'reviews'],
        difficulty: 'hard',
        recommended: '1',
      }),
    ).toEqual({ view: 'courses', sort: 'recent', difficulty: 'hard', recommendedOnly: true })
  })
})

describe('listingQuery', () => {
  it('omits defaults so the canonical URL has no query string', () => {
    expect(listingQuery(DEFAULT_LISTING)).toBe('')
  })

  it('round-trips through parseListingParams', () => {
    const params = {
      view: 'professors' as const,
      sort: 'reviews' as const,
      difficulty: 'easy' as const,
      recommendedOnly: true,
    }
    const qs = new URLSearchParams(listingQuery(params))
    expect(parseListingParams(Object.fromEntries(qs))).toEqual(params)
  })
})

describe('difficultyBucket', () => {
  it('splits the 1–5 scale into thirds', () => {
    expect(difficultyBucket(null)).toBeNull()
    expect(difficultyBucket(1)).toBe('easy')
    expect(difficultyBucket(2.49)).toBe('easy')
    expect(difficultyBucket(2.5)).toBe('medium')
    expect(difficultyBucket(3.49)).toBe('medium')
    expect(difficultyBucket(3.5)).toBe('hard')
    expect(difficultyBucket(5)).toBe('hard')
  })
})

describe('applyListing', () => {
  const rows = [
    prof('a', { overallScore: 4.5, totalReviews: 2, lastReviewedAt: new Date('2026-03-01') }),
    prof('b', { overallScore: 3.0, totalReviews: 9, lastReviewedAt: new Date('2026-05-01') }),
    prof('c', {
      overallScore: null,
      totalReviews: 0,
      lastReviewedAt: null,
      wouldRecommendPct: null,
    }),
    prof('d', {
      overallScore: 4.0,
      totalReviews: 4,
      avgCourseDifficulty: 4.2,
      wouldRecommendPct: 30,
    }),
  ]
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id)
  const base = { difficulty: null, recommendedOnly: false }

  it('sorts by rating with unrated professors last', () => {
    expect(ids(applyListing(rows, { ...base, sort: 'rating' }))).toEqual(['a', 'd', 'b', 'c'])
  })

  it('sorts by review count', () => {
    expect(ids(applyListing(rows, { ...base, sort: 'reviews' }))).toEqual(['b', 'd', 'a', 'c'])
  })

  it('sorts by most recent review, never-reviewed last', () => {
    expect(ids(applyListing(rows, { ...base, sort: 'recent' }))).toEqual(['b', 'a', 'd', 'c'])
  })

  it('filters by difficulty bucket, excluding unrated professors', () => {
    expect(ids(applyListing(rows, { ...base, sort: 'rating', difficulty: 'hard' }))).toEqual(['d'])
  })

  it('filters to recommended professors only', () => {
    expect(ids(applyListing(rows, { ...base, sort: 'rating', recommendedOnly: true }))).toEqual([
      'a',
      'b',
    ])
  })

  it('does not mutate the input', () => {
    const copy = [...rows]
    applyListing(rows, { ...base, sort: 'reviews' })
    expect(rows).toEqual(copy)
  })
})
