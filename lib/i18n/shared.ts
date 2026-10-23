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

export interface PluralLabel {
  one: string
  other: string
}

/** English needs singular/plural; Bangla bundles repeat the same word. */
export function plural(n: number, label: PluralLabel): string {
  return n === 1 ? label.one : label.other
}
