// ─────────────────────────────────────────────────────────────────────────────
// Review-level insights for the professor page (SRS §4.6 FR-STAT-02)
//
// The professor_courses aggregates carry averages but not tag frequencies or
// rating spreads, so these come from a grouped query over the professor's
// counted reviews. The shaping lives here so it is testable without a DB.
// ─────────────────────────────────────────────────────────────────────────────

/** Moderation states whose reviews contribute to public aggregates — must
 *  match lib/aggregation-mutations.ts, which rolls the other states out. */
export const COUNTED_MODERATION_STATES = ['live', 'soft_flagged'] as const

export interface TagCount {
  tag: string
  count: number
}

/** Most-used tags first; ties broken alphabetically so output is stable
 *  across renders (otherwise ISR and SSR could disagree on the order). */
export function topTags(counts: TagCount[], limit: number, knownTags?: ReadonlySet<string>) {
  return counts
    .filter((c) => c.count > 0 && (!knownTags || knownTags.has(c.tag)))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit)
}

export interface Distribution {
  /** Always length 5. Index 0 = one star … index 4 = five stars. */
  counts: number[]
  total: number
  /** Each bucket as a share of the largest bucket, 0–100, for bar widths. */
  widths: number[]
}

export function ratingDistribution(rows: { value: number; count: number }[]): Distribution {
  const counts = [1, 2, 3, 4, 5].map((star) =>
    rows.filter((r) => r.value === star).reduce((sum, r) => sum + r.count, 0),
  )
  const total = counts.reduce((a, b) => a + b, 0)
  const max = Math.max(...counts)
  const widths = counts.map((c) => (max === 0 ? 0 : Math.round((c / max) * 100)))
  return { counts, total, widths }
}
