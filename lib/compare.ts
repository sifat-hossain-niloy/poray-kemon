// ─────────────────────────────────────────────────────────────────────────────
// Side-by-side professor comparison — pure helpers (URL state + highlights).
// The URL carries the selection (`/compare?ids=AAAA1111,BBBB2222`) so a
// comparison is shareable and needs no client storage.
// ─────────────────────────────────────────────────────────────────────────────

import { isProfessorPublicId } from '@/lib/public-id'

export const MAX_COMPARE = 3

/** Forgiving parse: accepts a comma list or repeated params, uppercases,
 *  drops anything that isn't a public id, de-duplicates, keeps order, caps. */
export function parseCompareIds(raw: string | string[] | undefined): string[] {
  const parts = (Array.isArray(raw) ? raw : [raw ?? ''])
    .flatMap((v) => v.split(','))
    .map((v) => v.trim().toUpperCase())
    .filter(isProfessorPublicId)
  return [...new Set(parts)].slice(0, MAX_COMPARE)
}

export function compareHref(ids: string[]): string {
  return ids.length > 0 ? `/compare?ids=${ids.join(',')}` : '/compare'
}

/** Columns holding the strictly highest value. Empty when fewer than two
 *  columns have data or when every value ties — nothing to point out. */
export function bestIndices(values: (number | null)[], epsilon = 0.005): Set<number> {
  const present = values.flatMap((v, i) => (v === null ? [] : [{ v, i }]))
  if (present.length < 2) return new Set()
  const max = Math.max(...present.map((p) => p.v))
  const min = Math.min(...present.map((p) => p.v))
  if (max - min < epsilon) return new Set()
  return new Set(present.filter((p) => max - p.v < epsilon).map((p) => p.i))
}
