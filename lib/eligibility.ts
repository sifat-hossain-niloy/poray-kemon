// ─────────────────────────────────────────────────────────────────────────────
// University review-authorship eligibility.
//
// Some universities (starting with Dhaka University) only accept reviews
// from students whose institutional email domain matches. The gate lives on
// the university row as `emailDomainSuffixes` (a list of accepted suffixes).
// The user's captured `emailDomain` is compared against that list.
//
// Nothing here is DU-specific — new universities plug in by adding suffixes
// to their row. Empty array = no restriction.
// ─────────────────────────────────────────────────────────────────────────────

export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: 'no-email'; requiredSuffixes: string[] }
  | { eligible: false; reason: 'domain-mismatch'; requiredSuffixes: string[]; userDomain: string }

/**
 * Extract the domain portion of an email address, normalised. Returns null
 * if the input isn't a valid-looking email — callers should treat null as
 * "no verified domain on file" and refuse gated writes.
 */
export function emailToDomain(email: string | null | undefined): string | null {
  if (!email) return null
  const at = email.lastIndexOf('@')
  if (at < 1 || at === email.length - 1) return null
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase()
  // Reject empty / whitespace / obviously malformed domains.
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return null
  return domain
}

/**
 * Does `userDomain` satisfy any of `requiredSuffixes`? A suffix matches when
 * the domain equals it (`du.ac.bd` == `du.ac.bd`) or when it's a subdomain
 * of it (`cs.du.ac.bd` ends with `.du.ac.bd`). Match is case-insensitive.
 * Sub-string matches without a dot boundary are rejected so `evildu.ac.bd`
 * does NOT satisfy `du.ac.bd`.
 */
export function domainMatchesSuffix(
  userDomain: string,
  requiredSuffixes: readonly string[],
): boolean {
  if (requiredSuffixes.length === 0) return true
  const d = userDomain.toLowerCase()
  return requiredSuffixes.some((raw) => {
    const s = raw.trim().toLowerCase()
    if (!s) return false
    return d === s || d.endsWith('.' + s)
  })
}

/**
 * Full eligibility check. Combines the "does the university have a gate"
 * and "does the user's domain pass" questions into one typed result.
 */
export function checkEligibility(
  userDomain: string | null,
  requiredSuffixes: readonly string[],
): EligibilityResult {
  if (requiredSuffixes.length === 0) return { eligible: true }
  if (!userDomain) {
    return { eligible: false, reason: 'no-email', requiredSuffixes: [...requiredSuffixes] }
  }
  if (!domainMatchesSuffix(userDomain, requiredSuffixes)) {
    return {
      eligible: false,
      reason: 'domain-mismatch',
      requiredSuffixes: [...requiredSuffixes],
      userDomain,
    }
  }
  return { eligible: true }
}

/**
 * Human-readable suffix list for error messages: ["du.ac.bd"] → "@*.du.ac.bd".
 * Multiple suffixes are OR-joined.
 */
export function formatRequiredSuffixes(suffixes: readonly string[]): string {
  return suffixes.map((s) => `@*.${s}`).join(' or ')
}
