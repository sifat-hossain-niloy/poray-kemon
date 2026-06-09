// ─────────────────────────────────────────────────────────────────────────────
// POST   /api/reviews/[id]/helpful  — toggle the current user's helpful vote
// GET    /api/reviews/[id]/helpful  — return { helpful_count, voted }
//
// Auth required for both. The vote table (`helpful_votes`) carries `user_id`
// — that's fine for votes because votes are not anonymous, only reviews are.
// The unique key `(user_id, review_id)` guarantees one vote per user per
// review; toggling DELETEs the existing row.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getStrings } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

interface RouteContext {
  params: Promise<{ id: string }>
}

function parseReviewId(raw: string): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

// ── GET — read current state ─────────────────────────────────────────────────

export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params
  const reviewId = parseReviewId(id)
  if (!reviewId) {
    return NextResponse.json({ error: 'Invalid review id' }, { status: 400 })
  }

  const session = await auth()

  const review = await db.review.findUnique({
    where: { id: reviewId },
    select: { helpfulCount: true },
  })
  if (!review) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  }

  let voted = false
  if (session?.user?.id) {
    const vote = await db.helpfulVote.findUnique({
      where: { userId_reviewId: { userId: session.user.id, reviewId } },
      select: { id: true },
    })
    voted = !!vote
  }

  return NextResponse.json({ helpful_count: review.helpfulCount, voted })
}

// ── POST — toggle the vote ───────────────────────────────────────────────────

export async function POST(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params
  const reviewId = parseReviewId(id)
  if (!reviewId) {
    return NextResponse.json({ error: 'Invalid review id' }, { status: 400 })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: (await getStrings()).errors.unauthorized, code: 'UNAUTHENTICATED' },
      { status: 401 },
    )
  }
  const userId = session.user.id

  // Confirm review exists before mutating
  const review = await db.review.findUnique({
    where: { id: reviewId },
    select: { id: true },
  })
  if (!review) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 })
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.helpfulVote.findUnique({
        where: { userId_reviewId: { userId, reviewId } },
        select: { id: true },
      })

      if (existing) {
        // ── Un-vote ────────────────────────────────────────────────────────
        await tx.helpfulVote.delete({ where: { id: existing.id } })
        const updated = await tx.review.update({
          where: { id: reviewId },
          data: { helpfulCount: { decrement: 1 } },
          select: { helpfulCount: true },
        })
        // Defensive floor — shouldn't be needed if writes are consistent,
        // but keeps the public counter sane if something ever drifts.
        const safeCount = Math.max(0, updated.helpfulCount)
        return { voted: false, helpful_count: safeCount }
      }

      // ── Vote ─────────────────────────────────────────────────────────────
      await tx.helpfulVote.create({ data: { userId, reviewId } })
      const updated = await tx.review.update({
        where: { id: reviewId },
        data: { helpfulCount: { increment: 1 } },
        select: { helpfulCount: true },
      })
      return { voted: true, helpful_count: updated.helpfulCount }
    })

    return NextResponse.json(result)
  } catch (err) {
    // Two concurrent POSTs from the same user racing through the no-vote
    // branch can collide on the unique constraint. Treat as success — the
    // OTHER request already inserted the vote; recompute the current state.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const fresh = await db.review.findUnique({
        where: { id: reviewId },
        select: { helpfulCount: true },
      })
      return NextResponse.json({
        voted: true,
        helpful_count: fresh?.helpfulCount ?? 0,
      })
    }
    console.error('[reviews/:id/helpful] failed:', err)
    return NextResponse.json({ error: (await getStrings()).errors.serverError }, { status: 500 })
  }
}
