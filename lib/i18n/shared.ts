// Pure i18n primitives — safe to import from BOTH server and client modules.
// No `next/headers` and no `'use client'` here.

import { BN } from './strings-bn'
import { EN } from './strings-en'

export type Locale = 'bn' | 'en'
export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_COOKIE_NAME = 'pk_lang'

export const STRING_BUNDLES = { bn: BN, en: EN } as const
export type { Strings } from './strings-bn'

export function isValidLocale(value: unknown): value is Locale {
  return value === 'bn' || value === 'en'
}

/** No cookie access — pass in the resolved locale. */
export function stringsFor(locale: Locale) {
  return STRING_BUNDLES[locale]
}

export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** NFR-PRIV-02: read-only visitors get no cookies. The locale cookie is
 *  written only when the visitor explicitly toggles language; after that,
 *  visiting the other locale's URL keeps the remembered choice in sync. */
export function shouldWriteLocaleCookie(existing: string | undefined, locale: Locale): boolean {
  return existing !== undefined && existing !== locale
}

/** Pick a locale for a first visit to an unprefixed URL from the browser's
 *  Accept-Language header, so Bangla-preferring browsers land on /bn without
 *  us storing anything. Honours q-values; ties keep header order. */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null
  const ranked = header
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';')
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
      const weight = q ? Number(q.slice(2)) : 1
      return { lang: tag.trim().toLowerCase().split('-')[0], weight, index }
    })
    .filter((x) => x.lang && Number.isFinite(x.weight) && x.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
  for (const { lang } of ranked) {
    if (isValidLocale(lang)) return lang
  }
  return null
}

/** Client-side cookie string for an explicit language choice. */
export function localeCookieString(locale: Locale, secure: boolean): string {
  return `${LOCALE_COOKIE_NAME}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax${secure ? '; Secure' : ''}`
}
