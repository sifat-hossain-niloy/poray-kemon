'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useStrings } from '@/lib/i18n/client'
import type { Locale } from '@/lib/i18n/shared'

export function LanguageToggle() {
  const locale = useLocale()
  const strings = useStrings()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  async function setLocale(next: Locale) {
    if (next === locale) return
    try {
      await fetch('/api/locale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: next }),
      })
      startTransition(() => router.refresh())
    } catch (err) {
      console.error('locale toggle failed:', err)
    }
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
