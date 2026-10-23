// "Who else teaches this course?" — the other professor_courses rows for the
// same course, so a student choosing between sections can jump across.

import { db } from '@/lib/db'
import { obfuscateName } from '@/lib/name-obfuscation'

export async function loadCourseAlternatives(courseId: number, excludeProfessorId: number) {
  const rows = await db.professorCourse.findMany({
    where: { courseId, professorId: { not: excludeProfessorId } },
    select: {
      reviewCount: true,
      overallScore: true,
      wouldRecommendPct: true,
      professor: { select: { publicId: true, nameEn: true, nameBn: true } },
    },
  })
  return rows
    .map((r) => ({
      publicId: r.professor.publicId,
      displayName: r.professor.nameBn ?? obfuscateName(r.professor.nameEn),
      reviewCount: r.reviewCount,
      overallScore: r.reviewCount > 0 && r.overallScore !== null ? Number(r.overallScore) : null,
      wouldRecommendPct:
        r.reviewCount > 0 && r.wouldRecommendPct !== null ? Number(r.wouldRecommendPct) : null,
    }))
    .sort(
      (a, b) =>
        (b.overallScore ?? -1) - (a.overallScore ?? -1) ||
        b.reviewCount - a.reviewCount ||
        a.displayName.localeCompare(b.displayName),
    )
}
