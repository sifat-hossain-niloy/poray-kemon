// ─────────────────────────────────────────────────────────────────────────────
// POST /api/university-requests — reviewer-facing "please add this university" ticket
//
// Anyone with an authenticated session can file one. Unlike auto-created
// departments (FR-DIR-05), universities are gated behind admin approval —
// they're heavier, cross-cutting entities that we want a human to vet
// before adding to the public directory.
//
// Rate limiting:
//   - Duplicate detection: if the same user already has a pending request
//     for a name that normalizes to the same string, we return 409 with
//     the existing request id instead of creating a second row.
//   - Per-user cap: 5 pending requests at any one time — hard-block until
//     the admin resolves some. Prevents drive-by spam.
//
// Also blocks the trivial case where the requested name is already a real
// university (400 with the existing slug so the client can redirect).
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { universityRequestCreateSchema } from '@/lib/validations/admin'

export const dynamic = 'force-dynamic'

const MAX_PENDING_PER_USER = 5

function normalise(name: string): string {
  return name.toLowerCase().replace(/&/g, 'and').replace(/[-,.]/g, ' ').replace(/\s+/g, ' ').trim()
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Sign in to request a new university', code: 'UNAUTHENTICATED' },
      { status: 401 },
    )
  }
  const userId = session.user.id

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = universityRequestCreateSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    )
  }
  const data = parsed.data
  const norm = normalise(data.nameEn)

  // Block if the university already exists — the user probably didn't scroll
  // the typeahead long enough. Return the slug so the client can redirect.
  const existing = await db.university.findFirst({
    where: {
      OR: [
        { nameEn: { equals: data.nameEn, mode: 'insensitive' } },
        { shortName: { equals: data.nameEn, mode: 'insensitive' } },
      ],
    },
    select: { id: true, slug: true, nameEn: true, shortName: true },
  })
  if (existing) {
    return NextResponse.json(
      {
        error: 'This university already exists',
        code: 'ALREADY_EXISTS',
        university: existing,
      },
      { status: 409 },
    )
  }

  // Dedup against this user's own pending requests (case- and formatting-
  // insensitive). We compare in JS instead of SQL because the normalization
  // rule ("&" → "and", strip punctuation) is easier to keep in one place.
  const userRequests = await db.universityRequest.findMany({
    where: { userId, status: 'pending' },
    select: { id: true, nameEn: true },
  })

  const dup = userRequests.find((r) => normalise(r.nameEn) === norm)
  if (dup) {
    return NextResponse.json(
      {
        error: 'You already have a pending request for this university',
        code: 'DUPLICATE_REQUEST',
        request_id: dup.id,
      },
      { status: 409 },
    )
  }
  if (userRequests.length >= MAX_PENDING_PER_USER) {
    return NextResponse.json(
      {
        error: `You already have ${MAX_PENDING_PER_USER} pending requests. Please wait for an admin to review them.`,
        code: 'TOO_MANY_PENDING',
      },
      { status: 429 },
    )
  }

  const request = await db.universityRequest.create({
    data: {
      userId,
      nameEn: data.nameEn,
      nameBn: data.nameBn?.trim() || null,
      type: data.type,
    },
    select: { id: true, nameEn: true, type: true, status: true, createdAt: true },
  })

  return NextResponse.json({ request }, { status: 201 })
}
