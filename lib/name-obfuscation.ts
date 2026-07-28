// ─────────────────────────────────────────────────────────────────────────────
// Professor-name obfuscation for public display.
//
// A pure, reversible-by-a-human, machine-search-hostile transform. Real names
// stay in the DB verbatim (search relevance depends on it); this transform is
// applied at render-time on every PUBLIC surface where a professor is named.
//
// Why: reduces the risk of a defamation claim built on a search hit. A prof
// googling their own name should not land on "Dr. Mohammad Rahman received
// harsh feedback here". Obfuscated as "Dr. Moh@mm@d R@hm@n" the string is
// still legible to a human familiar with the person, but no longer matches
// the plaintext google/Facebook search that scraped the page.
//
// Rules — deliberately narrow so the output stays readable at a glance:
//   a, A  →  @
//   l, L  →  !
//   i, I  →  !
//
// The l/L and i/I collision is intentional: both stems map to the same
// character, making reverse-engineering trivially ambiguous. A human who
// knows the person reads through it; a naive substring match doesn't.
//
// NOT applied to:
//   - DB storage / slugs / URLs (real names stay in the database and in
//     admin-facing views).
//   - Bangla names — the attack surface is roman-alphabet search engines,
//     and Bangla names don't have the same "a/l/i" character-substitution
//     mapping anyway.
//   - The `name` the review form's professor typeahead SENDS to the server
//     on select — we display the obfuscated form but pass the real string
//     back to keep resolveProfessor's name-based lookup working.
// ─────────────────────────────────────────────────────────────────────────────

export const OBFUSCATION_MAP: Readonly<Record<string, string>> = Object.freeze({
  a: '@',
  A: '@',
  l: '!',
  L: '!',
  i: '!',
  I: '!',
})

/** Obfuscate an English name for public display. Idempotent — running the
 *  result through the function again is a no-op (the substituted chars aren't
 *  keys in the map). Empty / falsy input passes through unchanged. */
export function obfuscateName(name: string | null | undefined): string {
  if (!name) return ''
  let out = ''
  for (const ch of name) out += OBFUSCATION_MAP[ch] ?? ch
  return out
}
