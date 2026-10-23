// ─────────────────────────────────────────────────────────────────────────────
// /me — a signed-in user's own activity (SRS §4.8 FR-AUTH-05).
//
// Shows what the account is linked to and nothing more:
//   - which professor+course pairs it has reviewed (review_submissions)
//   - which reviews it marked helpful (helpful_votes)
//   - its university requests
// It deliberately cannot show "your reviews": nothing links a review to its
// author, so the page explains that instead of pretending otherwise.
// ─────────────────────────────────────────────────────────────────────────────

import type { Metadata } from 'next'
import { auth, signIn } from '@/lib/auth'
import { loadMyActivity } from '@/lib/my-activity'
import { getLocale, getStrings } from '@/lib/i18n'
import { LocaleLink as Link } from '@/components/i18n/LocaleLink'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DeleteAccountSection } from '@/components/account/DeleteAccountSection'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title: locale === 'en' ? 'My activity' : 'আমার কার্যক্রম',
    robots: { index: false },
  }
}

export default async function MyActivityPage() {
  const [session, strings, locale] = await Promise.all([auth(), getStrings(), getLocale()])
  const en = locale === 'en'
  const numberLocale = en ? 'en-US' : 'bn-BD'
  const dateFormatter = new Intl.DateTimeFormat(numberLocale, { dateStyle: 'medium' })

  const t = {
    title: en ? 'My activity' : 'আমার কার্যক্রম',
    signInPrompt: en
      ? 'Sign in to see the courses you have reviewed and the reviews you found helpful.'
      : 'যেসব কোর্সে রিভিউ দিয়েছেন এবং যেসব রিভিউ সহায়ক মনে করেছেন তা দেখতে সাইন ইন করুন।',
    anonHeading: en ? 'Why your reviews are not listed here' : 'আপনার রিভিউগুলো এখানে কেন নেই',
    anonBody: en
      ? 'We record that this account reviewed a professor and course, so it cannot review the same one twice. We never record which review it wrote, so we cannot show it to you, or to anyone else.'
      : 'এই অ্যাকাউন্ট কোন শিক্ষক ও কোর্সে রিভিউ দিয়েছে তা আমরা রাখি, যাতে একই কোর্সে দুবার রিভিউ দেওয়া না যায়। কোন রিভিউটি লিখেছে তা কখনো রাখি না, তাই আপনাকে বা অন্য কাউকে তা দেখানো সম্ভব নয়।',
    reviewed: en ? 'Courses you have reviewed' : 'যেসব কোর্সে রিভিউ দিয়েছেন',
    reviewedEmpty: en ? 'You have not reviewed any course yet.' : 'এখনো কোনো কোর্সে রিভিউ দেননি।',
    helpful: en ? 'Reviews you found helpful' : 'যেসব রিভিউ সহায়ক মনে করেছেন',
    helpfulEmpty: en
      ? 'Reviews you mark as helpful will show up here.'
      : 'সহায়ক হিসেবে চিহ্নিত রিভিউ এখানে দেখা যাবে।',
    removed: en ? 'This review has been removed' : 'রিভিউটি সরানো হয়েছে',
    requests: en ? 'University requests' : 'বিশ্ববিদ্যালয়ের অনুরোধ',
    requestStatus: {
      pending: en ? 'Pending' : 'অপেক্ষমাণ',
      approved: en ? 'Approved' : 'অনুমোদিত',
      rejected: en ? 'Not added' : 'যোগ হয়নি',
    },
    account: en ? 'Account' : 'অ্যাকাউন্ট',
    memberSince: (d: string) => (en ? `Member since ${d}` : `${d} থেকে সদস্য`),
    domain: (d: string) =>
      en ? `Signed in with an @${d} account` : `@${d} অ্যাকাউন্ট দিয়ে সাইন ইন করা`,
    privacy: en ? 'What we store about you' : 'আপনার সম্পর্কে আমরা কী রাখি',
    writeReview: strings.nav.writeReview,
  }

  if (!session?.user?.id) {
    async function login() {
      'use server'
      await signIn('google', { redirectTo: '/me' })
    }
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
        <h1 className="mb-4 text-3xl font-bold tracking-tight">{t.title}</h1>
        <Card>
          <CardContent className="space-y-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">{t.signInPrompt}</p>
            <form action={login}>
              <Button type="submit">{strings.auth.signInWithGoogle}</Button>
            </form>
          </CardContent>
        </Card>
      </main>
    )
  }

  const { user, reviewed, helpful, requests } = await loadMyActivity(session.user.id)

  const courseLabel = (c: { courseCode: string | null; courseName: string }) =>
    c.courseCode ? `${c.courseCode} · ${c.courseName}` : c.courseName

  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {strings.auth.signedInAs(session.user.name ?? '')}
          </p>
        </div>
        <Button render={<Link href="/review/new" />}>{t.writeReview}</Button>
      </header>

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="space-y-1 py-4 text-sm">
          <p className="font-medium">{t.anonHeading}</p>
          <p className="text-muted-foreground">{t.anonBody}</p>
        </CardContent>
      </Card>

      <Section title={t.reviewed} count={reviewed.length} numberLocale={numberLocale}>
        {reviewed.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.reviewedEmpty}</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {reviewed.map((r) => (
              <li key={r.id}>
                <Link
                  href={
                    r.course.slug
                      ? `/professors/${r.professor.publicId}/${r.course.slug}`
                      : `/professors/${r.professor.publicId}`
                  }
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3 hover:bg-muted"
                >
                  <span className="font-medium">{r.displayName}</span>
                  <span className="text-xs text-muted-foreground">
                    {courseLabel(r.course)} ·{' '}
                    {r.professor.department.shortName ?? r.professor.department.nameEn} ·{' '}
                    {r.professor.university.shortName}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t.helpful} count={helpful.length} numberLocale={numberLocale}>
        {helpful.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.helpfulEmpty}</p>
        ) : (
          <ul className="space-y-2">
            {helpful.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/professors/${v.professorPublicId}#r-${v.reviewId}`}
                  className="block rounded-lg border border-border px-4 py-3 hover:bg-muted"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{v.professorName}</span>
                    <span>{courseLabel(v.course)}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm">
                    {v.removed ? (
                      <span className="italic text-muted-foreground">{t.removed}</span>
                    ) : (
                      (v.reviewText ?? '—')
                    )}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {requests.length > 0 ? (
        <Section title={t.requests} count={requests.length} numberLocale={numberLocale}>
          <ul className="space-y-2">
            {requests.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">{r.nameEn}</p>
                  <p className="text-xs text-muted-foreground">
                    {dateFormatter.format(r.createdAt)}
                  </p>
                  {r.adminNote ? (
                    <p className="mt-1 text-xs text-muted-foreground">{r.adminNote}</p>
                  ) : null}
                </div>
                <Badge variant={r.status === 'approved' ? 'default' : 'outline'}>
                  {t.requestStatus[r.status]}
                </Badge>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t.account}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-muted-foreground">
          {user ? <p>{t.memberSince(dateFormatter.format(user.createdAt))}</p> : null}
          {user?.emailDomain ? <p>{t.domain(user.emailDomain)}</p> : null}
          <p>
            <Link href="/privacy" className="text-primary hover:underline">
              {t.privacy}
            </Link>
          </p>
        </CardContent>
      </Card>

      <DeleteAccountSection returnTo={`/${locale}/me#delete-account`} />
    </main>
  )
}

function Section({
  title,
  count,
  numberLocale,
  children,
}: {
  title: string
  count: number
  numberLocale: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Badge variant="secondary">{count.toLocaleString(numberLocale)}</Badge>
      </div>
      {children}
    </section>
  )
}
