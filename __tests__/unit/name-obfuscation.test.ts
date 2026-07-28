import { describe, it, expect } from 'vitest'
import { obfuscateName, OBFUSCATION_MAP } from '@/lib/name-obfuscation'

describe('obfuscateName', () => {
  it('maps lowercase a to @, but leaves uppercase A alone', () => {
    expect(obfuscateName('a')).toBe('@')
    expect(obfuscateName('A')).toBe('A')
    // The classic test — name starting with A stays readable
    expect(obfuscateName('Abdul')).toBe('Abdu!')
    expect(obfuscateName('Ali')).toBe('A!!')
  })

  it('maps both l/L and i/I to ! (collision is intentional)', () => {
    expect(obfuscateName('l')).toBe('!')
    expect(obfuscateName('L')).toBe('!')
    expect(obfuscateName('i')).toBe('!')
    expect(obfuscateName('I')).toBe('!')
    expect(obfuscateName('Lil')).toBe('!!!')
    expect(obfuscateName('Ill')).toBe('!!!')
  })

  it('maps lowercase e to 3, but leaves uppercase E alone', () => {
    expect(obfuscateName('e')).toBe('3')
    expect(obfuscateName('E')).toBe('E')
    expect(obfuscateName('Ehsan')).toBe('Eh$@n')
  })

  it('maps lowercase o to 0, but leaves uppercase O alone', () => {
    expect(obfuscateName('o')).toBe('0')
    expect(obfuscateName('O')).toBe('O')
    expect(obfuscateName('Osman')).toBe('O$m@n')
  })

  it('maps lowercase s to $, but leaves uppercase S alone', () => {
    expect(obfuscateName('s')).toBe('$')
    expect(obfuscateName('S')).toBe('S')
    expect(obfuscateName('Salauddin')).toBe('S@!@udd!n')
  })

  it('maps lowercase t to 7, but leaves uppercase T alone', () => {
    expect(obfuscateName('t')).toBe('7')
    expect(obfuscateName('T')).toBe('T')
    expect(obfuscateName('Tanvir')).toBe('T@nv!r')
  })

  it('handles the user example — "Therap" → "Th3r@p"', () => {
    expect(obfuscateName('Therap')).toBe('Th3r@p')
  })

  it('combines all substitutions in a full name', () => {
    expect(obfuscateName('Md Fahim Arefin')).toBe('Md F@h!m Ar3f!n')
    expect(obfuscateName('Mohammad Rahman')).toBe('M0h@mm@d R@hm@n')
    expect(obfuscateName('Dr. Kabir')).toBe('Dr. K@b!r')
  })

  it('is idempotent — running the result again is a no-op', () => {
    const once = obfuscateName('Mohammad Rahman Tuhin')
    expect(obfuscateName(once)).toBe(once)
  })

  it('preserves length', () => {
    const names = ['Rahman', 'Ali', 'A. B. C. D.', 'Md Fahim Arefin', 'Salauddin Tuhin']
    for (const n of names) expect(obfuscateName(n).length).toBe(n.length)
  })

  it('passes null / undefined / empty through as empty string', () => {
    expect(obfuscateName(null)).toBe('')
    expect(obfuscateName(undefined)).toBe('')
    expect(obfuscateName('')).toBe('')
  })

  it('does NOT obfuscate letters outside the map', () => {
    // Consonants explicitly excluded — verifies we haven't over-obfuscated
    expect(obfuscateName('bcdfghjkmnpqruvwxyz')).toBe('bcdfghjkmnpqruvwxyz')
    // Uppercase counterparts of the new (e/o/s/t) mappings stay as-is
    expect(obfuscateName('BEOSTU')).toBe('BEOSTU')
    // Lowercase 'u' stays (not in the map)
    expect(obfuscateName('u')).toBe('u')
  })

  it('leaves non-Latin characters (Bangla, symbols, digits) intact', () => {
    expect(obfuscateName('মোহাম্মদ রহমান')).toBe('মোহাম্মদ রহমান')
    expect(obfuscateName('Dr. R@hm@n')).toBe('Dr. R@hm@n')
    expect(obfuscateName('Prof. 007')).toBe('Pr0f. 007')
  })

  it('exports the map read-only', () => {
    expect(OBFUSCATION_MAP.a).toBe('@')
    expect(OBFUSCATION_MAP.L).toBe('!')
    expect(OBFUSCATION_MAP.e).toBe('3')
    // Freeze check — attempts to mutate throw in strict mode (which vitest
    // enables by default via TS module compilation).
    expect(() => {
      // @ts-expect-error runtime freeze check
      OBFUSCATION_MAP.a = 'x'
    }).toThrow()
  })
})
