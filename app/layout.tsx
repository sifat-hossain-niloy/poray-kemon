import type { Metadata, Viewport } from 'next'
import { Hind_Siliguri, Geist_Mono } from 'next/font/google'
import { SessionProvider } from 'next-auth/react'
import { Navbar } from '@/components/layout/Navbar'
import { STRINGS } from '@/lib/strings'
import './globals.css'
import { cn } from '@/lib/utils'

// Hind Siliguri covers Bengali AND Latin natively — use it as --font-sans so
// every shadcn component renders in Bangla without per-component overrides.
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

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${STRINGS.site.name} — পড়ায় কেমন`,
    template: `%s | ${STRINGS.site.name}`,
  },
  description: STRINGS.site.tagline,
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
    siteName: STRINGS.site.name,
    locale: 'bn_BD',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="bn" className={cn('h-full antialiased', hindSiliguri.variable, geistMono.variable)}>
      <body className="min-h-full flex flex-col bg-background text-foreground font-sans">
        <SessionProvider>
          <Navbar />
          <div className="flex flex-1 flex-col">{children}</div>
        </SessionProvider>
      </body>
    </html>
  )
}
