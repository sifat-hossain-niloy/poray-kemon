// ─────────────────────────────────────────────────────────────────────────────
// GET /api/departments/search?q=&university_id=
//
// Live typeahead used by the review form's department picker. We require a
// university_id so the dropdown is scoped — searching globally would return
// hundreds of "CSE" rows.
//
// Verified rows rank above unverified ones, then by review activity, then by
// trgm score. This means seed-curated departments and admin-confirmed merge
// targets surface first; user-contributed duplicates fall to the bottom and
// are easier for admins to find and merge.
//
// Public — no auth, no tracking. Same anonymity stance as the rest of the
// read path.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export interface DepartmentSearchHit {
  id: number
  slug: string | null
  name_en: string
  name_bn: string | null
  short_name: string | null
  status: 'verified' | 'unverified'
  professor_count: number
}

interface RawRow {
  id: number
  slug: string | null
  name_en: string
  name_bn: string | null
  short_name: string | null
  status: 'verified' | 'unverified'
  professor_count: bigint
  score: number
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  const universityId = Number(searchParams.get('university_id') ?? '')
  const limit = Math.min(Number(searchParams.get('limit') ?? 8), 20)

  if (!Number.isInteger(universityId)) {
    return NextResponse.json({ results: [] })
  }

  // q.length === 0 still returns the department list for this uni so the
  // dropdown can show options as soon as the input is focused. The trgm
  // filter only kicks in once the user has typed something meaningful.
  const ilike = q.length > 0 ? `%${q}%` : '%'

  const rows = await db.$queryRaw<RawRow[]>`
    SELECT d.id,
           d.slug,
           d.name_en,
           d.name_bn,
           d.short_name,
           d.status::text AS status,
           COUNT(DISTINCT p.id)::bigint AS professor_count,
           CASE
             WHEN ${q} = '' THEN 1.0
             ELSE GREATEST(
               similarity(d.name_en, ${q}),
               COALESCE(similarity(d.name_bn, ${q}), 0),
               COALESCE(similarity(d.short_name, ${q}), 0)
             )
           END::float AS score
      FROM departments d
      LEFT JOIN professors p ON p.department_id = d.id
     WHERE d.university_id = ${universityId}
       AND (
            ${q} = ''
         OR d.name_en   ILIKE ${ilike}
         OR d.name_bn   ILIKE ${ilike}
         OR d.short_name ILIKE ${ilike}
         OR similarity(d.name_en, ${q}) > 0.3
         OR similarity(d.short_name, ${q}) > 0.3
       )
     GROUP BY d.id
     ORDER BY (d.status = 'verified') DESC, score DESC, professor_count DESC, d.name_en ASC
     LIMIT ${limit}
  `

  const results: DepartmentSearchHit[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name_en: r.name_en,
    name_bn: r.name_bn,
    short_name: r.short_name,
    status: r.status,
    professor_count: Number(r.professor_count),
  }))

  return NextResponse.json({ results })
}
