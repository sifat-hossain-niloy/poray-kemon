// ─────────────────────────────────────────────────────────────────────────────
// GET /api/universities/search?q=&limit=
//
// Live typeahead used by the review form's university field. pg_trgm + ILIKE
// over short_name and name_en. Empty q returns the full list (capped) so
// the dropdown is useful on focus — same UX pattern as the other typeaheads.
//
// The user's fallback path when no match surfaces is `POST /api/university-
// requests` — that route creates a "please add this" ticket for admin review.
// Unlike departments, we do NOT auto-create universities.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export interface UniversitySearchHit {
  id: number
  slug: string
  name_en: string
  name_bn: string | null
  short_name: string
  type: 'public' | 'private' | 'international'
  location_city: string | null
}

interface RawRow {
  id: number
  slug: string
  name_en: string
  name_bn: string | null
  short_name: string
  type: 'public' | 'private' | 'international'
  location_city: string | null
  score: number
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  const limit = Math.min(Number(searchParams.get('limit') ?? 8), 30)

  const ilike = q.length > 0 ? `%${q}%` : '%'

  const rows = await db.$queryRaw<RawRow[]>`
    SELECT u.id,
           u.slug,
           u.name_en,
           u.name_bn,
           u.short_name,
           u.type::text AS type,
           u.location_city,
           CASE
             WHEN ${q} = '' THEN 1.0
             ELSE GREATEST(
               similarity(u.short_name, ${q}),
               similarity(u.name_en, ${q}),
               COALESCE(similarity(u.name_bn, ${q}), 0)
             )
           END::float AS score
      FROM universities u
     WHERE ${q} = ''
        OR u.short_name ILIKE ${ilike}
        OR u.name_en ILIKE ${ilike}
        OR u.name_bn ILIKE ${ilike}
        OR similarity(u.short_name, ${q}) > 0.3
        OR similarity(u.name_en, ${q}) > 0.3
     ORDER BY score DESC, u.short_name ASC
     LIMIT ${limit}
  `

  const results: UniversitySearchHit[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name_en: r.name_en,
    name_bn: r.name_bn,
    short_name: r.short_name,
    type: r.type,
    location_city: r.location_city,
  }))

  return NextResponse.json({ results })
}
