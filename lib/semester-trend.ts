// Query side of the professor-page semester trend; shaping is in lib/semester.ts.

import { db } from '@/lib/db'
import { semesterTrend } from '@/lib/semester'

/** Counted reviews only — the same set that feeds the aggregates — grouped
 *  by the optional semester the reviewer gave. */
export async function loadSemesterTrend(professorCourseIds: number[]) {
  if (professorCourseIds.length === 0) return []
  const rows = await db.review.groupBy({
    by: ['semesterTerm', 'semesterYear'],
    where: {
      professorCourseId: { in: professorCourseIds },
      status: 'visible',
      moderationStatus: { in: ['live', 'soft_flagged'] },
      semesterTerm: { not: null },
      semesterYear: { not: null },
    },
    _avg: { teachingQuality: true },
    _count: { _all: true },
  })
  return semesterTrend(
    rows.flatMap((row) =>
      row.semesterTerm && row.semesterYear && row._avg.teachingQuality !== null
        ? [
            {
              term: row.semesterTerm,
              year: row.semesterYear,
              count: row._count._all,
              avgTeaching: row._avg.teachingQuality,
            },
          ]
        : [],
    ),
  )
}
