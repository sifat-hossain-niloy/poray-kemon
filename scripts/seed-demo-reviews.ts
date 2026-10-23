// ─────────────────────────────────────────────────────────────────────────────
// Seed synthetic courses + reviews for LOCAL DEVELOPMENT ONLY.
//
// A fresh DB has universities, departments and (after seed-du-professors)
// professors, but zero reviews — so every rating, leaderboard, trend and
// filter on the site renders its empty state. This script fills that gap
// with deterministic fake data so UI work can be checked against something
// realistic.
//
// Shape of what it writes:
//   - N synthetic users (google_id = "demo-<n>") so review_submissions has
//     somebody to point at and the one-review-per-course guard stays honest
//   - a handful of courses per sampled department
//   - professor_courses + reviews spread across the last ~14 months
//   - professor_courses aggregates folded in with the same running-average
//     formula the API uses (lib/aggregation.ts), one review at a time
//
// Refuses to run against anything that isn't a local database. Idempotent
// in the sense that it wipes its own previous output (demo users cascade
// their submissions; demo reviews are tagged by a moderation note) before
// writing fresh rows.
//
// Run with:
//   pnpm db:seed:demo
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client'
import { overallScore, runningAvg, runningRecommendPct } from '../lib/aggregation'
import { courseSlug } from '../lib/slug'

const DEMO_NOTE = 'demo-seed'
const DEMO_USER_PREFIX = 'demo-'
const USER_COUNT = 60
const DEPARTMENTS_TO_SAMPLE = 8
const PROFESSORS_PER_DEPARTMENT = 10
const COURSES_PER_DEPARTMENT = 5

const TAGS = [
  'স্লাইড_পড়েন',
  'বোর্ডে_বোঝান',
  'উদাহরণ_দিয়ে_বোঝান',
  'প্রশ্ন_নেন',
  'প্রশ্ন_নেন_না',
  'অফিস_আওয়ার_দেন',
  'পরীক্ষা_ক্লাস_থেকে_আসে',
  'পরীক্ষা_ক্লাস_থেকে_আসে_না',
  'নম্বরে_কঞ্জুস',
  'গ্রেড_ভালো_দেন',
  'উপস্থিতি_কড়া',
  'উপস্থিতি_নমনীয়',
  'ইংরেজিতে_পড়ান',
  'বাংলায়_পড়ান',
  'সহজলভ্য',
  'দূরত্ব_বজায়_রাখেন',
  'অনুপ্রেরণাদায়ক',
]

const POSITIVE_TEXTS = [
  'Explains every concept with real examples. The board work is clear and he always takes questions after class.',
  'ক্লাসে খুব সুন্দর করে বোঝান। পরীক্ষার প্রশ্ন ক্লাস থেকেই আসে, তাই প্রস্তুতি নেওয়া সহজ।',
  'One of the best teachers in the department. Assignments are fair and feedback is detailed.',
  'অফিস আওয়ারে গেলে সময় নিয়ে বুঝিয়ে দেন। কোর্সটা কঠিন হলেও শেখার মতো।',
  'Lectures are well structured and the slides are actually useful for revision before exams.',
]

const MIXED_TEXTS = [
  'Knows the subject well but moves too fast. You need to self-study a lot to keep up with the pace.',
  'পড়ান ভালো, কিন্তু নম্বর দিতে একটু কঞ্জুস। উপস্থিতির ব্যাপারে বেশ কড়া।',
  'Decent course overall. Exams are harder than what is covered in class, so practice old questions.',
]

const NEGATIVE_TEXTS = [
  'Mostly reads from the slides and rarely takes questions. Had to learn almost everything from YouTube.',
  'ক্লাসে প্রশ্ন করলে বিরক্ত হন। পরীক্ষার প্রশ্ন সিলেবাসের সাথে মেলে না।',
]

const COURSE_NAMES = [
  'Introduction to the Discipline',
  'Research Methodology',
  'Advanced Topics',
  'Quantitative Methods',
  'Seminar and Project Work',
  'Theory and Applications',
  'Laboratory Practice',
]

// Mulberry32 — tiny deterministic PRNG so repeated runs produce the same
// dataset (handy when comparing screenshots across branches).
function makeRng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function at<T>(xs: readonly T[], i: number): T {
  const v = xs[i]
  if (v === undefined) throw new Error(`index ${i} out of range`)
  return v
}

function assertLocalDatabase() {
  const url = process.env.DATABASE_URL ?? ''
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed demo reviews with NODE_ENV=production')
  }
  if (!/@(localhost|127\.0\.0\.1|\[::1\]|postgres)(:\d+)?\//.test(url)) {
    throw new Error(
      `Refusing to seed demo reviews into a non-local database (${url.split('@')[1]})`,
    )
  }
}

async function main() {
  assertLocalDatabase()
  const db = new PrismaClient()
  const rand = makeRng(20260601)
  const pick = <T>(xs: readonly T[]): T => at(xs, Math.floor(rand() * xs.length))
  const clamp = (n: number) => Math.max(1, Math.min(5, Math.round(n)))

  try {
    // ── 1. Wipe previous demo output ─────────────────────────────────────────
    const oldReviews = await db.review.findMany({
      where: { moderationNotes: DEMO_NOTE },
      select: { id: true },
    })
    const oldIds = oldReviews.map((r) => r.id)
    if (oldIds.length > 0) {
      await db.helpfulVote.deleteMany({ where: { reviewId: { in: oldIds } } })
      await db.report.deleteMany({ where: { reviewId: { in: oldIds } } })
      await db.review.deleteMany({ where: { id: { in: oldIds } } })
    }
    await db.user.deleteMany({ where: { googleId: { startsWith: DEMO_USER_PREFIX } } })
    // Aggregates on any professor_course that only held demo reviews are now
    // stale. Reset the ones with no surviving reviews.
    await db.$executeRaw`
      UPDATE professor_courses pc SET
        review_count = 0, avg_teaching_quality = NULL, avg_grading_fairness = NULL,
        avg_course_difficulty = NULL, avg_attendance = NULL,
        would_recommend_pct = NULL, overall_score = NULL
      WHERE NOT EXISTS (SELECT 1 FROM reviews r WHERE r.professor_course_id = pc.id)
    `

    // ── 2. Demo users ────────────────────────────────────────────────────────
    const users = await Promise.all(
      Array.from({ length: USER_COUNT }, (_, i) =>
        db.user.create({
          data: {
            googleId: `${DEMO_USER_PREFIX}${i}`,
            displayName: `Demo Student ${i}`,
            emailDomain: i % 3 === 0 ? 'du.ac.bd' : 'gmail.com',
          },
          select: { id: true },
        }),
      ),
    )

    // ── 3. Pick departments with enough professors ───────────────────────────
    const departments = await db.department.findMany({
      where: { professors: { some: {} } },
      select: {
        id: true,
        shortName: true,
        nameEn: true,
        professors: {
          select: { id: true },
          orderBy: { id: 'asc' },
          take: PROFESSORS_PER_DEPARTMENT,
        },
      },
      orderBy: { id: 'asc' },
      take: DEPARTMENTS_TO_SAMPLE,
    })
    if (departments.length === 0) {
      throw new Error('No professors found. Run scripts/seed-du-professors.ts first.')
    }

    let reviewTotal = 0
    const now = Date.now()
    const DAY = 24 * 60 * 60 * 1000

    for (const dept of departments) {
      const prefix = (dept.shortName ?? dept.nameEn.slice(0, 3)).toUpperCase().replace(/\s+/g, '')

      // ── 4. Courses ─────────────────────────────────────────────────────────
      const courses = []
      for (let c = 0; c < COURSES_PER_DEPARTMENT; c++) {
        const code = `${prefix} ${101 + c * 100 + Math.floor(rand() * 9)}`
        const name = at(COURSE_NAMES, c % COURSE_NAMES.length)
        const course = await db.course.upsert({
          where: { departmentId_courseCode: { departmentId: dept.id, courseCode: code } },
          create: {
            departmentId: dept.id,
            courseCode: code,
            courseName: name,
            slug: courseSlug(code, name) || null,
          },
          update: {},
          select: { id: true },
        })
        courses.push(course)
      }

      // ── 5. Professor ↔ course pairs + reviews ──────────────────────────────
      for (const prof of dept.professors) {
        // Each professor has a "true" quality the reviews scatter around, so
        // the leaderboard and sort orders have a real spread to show.
        const baseQuality = 1.8 + rand() * 3
        const baseGrading = baseQuality + (rand() - 0.5) * 1.5
        const baseDifficulty = 1.5 + rand() * 3.5
        const baseAttendance = 1.5 + rand() * 3.5
        const courseCount = 1 + Math.floor(rand() * 2)

        for (let k = 0; k < courseCount; k++) {
          const course = at(courses, (prof.id + k) % courses.length)
          const pc = await db.professorCourse.upsert({
            where: { professorId_courseId: { professorId: prof.id, courseId: course.id } },
            create: { professorId: prof.id, courseId: course.id },
            update: {},
            select: {
              id: true,
              reviewCount: true,
              avgTeachingQuality: true,
              avgGradingFairness: true,
              avgCourseDifficulty: true,
              avgAttendance: true,
              wouldRecommendPct: true,
            },
          })

          // Zero-review pairs are useful too (empty states), so sometimes skip.
          const reviewCount = rand() < 0.15 ? 0 : 1 + Math.floor(rand() * 9)
          const reviewers = [...users].sort(() => rand() - 0.5).slice(0, reviewCount)

          let count = pc.reviewCount
          let teaching = Number(pc.avgTeachingQuality ?? 0)
          let grading = Number(pc.avgGradingFairness ?? 0)
          let difficulty = Number(pc.avgCourseDifficulty ?? 0)
          let attendance = Number(pc.avgAttendance ?? 0)
          let recommend = Number(pc.wouldRecommendPct ?? 0)

          for (const reviewer of reviewers) {
            const t = clamp(baseQuality + (rand() - 0.5) * 2)
            const g = clamp(baseGrading + (rand() - 0.5) * 2)
            const d = clamp(baseDifficulty + (rand() - 0.5) * 1.5)
            const a = clamp(baseAttendance + (rand() - 0.5) * 1.5)
            const wouldRecommend = t + g >= 6 ? rand() < 0.85 : rand() < 0.2
            const pool = t >= 4 ? POSITIVE_TEXTS : t >= 3 ? MIXED_TEXTS : NEGATIVE_TEXTS
            const text = rand() < 0.75 ? pick(pool) : null
            const tags = [
              ...new Set(Array.from({ length: Math.floor(rand() * 4) }, () => pick(TAGS))),
            ]
            // Skew toward recent dates so "trending" windows aren't empty.
            const ageDays = Math.floor(Math.pow(rand(), 1.6) * 420)

            await db.$transaction([
              db.review.create({
                data: {
                  professorCourseId: pc.id,
                  teachingQuality: t,
                  gradingFairness: g,
                  courseDifficulty: d,
                  attendanceStrictness: a,
                  wouldRecommend,
                  reviewText: text,
                  tags,
                  helpfulCount: Math.floor(Math.pow(rand(), 3) * 40),
                  moderationNotes: DEMO_NOTE,
                  submittedAt: new Date(now - ageDays * DAY - Math.floor(rand() * DAY)),
                },
              }),
              db.reviewSubmission.create({
                data: { userId: reviewer.id, professorCourseId: pc.id },
              }),
            ])

            teaching = runningAvg(teaching, count, t)
            grading = runningAvg(grading, count, g)
            difficulty = runningAvg(difficulty, count, d)
            attendance = runningAvg(attendance, count, a)
            recommend = runningRecommendPct(recommend, count, wouldRecommend)
            count += 1
            reviewTotal += 1
          }

          if (reviewers.length > 0) {
            await db.professorCourse.update({
              where: { id: pc.id },
              data: {
                reviewCount: count,
                avgTeachingQuality: teaching,
                avgGradingFairness: grading,
                avgCourseDifficulty: difficulty,
                avgAttendance: attendance,
                wouldRecommendPct: recommend,
                overallScore: overallScore({ teaching, grading, recommendPct: recommend }),
              },
            })
          }
        }
      }
      console.log(`  ✓ ${prefix.padEnd(6)} ${dept.professors.length} professors`)
    }

    console.log(
      `\n✅ Demo seed complete — ${reviewTotal} reviews across ${departments.length} departments`,
    )
    console.log('   Flush Redis (redis-cli FLUSHALL) if cached stats look stale.')
  } finally {
    await db.$disconnect()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
