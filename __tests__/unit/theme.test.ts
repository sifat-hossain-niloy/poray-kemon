import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DARK_MEDIA_QUERY,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
  parseThemePreference,
  readStoredThemePreference,
  resolveTheme,
  storeThemePreference,
} from '@/lib/theme'

type ChangeListener = () => void

function stubMatchMedia(initiallyDark: boolean) {
  const listeners: ChangeListener[] = []
  const media = {
    matches: initiallyDark,
    media: DARK_MEDIA_QUERY,
    addEventListener: (_type: 'change', listener: ChangeListener) => listeners.push(listener),
    removeEventListener: vi.fn(),
  }
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  )
  return {
    setDark(next: boolean) {
      media.matches = next
      listeners.forEach((listener) => listener())
    },
  }
}

function runInitScript() {
  new Function(THEME_INIT_SCRIPT)()
}

function htmlIsDark() {
  return document.documentElement.classList.contains('dark')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  window.localStorage.clear()
  document.documentElement.classList.remove('dark')
})

describe('parseThemePreference', () => {
  it('accepts the explicit choices', () => {
    expect(parseThemePreference('light')).toBe('light')
    expect(parseThemePreference('dark')).toBe('dark')
    expect(parseThemePreference('system')).toBe('system')
  })

  it('falls back to system for missing or tampered values', () => {
    expect(parseThemePreference(null)).toBe('system')
    expect(parseThemePreference(undefined)).toBe('system')
    expect(parseThemePreference('')).toBe('system')
    expect(parseThemePreference('DARK')).toBe('system')
    expect(parseThemePreference('sepia')).toBe('system')
    expect(parseThemePreference(1)).toBe('system')
  })
})

describe('resolveTheme', () => {
  it('follows the OS when the preference is system', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('lets an explicit choice override the OS', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

describe('stored preference', () => {
  it('round-trips explicit choices and clears the key for system', () => {
    storeThemePreference('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(readStoredThemePreference()).toBe('dark')

    storeThemePreference('system')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
    expect(readStoredThemePreference()).toBe('system')
  })

  it('never writes a cookie', () => {
    storeThemePreference('dark')
    expect(document.cookie).toBe('')
  })

  it('degrades to system when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(storeThemePreference('dark')).toBe(false)
    expect(readStoredThemePreference()).toBe('system')
  })
})

describe('THEME_INIT_SCRIPT', () => {
  const stored = [null, 'light', 'dark', 'system', 'garbage'] as const

  for (const value of stored) {
    for (const osDark of [false, true]) {
      it(`matches resolveTheme for stored=${value} osDark=${osDark}`, () => {
        stubMatchMedia(osDark)
        if (value !== null) window.localStorage.setItem(THEME_STORAGE_KEY, value)
        runInitScript()
        const expected = resolveTheme(parseThemePreference(value), osDark)
        expect(htmlIsDark()).toBe(expected === 'dark')
      })
    }
  }

  it('tracks OS changes while the preference is system', () => {
    const media = stubMatchMedia(false)
    runInitScript()
    expect(htmlIsDark()).toBe(false)
    media.setDark(true)
    expect(htmlIsDark()).toBe(true)
  })

  it('ignores OS changes once the user picked a theme', () => {
    const media = stubMatchMedia(false)
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')
    runInitScript()
    media.setDark(true)
    expect(htmlIsDark()).toBe(false)
  })

  it('applies a choice made in another tab', () => {
    stubMatchMedia(false)
    runInitScript()
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY }))
    expect(htmlIsDark()).toBe(true)
  })

  it('follows the OS when storage is blocked', () => {
    stubMatchMedia(true)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(runInitScript).not.toThrow()
    expect(htmlIsDark()).toBe(true)
  })
})
