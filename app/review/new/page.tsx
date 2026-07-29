import type { Metadata } from 'next'
import Link from 'next/link'
import { auth, signIn } from '@/lib/auth'
import { db } from '@/lib/db'
import { ReviewForm } from '@/components/review/ReviewForm'
import { getLocale, getStrings } from '@/lib/i18n'
import { isProfessorPublicId } from '@/lib/public-id'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// Shared shape for the "preselected professor" panel — extracted so the
// publicId and legacy-slug branches don't drift.
const preselectedProfessorSelect = {
  id: true,
  nameEn: true,
  universityId: true,
  departmentId: true,
  department: { select: { nameEn: true, shortName: true } },
  university: { select: { nameEn: true, shortName: true } },
} as const

export async function generateMetadata(): Promise<Metadata> {
  const strings = await getStrings()
  const locale = await getLocale()
  return {
    title: strings.review.formTitle,
    description:
      locale === 'en'
        ? 'Share your experience — fully anonymous'
        : 'নিজের অভিজ্ঞতা শেয়ার করুন — সম্পূর্ণ বেনামী',
    robots: { index: false },
  }
}

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ professor?: string }>
}

export default async function NewReviewPage({ searchParams }: PageProps) {
  const session = await auth()
  const { professor: preselectSlug } = await searchParams
  const [strings, locale] = await Promise.all([getStrings(), getLocale()])

  if (!session?.user?.id) {
    async function login() {
      'use server'
      await signIn('google', { redirectTo: '/review/new' })
    }
    return (
      <main className="mx-auto w-full max-w-md px-4 py-20">
        <Card>
          <CardContent className="space-y-4 py-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight">{strings.review.formTitle}</h1>
            <p className="text-muted-foreground">{strings.auth.signInToReview}</p>
            <form action={login}>
              <Button type="submit" className="mx-auto">
                {strings.auth.signInWithGoogle}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">{strings.review.anonymityNote}</p>
          </CardContent>
        </Card>
      </main>
    )
  }

  // All three pickers (university, department, professor) now fetch on the
  // client via their own /api/*/search endpoints. This page only pre-loads
  // the preselected professor's full context so the form can render its
  // locked-in cards without a client round-trip.
  //
  // The `?professor=<id>` param carries the opaque publicId. Legacy links
  // that still carry the name-slug also work — the fallback lookup makes
  // the transition period frictionless.
  const preselected = preselectSlug
    ? isProfessorPublicId(preselectSlug)
      ? await db.professor.findUnique({
          where: { publicId: preselectSlug },
          select: preselectedProfessorSelect,
        })
      : await db.professor.findUnique({
          where: { slug: preselectSlug },
          select: preselectedProfessorSelect,
        })
    : null

  const helpPrefix = locale === 'en' ? 'Need help? See ' : 'কোনো সমস্যা হলে? '
  const helpLink = locale === 'en' ? 'About us' : 'আমাদের সম্পর্কে'
  const helpSuffix = locale === 'en' ? '.' : ' দেখুন।'

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{strings.review.formTitle}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{strings.review.anonymityNote}</p>
      </div>

      <ReviewForm
        preselectedProfessor={preselected}
        displayName={session.user.name ?? ''}
        isAuthenticated
      />

      <p className="mt-8 text-center text-xs text-muted-foreground">
        {helpPrefix}
        <Link className="underline" href="/about">
          {helpLink}
        </Link>
        {helpSuffix}
      </p>
    </main>
  )
}
