// ─────────────────────────────────────────────────────────────────────────────
// Professor-name obfuscation for public display.
//
// A pure, reversible-by-a-human, machine-search-hostile transform. Real names
// stay in the DB verbatim (search relevance depends on it); this transform is
// applied at render-time on every PUBLIC surface where a professor is named.
//
// Why: reduces the risk of a defamation claim built on a search hit. A prof
// googling their own name should not land on "Dr. Mohammad Rahman received
// harsh feedback here". Obfuscated as "Dr. M0h@mm@d R@hm@n" the string is
// still legible to a human familiar with the person, but no longer matches
// the plaintext google/Facebook search that scraped the page.
//
// Rules — designed so a human reads through it while a substring search
// misses. Uppercase letters that typically start a name (A, E, O, S, T) are
// deliberately left alone: they carry most of the visual identity, and
// substituting them at word-start hurts readability more than obfuscation is
// worth. The l/L and i/I collision (both → !) is intentional: it makes
// reverse-engineering trivially ambiguous.
//
//   a           →  @        (mid-word "@" reads clean; e.g. R@hman)
//   l, L        →  !        (both cases — L rarely leads a first name)
//   i, I        →  !        (both cases — I rarely leads a first name)
//   e           →  3
//   o           →  0
//   s           →  $
//   t           →  7
//
// NOT applied to:
//   - Uppercase A, E, O, S, T — first-letter recognition matters more than
//     obfuscation. "Abdul" stays "Abdul", not "@bdul".
//   - DB storage / slugs / URLs (real names stay in the database and in
//     admin-facing views).
//   - Bangla names — the attack surface is roman-alphabet search engines.
//   - The name the review form's professor typeahead SENDS to the server on
//     select — we display the obfuscated form but pass the real string back
//     to keep resolveProfessor's name-based lookup working.
// ─────────────────────────────────────────────────────────────────────────────

export const OBFUSCATION_MAP: Readonly<Record<string, string>> = Object.freeze({
  a: '@',
  l: '!',
  L: '!',
  i: '!',
  I: '!',
  e: '3',
  o: '0',
  s: '$',
  t: '7',
})

/** Obfuscate an English name for public display. Idempotent — running the
 *  result through the function again is a no-op (the substituted chars aren't
 *  keys in the map). Empty / null / undefined input passes through as ''. */
export function obfuscateName(name: string | null | undefined): string {
  if (!name) return ''
  let out = ''
  for (const ch of name) out += OBFUSCATION_MAP[ch] ?? ch
  return out
}
