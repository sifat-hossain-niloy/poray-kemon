// ─────────────────────────────────────────────────────────────────────────────
// Slug helpers
//
// Professor slugs live in URLs (`/professors/dr-mohammad-rahman`) so they must
// be ASCII-safe, lowercase, and unique. The plain `slugify` covers ASCII
// normalisation; `professorSlug` adds the university short name as a tail
// suffix only when a base collision is detected by the caller — see the
// `find-or-create` logic in `app/api/reviews/route.ts`.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a free-text name into a lowercased, hyphen-separated, ASCII-safe slug.
 *
 * - Strips diacritics (NFKD normalize)
 * - Replaces any non-alphanumeric run with `-`
 * - Collapses multiple `-` into one
 * - Trims `-` from both ends
 *
 * Bangla characters are stripped entirely because URL safety matters more than
 * fidelity — we store the original Bangla name in `name_bn`, not the slug.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Build a candidate professor slug. The university short name is appended only
 * if `withUniversitySuffix` is true (used when the bare slug collides).
 */
export function professorSlug(name: string, universityShortName?: string): string {
  const base = slugify(name)
  if (!universityShortName) return base
  const suffix = slugify(universityShortName)
  return suffix ? `${base}-${suffix}` : base
}

/**
 * Build a course slug from optional code + name. e.g. ("CSE 301", "Data
 * Structures") → "cse-301-data-structures". If only one part is provided,
 * uses that. Falls back to the empty string only for empty input.
 */
export function courseSlug(courseCode: string | null | undefined, courseName: string): string {
  const parts = [courseCode, courseName].filter(Boolean).join(' ')
  return slugify(parts)
}
