import Link from 'next/link'
import { getLocale, getStrings } from '@/lib/i18n'

// Footer doubles as internal-linking scaffolding — every public page carries
// a link to /about, /faq, and /blog which gives Google a consistent path in
// to those pages from anywhere in the catalog.
export async function Footer() {
  const [locale, strings] = await Promise.all([getLocale(), getStrings()])

  const explore = locale === 'en' ? 'Explore' : 'দেখুন'
  const learn = locale === 'en' ? 'Learn' : 'জানুন'
  const rights =
    locale === 'en'
      ? '© Poray Kemon. Anonymous, non-commercial, student-built.'
      : '© পড়ায় কেমন। বেনামী, অলাভজনক, শিক্ষার্থীদের তৈরি।'

  return (
    <footer className="border-t border-border mt-16">
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {strings.site.name}
            </p>
            <p className="text-sm text-foreground/80 leading-relaxed">{strings.site.tagline}</p>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {explore}
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/universities" className="hover:underline">
                  {strings.nav.universities}
                </Link>
              </li>
              <li>
                <Link href="/professors" className="hover:underline">
                  {locale === 'en' ? 'Professors' : 'শিক্ষকবৃন্দ'}
                </Link>
              </li>
              <li>
                <Link href="/reviews" className="hover:underline">
                  {locale === 'en' ? 'Recent reviews' : 'সাম্প্রতিক রিভিউ'}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {learn}
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/about" className="hover:underline">
                  {locale === 'en' ? 'About' : 'আমাদের সম্পর্কে'}
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:underline">
                  {locale === 'en' ? 'FAQ' : 'সাধারণ জিজ্ঞাসা'}
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:underline">
                  {locale === 'en' ? 'Blog' : 'ব্লগ'}
                </Link>
              </li>
              <li>
                <Link href="/guidelines" className="hover:underline">
                  {locale === 'en' ? 'Guidelines' : 'গাইডলাইন'}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <p className="mt-10 text-xs text-muted-foreground">{rights}</p>
      </div>
    </footer>
  )
}
