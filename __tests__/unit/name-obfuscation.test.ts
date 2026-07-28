import { describe, it, expect } from 'vitest'
import { obfuscateName, OBFUSCATION_MAP } from '@/lib/name-obfuscation'

describe('obfuscateName', () => {
  it('maps a/A to @', () => {
    expect(obfuscateName('a')).toBe('@')
    expect(obfuscateName('A')).toBe('@')
    expect(obfuscateName('Rahman')).toBe('R@hm@n')
  })

  it('maps both l/L and i/I to ! (collision is intentional)', () => {
    expect(obfuscateName('l')).toBe('!')
    expect(obfuscateName('L')).toBe('!')
    expect(obfuscateName('i')).toBe('!')
    expect(obfuscateName('I')).toBe('!')
    expect(obfuscateName('Lil')).toBe('!!!')
    expect(obfuscateName('Ill')).toBe('!!!')
    expect(obfuscateName('Ali')).toBe('@!!')
  })

  it('leaves other characters untouched', () => {
    expect(obfuscateName('Mohammad Rahman')).toBe('Moh@mm@d R@hm@n')
    expect(obfuscateName('Dr. Kabir')).toBe('Dr. K@b!r')
    expect(obfuscateName('Rifat Ali')).toBe('R!f@t @!!')
  })

  it('handles the user example verbatim', () => {
    // From the spec: "Therap" → "Ther@p"
    expect(obfuscateName('Therap')).toBe('Ther@p')
  })

  it('is idempotent — running the result again is a no-op', () => {
    const once = obfuscateName('Mohammad Rahman')
    expect(obfuscateName(once)).toBe(once)
  })

  it('preserves length', () => {
    const names = ['Rahman', 'Ali', 'A. B. C. D.', 'Md Fahim Arefin']
    for (const n of names) expect(obfuscateName(n).length).toBe(n.length)
  })

  it('passes null / undefined / empty through as empty string', () => {
    expect(obfuscateName(null)).toBe('')
    expect(obfuscateName(undefined)).toBe('')
    expect(obfuscateName('')).toBe('')
  })

  it('does NOT obfuscate other vowels or consonants', () => {
    // Explicit list — verifies we haven't over-obfuscated
    expect(obfuscateName('eou')).toBe('eou')
    expect(obfuscateName('EOU')).toBe('EOU')
    expect(obfuscateName('brc')).toBe('brc')
  })

  it('leaves non-Latin characters (Bangla, symbols) intact', () => {
    expect(obfuscateName('মোহাম্মদ রহমান')).toBe('মোহাম্মদ রহমান')
    expect(obfuscateName('Dr. R@hm@n')).toBe('Dr. R@hm@n')
  })

  it('exports the map read-only', () => {
    expect(OBFUSCATION_MAP.a).toBe('@')
    expect(OBFUSCATION_MAP.L).toBe('!')
    // Frozen — attempts to mutate should not persist
    expect(() => {
      // @ts-expect-error runtime freeze check
      OBFUSCATION_MAP.a = 'x'
    }).toThrow()
  })
})
