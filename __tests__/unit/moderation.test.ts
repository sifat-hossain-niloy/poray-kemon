import { describe, it, expect } from 'vitest'
import { moderate } from '@/lib/moderation'

describe('moderate', () => {
  it('passes empty / null / undefined input', () => {
    expect(moderate(null).kind).toBe('pass')
    expect(moderate(undefined).kind).toBe('pass')
    expect(moderate('').kind).toBe('pass')
    expect(moderate('   ').kind).toBe('pass')
  })

  it('passes a normal review', () => {
    expect(moderate('Great teacher. Clear explanations and fair grading.').kind).toBe('pass')
  })

  // ── Hard block ────────────────────────────────────────────────────────────

  it('hard-blocks English profanity (whole word)', () => {
    const v = moderate('This teacher is shit honestly.')
    expect(v.kind).toBe('hard_block')
    if (v.kind === 'hard_block') {
      expect(v.reason).toContain('profanity_en')
    }
  })

  it('does NOT hard-block on substrings of inoffensive words', () => {
    // "shitake" should not match "shit" as a whole word
    expect(moderate('She mentioned shitake mushrooms in class for the example.').kind).toBe('pass')
  })

  it('hard-blocks Bangla profanity', () => {
    const v = moderate('উনি একদম খানকি স্বভাবের।')
    expect(v.kind).toBe('hard_block')
    if (v.kind === 'hard_block') {
      expect(v.reason).toContain('profanity_bn')
    }
  })

  it('hard-blocks slurs', () => {
    const v = moderate('এই কাফের শিক্ষকটি ভয়ংকর।')
    expect(v.kind).toBe('hard_block')
    if (v.kind === 'hard_block') {
      expect(v.reason).toContain('slur')
    }
  })

  it('hard-blocks bribery accusations', () => {
    const v = moderate('I heard he took bribes from students last year.')
    expect(v.kind).toBe('hard_block')
    if (v.kind === 'hard_block') {
      expect(v.reason).toContain('accusation')
    }
  })

  it('hard-blocks Bangla bribery accusations', () => {
    const v = moderate('উনি ঘুষ নেন বলে সবাই জানে।')
    expect(v.kind).toBe('hard_block')
  })

  it('hard-blocks sexual harassment accusations', () => {
    const v = moderate('He sexually harasses students.')
    expect(v.kind).toBe('hard_block')
  })

  // ── Soft flag ─────────────────────────────────────────────────────────────

  it('soft-flags very short text', () => {
    const v = moderate('Bad teacher.')
    expect(v.kind).toBe('soft_flag')
    if (v.kind === 'soft_flag') expect(v.reason).toBe('too_short')
  })

  it('soft-flags all-caps text', () => {
    const v = moderate('THIS COURSE WAS A COMPLETE WASTE OF TIME FROM START TO FINISH')
    expect(v.kind).toBe('soft_flag')
    if (v.kind === 'soft_flag') expect(v.reason).toBe('all_caps')
  })

  it('does not flag normal capitalised proper nouns as all-caps', () => {
    expect(moderate('Dr. Rahman explains things using examples from BUET projects.').kind).toBe(
      'pass',
    )
  })

  it('soft-flags 3+ exclamation marks', () => {
    const v = moderate('Worst experience ever this semester honestly!!!')
    expect(v.kind).toBe('soft_flag')
    if (v.kind === 'soft_flag') expect(v.reason).toBe('high_emotion')
  })

  it('soft-flags grudge phrasing', () => {
    const v = moderate('He ruined my entire semester for no good reason at all.')
    expect(v.kind).toBe('soft_flag')
    if (v.kind === 'soft_flag') expect(v.reason).toContain('grudge')
  })

  it('hard-block beats soft-flag (profanity wins over all-caps)', () => {
    const v = moderate('THIS PROFESSOR IS SHIT AND EVERYONE KNOWS IT')
    expect(v.kind).toBe('hard_block')
  })
})
