// ─────────────────────────────────────────────────────────────────────────────
// GET /api/professors/search?q=...&university_id=...&department_id=...
//
// Live typeahead used by the review form's professor picker. We require both
// university and department so the dropdown is scoped — searching globally
// would be useless ("there are 12 Rahmans, which one is yours?").
//
// Reading is fully public — no auth, no tracking. Same anonymity stance as
// the rest of the read path.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export interface ProfessorSearchHit {
  id: number
  slug: string
  name_en: string
  name_bn: string | null
  designation: string | null
  review_count: number
}

interface RawRow {
  id: number
  slug: string
  name_en: string
  name_bn: string | null
  designation: string | null
  review_count: bigint
  score: number
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  const universityId = Number(searchParams.get('university_id') ?? '')
  const departmentId = Number(searchParams.get('department_id') ?? '')
  const limit = Math.min(Number(searchParams.get('limit') ?? 8), 20)

  if (!Number.isInteger(universityId) || !Number.isInteger(departmentId)) {
    return NextResponse.json({ results: [] })
  }
  if (q.length < 1) {
    return NextResponse.json({ results: [] })
  }

  const ilike = `%${q}%`

  // pg_trgm similarity ranks fuzzy matches; ILIKE catches substring hits even
  // when similarity is below the default threshold (short queries like "rah").
  const rows = await db.$queryRaw<RawRow[]>`
    SELECT p.id,
           p.slug,
           p.name_en,
           p.name_bn,
           p.designation::text AS designation,
           COALESCE(SUM(pc.review_count), 0)::bigint AS review_count,
           GREATEST(
             similarity(p.name_en, ${q}),
             COALESCE(similarity(p.name_bn, ${q}), 0)
           )::float AS score
      FROM professors p
      LEFT JOIN professor_courses pc ON pc.professor_id = p.id
     WHERE p.university_id = ${universityId}
       AND p.department_id = ${departmentId}
       AND (
            p.name_en ILIKE ${ilike}
         OR p.name_bn ILIKE ${ilike}
         OR similarity(p.name_en, ${q}) > 0.3
       )
     GROUP BY p.id
     ORDER BY score DESC, review_count DESC, p.name_en ASC
     LIMIT ${limit}
  `

  const results: ProfessorSearchHit[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name_en: r.name_en,
    name_bn: r.name_bn,
    designation: r.designation,
    review_count: Number(r.review_count),
  }))

  return NextResponse.json({ results })
}
