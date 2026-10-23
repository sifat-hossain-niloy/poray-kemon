// ─────────────────────────────────────────────────────────────────────────────
// Semester tracking (SRS §10 Phase 2: "Add semester field to reviews; show
// how has this professor improved over time?")
//
// Optional on every review. A term + year pair is coarse on purpose — it is
// enough to show a trend, and no finer than what classmates already know.
// Pure helpers only; safe for client and server.
// ─────────────────────────────────────────────────────────────────────────────

export const SEMESTER_TERMS = ['spring', 'summer', 'fall'] as const
export type SemesterTerm = (typeof SEMESTER_TERMS)[number]

/** Oldest year the form offers. Older courses are rarely still relevant. */
export const SEMESTER_YEARS_BACK = 6

/** A term only shows on the trend when this many reviews back it, so one
 *  review never stands in for a whole semester. */
export const MIN_REVIEWS_PER_TERM = 2

const LABELS: Record<'en' | 'bn', Record<SemesterTerm, string>> = {
  en: { spring: 'Spring', summer: 'Summer', fall: 'Fall' },
  bn: { spring: 'বসন্ত', summer: 'গ্রীষ্ম', fall: 'শরৎ' },
}

export function isSemesterTerm(value: unknown): value is SemesterTerm {
  return typeof value === 'string' && (SEMESTER_TERMS as readonly string[]).includes(value)
}

export function termLabel(term: SemesterTerm, locale: 'en' | 'bn'): string {
  return LABELS[locale][term]
}

export function semesterLabel(term: SemesterTerm, year: number, locale: 'en' | 'bn'): string {
  const y = locale === 'bn' ? year.toLocaleString('bn-BD', { useGrouping: false }) : String(year)
  return `${termLabel(term, locale)} ${y}`
}

/** Monotonic sort key: 2025 fall < 2026 spring < 2026 summer. */
export function semesterOrdinal(term: SemesterTerm, year: number): number {
  return year * 3 + SEMESTER_TERMS.indexOf(term)
}

/** Years the picker offers, newest first. */
export function semesterYearOptions(now = new Date()): number[] {
  const current = now.getUTCFullYear()
  return Array.from({ length: SEMESTER_YEARS_BACK + 1 }, (_, i) => current - i)
}

/** The term a date falls in, so the server can reject future semesters. */
export function currentSemester(now = new Date()): { term: SemesterTerm; year: number } {
  const month = now.getUTCMonth() // 0-based
  const term: SemesterTerm = month <= 3 ? 'spring' : month <= 7 ? 'summer' : 'fall'
  return { term, year: now.getUTCFullYear() }
}

export function isFutureSemester(term: SemesterTerm, year: number, now = new Date()): boolean {
  const cur = currentSemester(now)
  return semesterOrdinal(term, year) > semesterOrdinal(cur.term, cur.year)
}

export interface TermBucket {
  term: SemesterTerm
  year: number
  count: number
  avgTeaching: number
}

/** Chronological, thinly-backed terms dropped. Returns [] unless at least
 *  two terms survive — a single point is not a trend. */
export function semesterTrend(buckets: TermBucket[], minPerTerm = MIN_REVIEWS_PER_TERM) {
  const kept = buckets
    .filter((b) => b.count >= minPerTerm)
    .sort((a, b) => semesterOrdinal(a.term, a.year) - semesterOrdinal(b.term, b.year))
  return kept.length >= 2 ? kept : []
}
