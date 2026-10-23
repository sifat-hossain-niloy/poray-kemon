import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from '@/lib/admin-auth'
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  isValidLocale,
  localeFromAcceptLanguage,
  shouldWriteLocaleCookie,
} from '@/lib/i18n/shared'

// Locale prefix regex: matches /en, /en/, /en/foo, /bn, /bn/... — captures
// the locale in group 1 and the rest of the path (with leading slash, or
// empty if the URL was just /en or /bn) in group 2.
const LOCALE_PATH_RE = /^\/(en|bn)(\/.*|$)/

// Paths that must NOT be locale-prefixed. Requests to these paths pass
// through without redirect or rewrite. Anything else is treated as a
// public UI route and gets a locale in the URL.
const NON_LOCALIZED_PREFIXES = [
  '/admin',
  '/moderator',
  '/api',
  '/_next',
  '/robots.txt',
  '/sitemap.xml',
  '/favicon.ico',
  '/icon.png',
  '/apple-icon.png',
  '/manifest.webmanifest',
]

function isNonLocalized(pathname: string): boolean {
  return NON_LOCALIZED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p),
  )
}

function isProtectedAdminPath(pathname: string): boolean {
  if (pathname === '/admin/login') return false
  if (pathname === '/moderator/login') return false
  if (pathname === '/api/admin/login') return false
  return (
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/moderator' ||
    pathname.startsWith('/moderator/') ||
    pathname === '/api/admin' ||
    pathname.startsWith('/api/admin/')
  )
}

async function handleAdminAuth(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value
  const session = await verifyAdminSessionToken(token)
  if (session) return NextResponse.next()

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 })
  }
  const loginUrl = new URL('/admin/login', req.url)
  if (pathname !== '/admin') loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Admin/moderator auth first — locale routing does not apply to staff surfaces.
  if (isProtectedAdminPath(pathname)) return handleAdminAuth(req)

  // API and other non-localized paths are pass-through.
  if (isNonLocalized(pathname)) return NextResponse.next()

  const localeMatch = pathname.match(LOCALE_PATH_RE)
  if (localeMatch) {
    // The regex only captures en|bn; the guard narrows the type without a cast.
    const locale = isValidLocale(localeMatch[1]) ? localeMatch[1] : DEFAULT_LOCALE
    const rest = (localeMatch[2] as string | undefined) || '/'

    // Security: URLs like /en/admin/... must NOT be internally rewritten and
    // served — that would skip handleAdminAuth entirely and let a signed-in
    // regular user reach the admin panel just by prefixing the path with a
    // locale. Same for /en/api/admin/..., /en/moderator/..., and every
    // other non-localized surface. Strip the locale and redirect so the
    // request re-enters this proxy and takes the correct branch (admin
    // auth for staff paths, pass-through for other non-localized paths).
    if (isNonLocalized(rest)) {
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = rest
      return NextResponse.redirect(redirectUrl, 307)
    }

    // Legitimate locale-prefixed public URL. Rewrite internally so the
    // underlying route file (app/foo/...) serves the request while the
    // browser URL stays /{locale}/foo. Set x-locale on BOTH the request
    // (so RSC can read it via headers()) and the response headers.
    const rewriteUrl = req.nextUrl.clone()
    rewriteUrl.pathname = rest
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-locale', locale)
    const response = NextResponse.rewrite(rewriteUrl, {
      request: { headers: requestHeaders },
    })
    response.headers.set('x-locale', locale)
    // Only visitors who already opted in via the language toggle carry a
    // locale cookie; keep theirs in sync. Never mint one for a reader
    // (NFR-PRIV-02) — the URL already carries the locale.
    if (shouldWriteLocaleCookie(req.cookies.get(LOCALE_COOKIE_NAME)?.value, locale)) {
      response.cookies.set(LOCALE_COOKIE_NAME, locale, {
        path: '/',
        maxAge: LOCALE_COOKIE_MAX_AGE,
        sameSite: 'lax',
      })
    }
    return response
  }

  // No locale prefix on a public path — redirect to the remembered choice,
  // else the browser's language preference, else the default. 307
  // preserves method + body.
  const cookieLocale = req.cookies.get(LOCALE_COOKIE_NAME)?.value
  const target = isValidLocale(cookieLocale)
    ? cookieLocale
    : (localeFromAcceptLanguage(req.headers.get('accept-language')) ?? DEFAULT_LOCALE)
  const redirectUrl = req.nextUrl.clone()
  redirectUrl.pathname = `/${target}${pathname === '/' ? '' : pathname}`
  return NextResponse.redirect(redirectUrl, 307)
}

export const config = {
  // Match everything except Next internals and truly static assets. The
  // in-body isNonLocalized() check handles the rest.
  matcher: [
    '/((?!_next/static|_next/image|_next/data|favicon.ico|robots.txt|sitemap.xml|icon.png|apple-icon.png|manifest.webmanifest).*)',
  ],
}
