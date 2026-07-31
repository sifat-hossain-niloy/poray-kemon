'use client'

import Link, { type LinkProps } from 'next/link'
import { forwardRef, type AnchorHTMLAttributes } from 'react'
import { useLocale } from '@/lib/i18n/client'

// Drop-in replacement for next/link that prefixes internal hrefs with the
// active locale. Absolute URLs, hash-only links, and mailto:/tel: are passed
// through unchanged. Use this instead of <Link> for every internal navigation
// so browser URLs land on their locale-prefixed target directly (no extra
// middleware redirect hop).

type Props = Omit<LinkProps, 'href'> &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
    href: string
  }

function isExternalOrSpecial(href: string): boolean {
  if (!href) return true
  if (href.startsWith('#')) return true
  if (href.startsWith('mailto:') || href.startsWith('tel:')) return true
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(href)) return true
  return false
}

function alreadyLocalized(href: string): boolean {
  return /^\/(en|bn)(\/|$|\?|#)/.test(href)
}

export const LocaleLink = forwardRef<HTMLAnchorElement, Props>(function LocaleLink(
  { href, ...rest },
  ref,
) {
  const locale = useLocale()
  let finalHref = href
  if (!isExternalOrSpecial(href) && href.startsWith('/') && !alreadyLocalized(href)) {
    finalHref = `/${locale}${href === '/' ? '' : href}`
  }
  return <Link ref={ref} href={finalHref} {...rest} />
})
