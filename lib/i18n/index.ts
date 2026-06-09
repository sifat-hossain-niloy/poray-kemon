// ─────────────────────────────────────────────────────────────────────────────
// Server-only locale helpers.
//
// Importing this file pulls in `next/headers`, so client components must NOT
// import from here. Use `lib/i18n/client` (provider + hooks) or
// `lib/i18n/shared` (pure helpers) on the client side instead.
// ─────────────────────────────────────────────────────────────────────────────

import { cookies } from 'next/headers'
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

/** Server-only: read the locale cookie, returning the default if missing/invalid.
 *  Tolerates contexts where the cookies() store is unavailable (e.g. integration
 *  tests calling route handlers directly) by falling back to the default.
 */
export async function getLocale(): Promise<Locale> {
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
