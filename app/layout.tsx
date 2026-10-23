import type { Metadata, Viewport } from 'next'
import { Hind_Siliguri, Geist_Mono } from 'next/font/google'
import { SessionProvider } from 'next-auth/react'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { LocaleProvider } from '@/lib/i18n/client'
import { getLocale, getStrings } from '@/lib/i18n'
import { getAdminSession } from '@/lib/admin-auth'
import { auth } from '@/lib/auth'
import { THEME_INIT_SCRIPT } from '@/lib/theme'
import './globals.css'
import { cn } from '@/lib/utils'

// Hind Siliguri covers Bengali AND Latin natively — use it as --font-sans so
// every shadcn component renders cleanly in either locale.
//
// preload: false — preloading made every page fetch all weights x both
// subsets (~250 KB, more than all of the page's JS) at high priority before
// first paint, pushing mobile LCP to ~3 s. Without it the browser fetches
// only the faces a page renders (unicode-range picks Bengali vs Latin).
//
// display: 'optional' — with 'swap', a font arriving late re-renders the
// Bangla <h1> and Chrome records that as a new, later LCP (measured 2.7 s
// on /bn professor pages). 'optional' keeps the system fallback for that
// view if the font isn't ready within ~100 ms, and the now-cached font is
// used from the next navigation on. Weight 300 was never used and is gone.
const hindSiliguri = Hind_Siliguri({
  variable: '--font-sans',
  subsets: ['bengali', 'latin'],
  weight: ['400', '500', '600', '700'],
  display: 'optional',
  preload: false,
})

// Only staff pages and a few inline <code> spans use mono — never preload it.
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
  preload: false,
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://poraykemon.com'

// Metadata is resolved at request time too — pick the active locale's bundle.
export async function generateMetadata(): Promise<Metadata> {
  const strings = await getStrings()
  const locale = await getLocale()
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: `${strings.site.name} — পড়ায় কেমন`,
      template: `%s | ${strings.site.name}`,
    },
    description: strings.site.tagline,
    keywords: [
      'professor rating',
      'bangladesh university',
      'শিক্ষক রেটিং',
      'বিশ্ববিদ্যালয়',
      'BUET',
      'DU',
      'NSU',
      'BRAC',
    ],
    authors: [{ name: 'Poray Kemon' }],
    openGraph: {
      siteName: strings.site.name,
      locale: locale === 'en' ? 'en_US' : 'bn_BD',
      type: 'website',
    },
    twitter: { card: 'summary_large_image' },
    robots: { index: true, follow: true },
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [locale, staff, userSession] = await Promise.all([getLocale(), getAdminSession(), auth()])
  const isStaff = staff !== null
  // Every /api/auth/* response sets authjs.csrf-token and authjs.callback-url,
  // so SessionProvider's on-mount fetch handed each reader two cookies
  // (NFR-PRIV-02). A null session tells it there is nothing to fetch, and it
  // also skips the focus refetch. Signed-in users still get undefined: their
  // fetch rolls the JWT expiry forward and caches internalUserId in it, which
  // auth() in a server component cannot write back.
  const initialSession = userSession ? undefined : null

  return (
    // suppressHydrationWarning: THEME_INIT_SCRIPT adds `dark` to <html> before
    // React hydrates, so the server-rendered className can differ.
    <html
      lang={locale}
      className={cn('h-full antialiased', hindSiliguri.variable, geistMono.variable)}
      suppressHydrationWarning
    >
      <head>
        {/* Blocking on purpose: it must run before first paint or dark-mode
            visitors see a white flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <SessionProvider session={initialSession}>
          <LocaleProvider locale={locale}>
            <Navbar isStaff={isStaff} />
            <div className="flex flex-1 flex-col">{children}</div>
            <Footer />
          </LocaleProvider>
        </SessionProvider>
        {/* Vercel Analytics + Speed Insights. Both packages no-op outside
            Vercel deploys, so they add zero cost in local dev and preview. */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
