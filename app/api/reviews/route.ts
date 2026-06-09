// ─────────────────────────────────────────────────────────────────────────────
// POST /api/reviews — anonymous review submission
//
// This is the most sensitive endpoint in the platform. It must:
//   1. Authenticate the submitter (Google session) — but NEVER write user_id
//      onto the review record.
//   2. Enforce one-review-per-professor-course-per-user via the decoupled
//      `review_submissions` table.
//   3. Run keyword moderation — hard-block returns 400; soft-flag still
//      writes but marks `moderation_status = 'soft_flagged'`.
//   4. Auto-create Professor + Course + ProfessorCourse if any are missing.
//   5. Update `professor_courses` running averages in the same transaction.
//   6. Invalidate Redis caches.
//
// The anonymity contract:
//   reviews has NO user_id.
//   review_submissions has user_id BUT not the review content.
//   The two tables share NO foreign key. No JOIN can ever recover who wrote
//   which review.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { reviewSubmitSchema } from '@/lib/validations/review'
import { moderate } from '@/lib/moderation'
import { professorSlug, courseSlug } from '@/lib/slug'
import { deleteCache, CACHE_KEYS } from '@/lib/redis'
import { getStrings } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

// ── Helper: find or create the Professor row ─────────────────────────────────

async function resolveProfessor(input: {
  professorId?: number
  universityId?: number
  departmentId?: number
  nameEn?: string
  nameBn?: string
}): Promise<{ id: number; slug: string } | null> {
  if (input.professorId) {
    return db.professor.findUnique({
      where: { id: input.professorId },
      select: { id: true, slug: true },
    })
  }

  if (!input.universityId || !input.departmentId || !input.nameEn) return null

  const university = await db.university.findUnique({
    where: { id: input.universityId },
    select: { shortName: true },
  })
  if (!university) return null

  // Try an exact name match within the department first
  const existing = await db.professor.findFirst({
    where: {
      universityId: input.universityId,
      departmentId: input.departmentId,
      nameEn: input.nameEn,
    },
    select: { id: true, slug: true },
  })
  if (existing) return existing

  // Create — find a non-colliding slug. Plain slug → suffix with uni → suffix with counter.
  let candidateSlug = professorSlug(input.nameEn)
  let collides = await db.professor.findUnique({
    where: { slug: candidateSlug },
    select: { id: true },
  })
  if (collides) {
    candidateSlug = professorSlug(input.nameEn, university.shortName)
    collides = await db.professor.findUnique({
      where: { slug: candidateSlug },
      select: { id: true },
    })
    // Last resort: append a counter
    let n = 2
    while (collides) {
      const trial = `${professorSlug(input.nameEn, university.shortName)}-${n}`
      collides = await db.professor.findUnique({
        where: { slug: trial },
        select: { id: true },
      })
      if (!collides) {
        candidateSlug = trial
        break
      }
      n += 1
      if (n > 50) return null // give up rather than spin forever
    }
  }

  return db.professor.create({
    data: {
      universityId: input.universityId,
      departmentId: input.departmentId,
      nameEn: input.nameEn,
      nameBn: input.nameBn ?? null,
      slug: candidateSlug,
    },
    select: { id: true, slug: true },
  })
}

// ── Helper: find or create the Course row ────────────────────────────────────

async function resolveCourse(input: {
  departmentId: number
  courseCode?: string
  courseName: string
}) {
  const code = input.courseCode?.trim() || null

  // Course code, when present, is unique-per-department. Use that key first.
  if (code) {
    const existing = await db.course.findUnique({
      where: { departmentId_courseCode: { departmentId: input.departmentId, courseCode: code } },
      select: { id: true },
    })
    if (existing) return existing
  } else {
    // No code: match on name within the same department
    const existing = await db.course.findFirst({
      where: { departmentId: input.departmentId, courseName: input.courseName, courseCode: null },
      select: { id: true },
    })
    if (existing) return existing
  }

  return db.course.create({
    data: {
      departmentId: input.departmentId,
      courseCode: code,
      courseName: input.courseName,
      slug: courseSlug(code, input.courseName) || null,
    },
    select: { id: true },
  })
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // ── 1. Authentication ─────────────────────────────────────────────────────
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: (await getStrings()).errors.unauthorized, code: 'UNAUTHENTICATED' },
      { status: 401 },
    )
  }
  const userId = session.user.id

  // ── 2. Validation ────────────────────────────────────────────────────────
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = reviewSubmitSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 400 },
    )
  }
  const data = parsed.data

  // ── 3. Moderation ─────────────────────────────────────────────────────────
  const verdict = moderate(data.review_text)
  if (verdict.kind === 'hard_block') {
    return NextResponse.json(
      { error: verdict.messageBn, code: 'MODERATION_HARD_BLOCK', reason: verdict.reason },
      { status: 400 },
    )
  }

  // ── 4. Resolve professor + course + professor_course ──────────────────────
  const professor = await resolveProfessor({
    professorId: data.professor_id,
    universityId: data.university_id,
    departmentId: data.department_id,
    nameEn: data.professor_name_en,
    nameBn: data.professor_name_bn || undefined,
  })
  if (!professor) {
    return NextResponse.json(
      { error: 'Could not resolve professor', code: 'PROFESSOR_RESOLVE_FAILED' },
      { status: 400 },
    )
  }

  // Need the professor's department for the course
  const profRow = await db.professor.findUnique({
    where: { id: professor.id },
    select: { departmentId: true },
  })
  if (!profRow) {
    return NextResponse.json({ error: 'Professor vanished mid-request' }, { status: 500 })
  }

  const course = await resolveCourse({
    departmentId: profRow.departmentId,
    courseCode: data.course_code || undefined,
    courseName: data.course_name,
  })

  // Find or create professor_course
  const professorCourse = await db.professorCourse.upsert({
    where: { professorId_courseId: { professorId: professor.id, courseId: course.id } },
    create: { professorId: professor.id, courseId: course.id },
    update: {},
    select: { id: true },
  })

  // ── 5. Transactional write ────────────────────────────────────────────────
  // The anonymity contract is enforced HERE:
  //   - INSERT reviews (NO user_id)
  //   - INSERT review_submissions (user_id + professor_course_id, no review_id)
  //   - UPDATE professor_courses running averages
  // All three succeed atomically, or none do.
  try {
    await db.$transaction(async (tx) => {
      // 5a. Duplicate-submission guard — unique (user_id, professor_course_id)
      const already = await tx.reviewSubmission.findUnique({
        where: {
          userId_professorCourseId: {
            userId,
            professorCourseId: professorCourse.id,
          },
        },
        select: { id: true },
      })
      if (already) {
        throw new DuplicateSubmissionError()
      }

      // 5b. INSERT reviews — no user_id column on this table
      await tx.review.create({
        data: {
          professorCourseId: professorCourse.id,
          teachingQuality: data.teaching_quality,
          gradingFairness: data.grading_fairness,
          courseDifficulty: data.course_difficulty,
          attendanceStrictness: data.attendance_strictness,
          wouldRecommend: data.would_recommend,
          reviewText: data.review_text?.trim() || null,
          tags: data.tags,
          moderationStatus: verdict.kind === 'soft_flag' ? 'soft_flagged' : 'live',
          moderationReason: verdict.kind === 'soft_flag' ? verdict.reason : null,
        },
      })

      // 5c. INSERT review_submissions — links user → professor_course, NOT to the review row
      await tx.reviewSubmission.create({
        data: { userId, professorCourseId: professorCourse.id },
      })

      // 5d. UPDATE running averages on professor_courses. Raw SQL because
      // Prisma's query builder can't express self-referencing arithmetic
      // atomically. The formula is identical to lib/aggregation.runningAvg.
      const wouldRec = data.would_recommend ? 1 : 0
      await tx.$executeRaw`
        UPDATE professor_courses
        SET
          avg_teaching_quality  = ((COALESCE(avg_teaching_quality,  0) * review_count) + ${data.teaching_quality})      / (review_count + 1),
          avg_grading_fairness  = ((COALESCE(avg_grading_fairness,  0) * review_count) + ${data.grading_fairness})      / (review_count + 1),
          avg_course_difficulty = ((COALESCE(avg_course_difficulty, 0) * review_count) + ${data.course_difficulty})     / (review_count + 1),
          avg_attendance        = ((COALESCE(avg_attendance,        0) * review_count) + ${data.attendance_strictness}) / (review_count + 1),
          would_recommend_pct   = ((COALESCE(would_recommend_pct,   0) * review_count) + ${wouldRec * 100})             / (review_count + 1),
          overall_score         = (
            ((COALESCE(avg_teaching_quality, 0) * review_count) + ${data.teaching_quality}) / (review_count + 1) * 0.5
            + ((COALESCE(avg_grading_fairness, 0) * review_count) + ${data.grading_fairness}) / (review_count + 1) * 0.3
            + (((COALESCE(would_recommend_pct, 0) * review_count) + ${wouldRec * 100}) / (review_count + 1) / 100 * 5) * 0.2
          ),
          review_count          = review_count + 1,
          updated_at            = NOW()
        WHERE id = ${professorCourse.id}
      `
    })
  } catch (err) {
    if (err instanceof DuplicateSubmissionError) {
      return NextResponse.json(
        {
          error: (await getStrings()).reviewResponse.alreadyReviewed,
          code: 'ALREADY_REVIEWED',
        },
        { status: 409 },
      )
    }
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002' // unique constraint
    ) {
      return NextResponse.json(
        { error: (await getStrings()).reviewResponse.alreadyReviewed, code: 'ALREADY_REVIEWED' },
        { status: 409 },
      )
    }
    console.error('[reviews/POST] transaction failed:', err)
    return NextResponse.json({ error: (await getStrings()).errors.serverError }, { status: 500 })
  }

  // ── 6. Cache invalidation ─────────────────────────────────────────────────
  await Promise.all([
    deleteCache(CACHE_KEYS.siteStats),
    deleteCache(CACHE_KEYS.professorProfile(professor.slug)),
  ])

  // ── 7. Done ───────────────────────────────────────────────────────────────
  return NextResponse.json(
    {
      message: (await getStrings()).reviewResponse.success,
      professor_slug: professor.slug,
      moderation_status: verdict.kind === 'soft_flag' ? 'soft_flagged' : 'live',
    },
    { status: 201 },
  )
}

// Local error sentinel — avoids depending on Prisma error codes for the
// duplicate path so we can return a friendly Bangla message immediately.
class DuplicateSubmissionError extends Error {
  constructor() {
    super('duplicate')
    this.name = 'DuplicateSubmissionError'
  }
}
