import { describe, it, expect } from 'vitest'
import {
  currentSemester,
  isFutureSemester,
  isSemesterTerm,
  semesterLabel,
  semesterOrdinal,
  semesterTrend,
  semesterYearOptions,
} from '@/lib/semester'

describe('semester helpers', () => {
  it('labels terms in both locales', () => {
    expect(semesterLabel('fall', 2025, 'en')).toBe('Fall 2025')
    expect(semesterLabel('spring', 2026, 'bn')).toBe('বসন্ত ২০২৬')
  })

  it('orders terms chronologically across years', () => {
    expect(semesterOrdinal('fall', 2025)).toBeLessThan(semesterOrdinal('spring', 2026))
    expect(semesterOrdinal('spring', 2026)).toBeLessThan(semesterOrdinal('summer', 2026))
  })

  it('narrows unknown values', () => {
    expect(isSemesterTerm('fall')).toBe(true)
    expect(isSemesterTerm('autumn')).toBe(false)
    expect(isSemesterTerm(3)).toBe(false)
  })

  it('offers the current year and six back, newest first', () => {
    const years = semesterYearOptions(new Date('2026-10-23T00:00:00Z'))
    expect(years[0]).toBe(2026)
    expect(years).toHaveLength(7)
    expect(years.at(-1)).toBe(2020)
  })

  it('maps months to terms and flags future semesters', () => {
    const oct = new Date('2026-10-23T00:00:00Z')
    expect(currentSemester(oct)).toEqual({ term: 'fall', year: 2026 })
    expect(currentSemester(new Date('2026-02-01T00:00:00Z')).term).toBe('spring')
    expect(currentSemester(new Date('2026-06-01T00:00:00Z')).term).toBe('summer')
    expect(isFutureSemester('fall', 2026, oct)).toBe(false)
    expect(isFutureSemester('spring', 2027, oct)).toBe(true)
  })
})

describe('semesterTrend', () => {
  const b = (term: 'spring' | 'summer' | 'fall', year: number, count: number, avg = 3) => ({
    term,
    year,
    count,
    avgTeaching: avg,
  })

  it('sorts chronologically and drops thin terms', () => {
    const out = semesterTrend([b('fall', 2025, 4), b('spring', 2025, 3), b('summer', 2025, 1)])
    expect(out.map((t) => `${t.term}-${t.year}`)).toEqual(['spring-2025', 'fall-2025'])
  })

  it('returns nothing when fewer than two terms qualify', () => {
    expect(semesterTrend([b('fall', 2025, 9), b('spring', 2026, 1)])).toEqual([])
  })
})
