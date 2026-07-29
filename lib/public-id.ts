// Professor URL identifier — 8 chars from the migration's Crockford-lite
// alphabet (no vowels, no I/L/O). See prisma/migrations/*_add_professor_public_id.
//
// This module is intentionally read-only from the app side: generation
// happens on the database via the `pk_gen_public_id(len)` function (wired
// as the column DEFAULT). The regex below is the one place code needs to
// know the format — used to distinguish new URLs from legacy name-slugs
// during the redirect grace period.

export const PROFESSOR_PUBLIC_ID_REGEX = /^[0-9BCDFGHJKMNPQRSTVWXYZ]{8}$/

export function isProfessorPublicId(s: string): boolean {
  return PROFESSOR_PUBLIC_ID_REGEX.test(s)
}
