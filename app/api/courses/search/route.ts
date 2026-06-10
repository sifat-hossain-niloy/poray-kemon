// ─────────────────────────────────────────────────────────────────────────────
// GET /api/courses/search?q=&department_id=
//
// Live typeahead used by the review form's course-code + course-name pickers.
// Returns the top matching courses inside a single department — both fields
// share the same endpoint and hit the same rows; the search just looks at
// course_code AND course_name in one query.
//
// Selecting a hit on either side prepopulates both fields client-side, so
// the user can pick "CSE 301" and see "Data Structures" auto-fill (and vice
// versa). Both fields remain freely editable after selection — the user may
// be reviewing an unlisted variant of the same course.
//
// Public — no auth, no tracking. Same anonymity stance as the rest of the
// read path.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export interface CourseSearchHit {
  id: number
  course_code: string | null
  course_name: string
  slug: string | null
  review_count: number
}

interface RawRow {
  id: number
  course_code: string | null
  course_name: string
  slug: string | null
  review_count: bigint
  score: number
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  const departmentId = Number(searchParams.get('department_id') ?? '')
  const limit = Math.min(Number(searchParams.get('limit') ?? 8), 20)

  if (!Number.isInteger(departmentId)) {
    return NextResponse.json({ results: [] })
  }

  // Empty q still returns the dept's full course list (capped) so the
  // dropdown is useful on focus — same UX choice as DepartmentTypeahead.
  const ilike = q.length > 0 ? `%${q}%` : '%'

  const rows = await db.$queryRaw<RawRow[]>`
    SELECT c.id,
           c.course_code,
           c.course_name,
           c.slug,
           COALESCE(SUM(pc.review_count), 0)::bigint AS review_count,
           CASE
             WHEN ${q} = '' THEN 1.0
             ELSE GREATEST(
               COALESCE(similarity(c.course_code, ${q}), 0),
               similarity(c.course_name, ${q})
             )
           END::float AS score
      FROM courses c
      LEFT JOIN professor_courses pc ON pc.course_id = c.id
     WHERE c.department_id = ${departmentId}
       AND (
            ${q} = ''
         OR c.course_code ILIKE ${ilike}
         OR c.course_name ILIKE ${ilike}
         OR COALESCE(similarity(c.course_code, ${q}), 0) > 0.3
         OR similarity(c.course_name, ${q}) > 0.3
       )
     GROUP BY c.id
     ORDER BY score DESC, review_count DESC, c.course_code ASC NULLS LAST, c.course_name ASC
     LIMIT ${limit}
  `

  const results: CourseSearchHit[] = rows.map((r) => ({
    id: r.id,
    course_code: r.course_code,
    course_name: r.course_name,
    slug: r.slug,
    review_count: Number(r.review_count),
  }))

  return NextResponse.json({ results })
}
