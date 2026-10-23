import { describe, it, expect } from 'vitest'
import { plural } from '@/lib/i18n/plural'
import { BN } from '@/lib/i18n/strings-bn'
import { EN } from '@/lib/i18n/strings-en'

describe('plural', () => {
  it('picks the singular only for exactly one', () => {
    expect(plural(1, EN.stats.reviews)).toBe('review')
    expect(plural(0, EN.stats.reviews)).toBe('reviews')
    expect(plural(2, EN.stats.reviews)).toBe('reviews')
  })

  it('stat labels never embed a number (the card renders it)', () => {
    for (const bundle of [EN, BN]) {
      for (const label of Object.values(bundle.stats)) {
        expect(label.one).not.toMatch(/[0-9০-৯]/)
        expect(label.other).not.toMatch(/[0-9০-৯]/)
      }
    }
  })
})
