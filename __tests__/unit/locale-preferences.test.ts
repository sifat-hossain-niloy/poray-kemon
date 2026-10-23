import { describe, it, expect } from 'vitest'
import {
  localeCookieString,
  localeFromAcceptLanguage,
  shouldWriteLocaleCookie,
} from '@/lib/i18n/shared'

describe('shouldWriteLocaleCookie', () => {
  it('never mints a cookie for a visitor who has none', () => {
    expect(shouldWriteLocaleCookie(undefined, 'en')).toBe(false)
    expect(shouldWriteLocaleCookie(undefined, 'bn')).toBe(false)
  })

  it('syncs an existing cookie only when the locale changed', () => {
    expect(shouldWriteLocaleCookie('en', 'en')).toBe(false)
    expect(shouldWriteLocaleCookie('en', 'bn')).toBe(true)
    expect(shouldWriteLocaleCookie('garbage', 'bn')).toBe(true)
  })
})

describe('localeFromAcceptLanguage', () => {
  it('returns null for a missing or unsupported header', () => {
    expect(localeFromAcceptLanguage(null)).toBeNull()
    expect(localeFromAcceptLanguage('')).toBeNull()
    expect(localeFromAcceptLanguage('fr-FR,de;q=0.8')).toBeNull()
  })

  it('matches region subtags', () => {
    expect(localeFromAcceptLanguage('bn-BD')).toBe('bn')
    expect(localeFromAcceptLanguage('en-US,en;q=0.9')).toBe('en')
  })

  it('honours q-values over header order', () => {
    expect(localeFromAcceptLanguage('en;q=0.5,bn;q=0.9')).toBe('bn')
  })

  it('keeps header order on ties and skips q=0', () => {
    expect(localeFromAcceptLanguage('bn,en')).toBe('bn')
    expect(localeFromAcceptLanguage('bn;q=0,en;q=0.3')).toBe('en')
  })
})

describe('localeCookieString', () => {
  it('adds Secure only on https', () => {
    expect(localeCookieString('bn', false)).toBe(
      'pk_lang=bn; Path=/; Max-Age=31536000; SameSite=Lax',
    )
    expect(localeCookieString('en', true)).toMatch(/; Secure$/)
  })
})
