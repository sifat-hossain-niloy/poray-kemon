import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { LOCALE_COOKIE_NAME, isValidLocale } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

// POST /api/locale  Body: { locale: 'bn' | 'en' }
// or form-encoded:  locale=bn
//
// Sets a year-long locale cookie. Public — no auth needed.
export async function POST(req: Request) {
  let locale: unknown
  const ct = req.headers.get('content-type') ?? ''
  if (ct.includes('application/json')) {
    const body = (await req.json().catch(() => null)) as { locale?: unknown } | null
    locale = body?.locale
  } else {
    const form = await req.formData().catch(() => null)
    locale = form?.get('locale')
  }

  if (!isValidLocale(locale)) {
    return NextResponse.json({ error: 'Invalid locale' }, { status: 400 })
  }

  const jar = await cookies()
  jar.set({
    name: LOCALE_COOKIE_NAME,
    value: locale,
    httpOnly: false, // readable from client too, so the toggle can pre-fill its state
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
  })

  return NextResponse.json({ ok: true, locale })
}
