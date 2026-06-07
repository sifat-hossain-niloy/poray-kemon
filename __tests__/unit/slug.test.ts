import { describe, it, expect } from 'vitest'
import { slugify, professorSlug, courseSlug } from '@/lib/slug'

describe('slugify', () => {
  it('lowercases ASCII text', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('replaces special characters with hyphens', () => {
    expect(slugify('Dr. Mohammad Rahman')).toBe('dr-mohammad-rahman')
    expect(slugify('A.K.M. Shahadat Hossain')).toBe('a-k-m-shahadat-hossain')
  })

  it('collapses repeated separators', () => {
    expect(slugify('foo___bar---baz')).toBe('foo-bar-baz')
  })

  it('trims leading/trailing separators', () => {
    expect(slugify('---hello---')).toBe('hello')
  })

  it('strips Bangla characters (URL-safety priority)', () => {
    expect(slugify('ড. মোহাম্মদ রহমান Rahman')).toBe('rahman')
  })

  it('returns empty string for non-alphanumeric-only input', () => {
    expect(slugify('!!! ??? ###')).toBe('')
    expect(slugify('   ')).toBe('')
  })
})

describe('professorSlug', () => {
  it('returns plain slug when no university provided', () => {
    expect(professorSlug('Dr. Rahman')).toBe('dr-rahman')
  })

  it('appends university short name when provided', () => {
    expect(professorSlug('Dr. Rahman', 'BUET')).toBe('dr-rahman-buet')
  })

  it('handles missing/empty university gracefully', () => {
    expect(professorSlug('Dr. Rahman', '')).toBe('dr-rahman')
  })
})

describe('courseSlug', () => {
  it('combines code and name', () => {
    expect(courseSlug('CSE 301', 'Data Structures')).toBe('cse-301-data-structures')
  })

  it('handles missing code', () => {
    expect(courseSlug(null, 'Data Structures')).toBe('data-structures')
    expect(courseSlug(undefined, 'Data Structures')).toBe('data-structures')
  })

  it('handles only-code input', () => {
    expect(courseSlug('CSE 301', '')).toBe('cse-301')
  })
})
