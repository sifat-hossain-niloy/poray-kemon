import { describe, it, expect } from 'vitest'
import {
  filterParams,
  filterWhere,
  hasActiveFilters,
  parseCourseReviewFilters,
  NO_FILTERS,
} from '@/lib/course-review-filters'

const KNOWN = new Set(['সহজলভ্য', 'বোর্ডে_বোঝান'])

describe('parseCourseReviewFilters', () => {
  it('defaults to no filters', () => {
    expect(parseCourseReviewFilters({}, KNOWN)).toEqual(NO_FILTERS)
  })

  it('reads every filter and ignores unknown values', () => {
    expect(parseCourseReviewFilters({ recommend: 'no', text: '1', tag: 'সহজলভ্য' }, KNOWN)).toEqual(
      { recommend: 'no', withText: true, tag: 'সহজলভ্য' },
    )
    expect(
      parseCourseReviewFilters({ recommend: 'maybe', text: 'yes', tag: '<b>x</b>' }, KNOWN),
    ).toEqual(NO_FILTERS)
  })

  it('takes the first of repeated params', () => {
    expect(parseCourseReviewFilters({ recommend: ['yes', 'no'] }, KNOWN).recommend).toBe('yes')
  })
})

describe('filterParams / hasActiveFilters', () => {
  it('omits inactive filters', () => {
    expect(filterParams(NO_FILTERS)).toEqual([])
    expect(hasActiveFilters(NO_FILTERS)).toBe(false)
  })

  it('round-trips through the parser', () => {
    const f = { recommend: 'yes' as const, withText: true, tag: 'বোর্ডে_বোঝান' }
    expect(hasActiveFilters(f)).toBe(true)
    expect(parseCourseReviewFilters(Object.fromEntries(filterParams(f)), KNOWN)).toEqual(f)
  })
})

describe('filterWhere', () => {
  it('maps each filter onto a Prisma condition', () => {
    expect(filterWhere(NO_FILTERS)).toEqual({})
    expect(filterWhere({ recommend: 'no', withText: true, tag: 'সহজলভ্য' })).toEqual({
      wouldRecommend: false,
      reviewText: { not: null },
      tags: { has: 'সহজলভ্য' },
    })
  })
})
