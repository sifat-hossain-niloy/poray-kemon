// ─────────────────────────────────────────────────────────────────────────────
// Server-only locale helpers.
//
// Importing this file pulls in `next/headers`, so client components must NOT
// import from here. Use `lib/i18n/client` (provider + hooks) or
// `lib/i18n/shared` (pure helpers) on the client side instead.
// ─────────────────────────────────────────────────────────────────────────────

import { cookies, headers } from 'next/headers'
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  isValidLocale,
  stringsFor,
  type Locale,
} from './shared'

export type { Locale, Strings } from './shared'
export {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  STRING_BUNDLES,
  isValidLocale,
  stringsFor,
} from './shared'

/** Server-only: resolve the active locale. Preferred source is the `x-locale`
 *  request header set by middleware when the URL is /{locale}/... For API
 *  routes and other paths not seen by the locale middleware, fall back to
 *  the pk_lang cookie, then the default. Tolerates test contexts where
 *  headers()/cookies() are unavailable.
 */
export async function getLocale(): Promise<Locale> {
  try {
    const h = await headers()
    const fromHeader = h.get('x-locale')
    if (isValidLocale(fromHeader)) return fromHeader
  } catch {}
  try {
    const jar = await cookies()
    const raw = jar.get(LOCALE_COOKIE_NAME)?.value
    return isValidLocale(raw) ? raw : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

/** Server-only: convenience that returns the active strings bundle. */
export async function getStrings() {
  const locale = await getLocale()
  return stringsFor(locale)
}
