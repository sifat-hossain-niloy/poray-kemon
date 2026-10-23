// Data for /compare. One query for the professors + their aggregates and one
// for tag counts, whatever the number of columns.

import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { combineProfessorStats } from '@/lib/professor-stats'
import { obfuscateName } from '@/lib/name-obfuscation'

const TOP_TAGS = 3

const num = (v: { toString: () => string } | null) => (v === null ? null : Number(v.toString()))

export async function loadComparison(publicIds: string[], knownTags: ReadonlySet<string>) {
  if (publicIds.length === 0) return []
  const professors = await db.professor.findMany({
    where: { publicId: { in: publicIds } },
    select: {
      id: true,
      publicId: true,
      nameEn: true,
      nameBn: true,
      designation: true,
      university: { select: { shortName: true, slug: true } },
      department: { select: { shortName: true, nameEn: true, slug: true } },
      professorCourses: {
        select: {
          id: true,
          reviewCount: true,
          avgTeachingQuality: true,
          avgGradingFairness: true,
          avgCourseDifficulty: true,
          avgAttendance: true,
          wouldRecommendPct: true,
          overallScore: true,
        },
      },
    },
  })

  const pcToProfessor = new Map<number, number>()
  for (const p of professors) for (const pc of p.professorCourses) pcToProfessor.set(pc.id, p.id)
  const tagRows = pcToProfessor.size
    ? await db.$queryRaw<Array<{ pc_id: number; tag: string; count: number }>>`
        SELECT r.professor_course_id AS pc_id, t.tag, COUNT(*)::int AS count
        FROM reviews r, unnest(r.tags) AS t(tag)
        WHERE r.professor_course_id IN (${Prisma.join([...pcToProfessor.keys()])})
          AND r.status = 'visible'
          AND r.moderation_status IN ('live', 'soft_flagged')
        GROUP BY 1, 2
      `
    : []
  const tagTotals = new Map<number, Map<string, number>>()
  for (const row of tagRows) {
    const profId = pcToProfessor.get(row.pc_id)
    if (profId === undefined || !knownTags.has(row.tag)) continue
    const totals = tagTotals.get(profId) ?? new Map<string, number>()
    totals.set(row.tag, (totals.get(row.tag) ?? 0) + row.count)
    tagTotals.set(profId, totals)
  }

  const byPublicId = new Map(professors.map((p) => [p.publicId, p]))
  // Keep the URL's column order, silently dropping ids that don't exist.
  return publicIds.flatMap((publicId) => {
    const p = byPublicId.get(publicId)
    if (!p) return []
    const stats = combineProfessorStats(
      p.professorCourses.map((pc) => ({
        reviewCount: pc.reviewCount,
        avgTeachingQuality: num(pc.avgTeachingQuality),
        avgGradingFairness: num(pc.avgGradingFairness),
        avgCourseDifficulty: num(pc.avgCourseDifficulty),
        avgAttendance: num(pc.avgAttendance),
        wouldRecommendPct: num(pc.wouldRecommendPct),
        overallScore: num(pc.overallScore),
      })),
    )
    const topTags = [...(tagTotals.get(p.id) ?? new Map<string, number>())]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, TOP_TAGS)
      .map(([tag]) => tag)
    return [
      {
        publicId: p.publicId,
        displayName: p.nameBn ?? obfuscateName(p.nameEn),
        designation: p.designation,
        university: p.university,
        department: p.department,
        stats,
        topTags,
      },
    ]
  })
}

export type ComparedProfessor = Awaited<ReturnType<typeof loadComparison>>[number]
