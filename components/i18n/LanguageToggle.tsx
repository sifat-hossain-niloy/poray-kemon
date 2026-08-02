'use client'

import { useTransition } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useLocale, useStrings } from '@/lib/i18n/client'
import type { Locale } from '@/lib/i18n/shared'

// Rewrites the current URL so `/en/foo` becomes `/bn/foo` (and vice versa).
// Path-based locales mean each language has a distinct URL that Google can
// index separately.
export function LanguageToggle() {
  const locale = useLocale()
  const strings = useStrings()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  // Hard-navigate so the root layout re-runs on the server with the new
  // locale — a soft router.push() would leave <html lang> and the locale
  // context frozen at what the initial render produced.
  function setLocale(next: Locale) {
    if (next === locale) return
    const withoutLocale = pathname.replace(/^\/(en|bn)(?=\/|$)/, '') || '/'
    const query = searchParams.toString()
    const target = `/${next}${withoutLocale === '/' ? '' : withoutLocale}${query ? `?${query}` : ''}`
    startTransition(() => {
      window.location.assign(target)
    })
  }

  const labelBn = strings.nav.languageBangla
  const labelEn = strings.nav.languageEnglish

  return (
    <div
      role="group"
      aria-label={strings.nav.language}
      className="inline-flex items-center rounded-full border border-border bg-card p-0.5 text-xs"
    >
      <ToggleBtn
        active={locale === 'bn'}
        disabled={pending}
        onClick={() => setLocale('bn')}
        title={labelBn}
      >
        বাং
      </ToggleBtn>
      <ToggleBtn
        active={locale === 'en'}
        disabled={pending}
        onClick={() => setLocale('en')}
        title={labelEn}
      >
        EN
      </ToggleBtn>
    </div>
  )
}

function ToggleBtn({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active: boolean
  disabled: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={title}
      className={
        'rounded-full px-2 py-0.5 font-medium transition-colors disabled:opacity-50 ' +
        (active
          ? 'bg-primary text-primary-foreground'
          : 'text-muted-foreground hover:text-foreground')
      }
    >
      {children}
    </button>
  )
}
