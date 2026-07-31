// Metadata helper for per-page hreflang alternates. Every localized page
// canonicalizes to its own /{locale}/... URL and lists both language
// siblings under `alternates.languages`, plus an x-default pointing at EN.

const LOCALES = ['en', 'bn'] as const

export interface AlternatesResult {
  canonical: string
  languages: Record<string, string>
}

// Given a locale-neutral path like "/faq" or "/universities/du", returns
// the canonical URL for `activeLocale` plus the hreflang map that lists
// every locale variant.
export function localeAlternates(path: string, activeLocale: 'en' | 'bn'): AlternatesResult {
  const suffix = path === '/' ? '' : path
  const languages: Record<string, string> = {}
  for (const l of LOCALES) languages[l] = `/${l}${suffix}`
  languages['x-default'] = `/en${suffix}`
  return {
    canonical: `/${activeLocale}${suffix}`,
    languages,
  }
}
