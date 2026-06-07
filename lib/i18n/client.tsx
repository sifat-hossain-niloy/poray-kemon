'use client'

// Client-side locale provider + hooks. Imports only from `./shared` — never
// from `./index` — so we don't drag `next/headers` into the client bundle.

import { createContext, useContext } from 'react'
import { stringsFor, type Locale } from './shared'

interface LocaleContextValue {
  locale: Locale
  strings: ReturnType<typeof stringsFor>
}

const LocaleContext = createContext<LocaleContextValue | null>(null)

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale
  children: React.ReactNode
}) {
  const strings = stringsFor(locale)
  return <LocaleContext.Provider value={{ locale, strings }}>{children}</LocaleContext.Provider>
}

export function useLocale(): Locale {
  const ctx = useContext(LocaleContext)
  return ctx?.locale ?? 'bn'
}

export function useStrings() {
  const ctx = useContext(LocaleContext)
  return ctx?.strings ?? stringsFor('bn')
}
