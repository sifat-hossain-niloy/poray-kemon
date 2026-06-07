// ─────────────────────────────────────────────────────────────────────────────
// Running-average primitives for professor_courses aggregates.
//
// On every new review, we apply:
//   new_avg = ((old_avg * old_count) + new_value) / (old_count + 1)
// This is O(1) per insert and avoids full AVG() scans.
//
// The DB-side equivalent lives inline in the API route via $executeRaw.
// Keeping the same formula here in JS lets us unit-test the maths in
// isolation from Prisma, and lets the seed/migration path compute aggregates
// without round-trips.
// ─────────────────────────────────────────────────────────────────────────────

export type Dimension =
  | 'teaching_quality'
  | 'grading_fairness'
  | 'course_difficulty'
  | 'attendance_strictness'

export function runningAvg(oldAvg: number, oldCount: number, newValue: number): number {
  if (oldCount <= 0) return newValue
  return (oldAvg * oldCount + newValue) / (oldCount + 1)
}

/** Percentage of "yes" recommendations. Same shape as `runningAvg` but the new value is 0 or 1, scaled to %. */
export function runningRecommendPct(
  oldPct: number,
  oldCount: number,
  newWouldRecommend: boolean,
): number {
  const newValue = newWouldRecommend ? 100 : 0
  if (oldCount <= 0) return newValue
  return (oldPct * oldCount + newValue) / (oldCount + 1)
}

/**
 * Weighted overall score per SRS §4.6 / Q1 resolution:
 * - 50% teaching quality
 * - 30% grading fairness
 * - 20% would-recommend (scaled from %)
 * - attendance_strictness is NEUTRAL (informational only) — Q1 resolution
 * - course_difficulty is NEUTRAL — informational only
 */
export function overallScore({
  teaching,
  grading,
  recommendPct,
}: {
  teaching: number
  grading: number
  recommendPct: number
}): number {
  return teaching * 0.5 + grading * 0.3 + (recommendPct / 100) * 5 * 0.2
}
