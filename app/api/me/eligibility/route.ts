// GET /api/me/eligibility?university_id=123
//
// Returns whether the signed-in user is allowed to submit a review for the
// given university, plus the required suffixes so the client can render a
// helpful inline message. Anonymous users get 401 — the review form gates
// itself behind sign-in already, so this is just defence in depth.

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { checkEligibility } from '@/lib/eligibility'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 })
  }

  const raw = new URL(req.url).searchParams.get('university_id')
  const universityId = raw ? Number(raw) : NaN
  if (!Number.isInteger(universityId) || universityId <= 0) {
    return NextResponse.json({ error: 'Bad university_id' }, { status: 400 })
  }

  const [uni, user] = await Promise.all([
    db.university.findUnique({
      where: { id: universityId },
      select: { shortName: true, emailDomainSuffixes: true },
    }),
    db.user.findUnique({ where: { id: session.user.id }, select: { emailDomain: true } }),
  ])

  if (!uni) return NextResponse.json({ error: 'Unknown university' }, { status: 404 })

  const verdict = checkEligibility(user?.emailDomain ?? null, uni.emailDomainSuffixes)
  return NextResponse.json({
    universityShortName: uni.shortName,
    requiredSuffixes: uni.emailDomainSuffixes,
    verdict,
    userDomain: user?.emailDomain ?? null,
  })
}
