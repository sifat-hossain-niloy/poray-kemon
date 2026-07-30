import type { Metadata, Viewport } from 'next'
import { Hind_Siliguri, Geist_Mono } from 'next/font/google'
import { SessionProvider } from 'next-auth/react'
import { Navbar } from '@/components/layout/Navbar'
import { LocaleProvider } from '@/lib/i18n/client'
import { getLocale, getStrings } from '@/lib/i18n'
import { getAdminSession } from '@/lib/admin-auth'
import './globals.css'
import { cn } from '@/lib/utils'

// Hind Siliguri covers Bengali AND Latin natively — use it as --font-sans so
// every shadcn component renders cleanly in either locale.
const hindSiliguri = Hind_Siliguri({
  variable: '--font-sans',
  subsets: ['bengali', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
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
  const [locale, staff] = await Promise.all([getLocale(), getAdminSession()])
  const isStaff = staff !== null

  return (
    <html
      lang={locale}
      className={cn('h-full antialiased', hindSiliguri.variable, geistMono.variable)}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <SessionProvider>
          <LocaleProvider locale={locale}>
            <Navbar isStaff={isStaff} />
            <div className="flex flex-1 flex-col">{children}</div>
          </LocaleProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
