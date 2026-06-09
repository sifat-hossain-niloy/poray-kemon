// ─────────────────────────────────────────────────────────────────────────────
// Smart-parser for free-text department names entered via the typeahead's
// "Add as new department" path.
//
// Accepts any of:
//   "CSE"                                       → { shortName: 'CSE', nameEn: 'CSE' }
//   "Computer Science and Engineering"          → { shortName: null,  nameEn: 'Computer Science and Engineering' }
//   "CSE - Computer Science and Engineering"    → { shortName: 'CSE', nameEn: 'Computer Science and Engineering' }
//   "CSE — Computer Science and Engineering"    → same (em-dash)
//   "Computer Science and Engineering (CSE)"    → same
//
// The all-caps short-only branch ("CSE") stores both fields equal so the
// admin merge tool can later split them out. We keep the parser deliberately
// conservative — when in doubt we treat the whole string as a full name
// rather than guess at an abbreviation.
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedDepartment {
  /** Stored in departments.short_name (≤ 20 chars). Null when the user
   *  didn't separate an abbreviation from the full name. */
  shortName: string | null
  /** Stored in departments.name_en (≤ 200 chars). */
  nameEn: string
}

// Abbreviations look like 2–8 letters (uppercase or mixed), possibly with
// dots like "C.S.E." — we strip the dots before measuring.
const ABBR_REGEX = /^[A-Z]([A-Z.]{0,7}[A-Z])?$/

function normaliseAbbreviation(raw: string): string {
  return raw.replace(/\./g, '').toUpperCase().slice(0, 20)
}

function isPlausibleAbbreviation(raw: string): boolean {
  const stripped = raw.replace(/\./g, '')
  if (stripped.length < 2 || stripped.length > 8) return false
  return ABBR_REGEX.test(stripped)
}

export function parseDepartmentName(input: string): ParsedDepartment {
  const raw = input.trim()
  if (raw.length === 0) return { shortName: null, nameEn: '' }

  // Pattern 1: "<full name> (<ABBR>)"
  const parenMatch = raw.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
  if (parenMatch) {
    const full = parenMatch[1]!.trim()
    const abbr = parenMatch[2]!.trim()
    if (full.length > 0 && isPlausibleAbbreviation(abbr)) {
      return {
        shortName: normaliseAbbreviation(abbr),
        nameEn: full.slice(0, 200),
      }
    }
  }

  // Pattern 2: "<ABBR> - <full name>" (also em-dash, en-dash)
  const dashMatch = raw.match(/^([^\s-–—]+(?:\s[^\s-–—]+){0,3})\s*[-–—]\s*(.+)$/)
  if (dashMatch) {
    const lhs = dashMatch[1]!.trim()
    const rhs = dashMatch[2]!.trim()
    if (isPlausibleAbbreviation(lhs) && rhs.length > 0) {
      return {
        shortName: normaliseAbbreviation(lhs),
        nameEn: rhs.slice(0, 200),
      }
    }
  }

  // Pattern 3: bare abbreviation (e.g. "CSE", "EEE", "C.S.E.")
  if (isPlausibleAbbreviation(raw)) {
    const normalised = normaliseAbbreviation(raw)
    return {
      shortName: normalised,
      // Store the same value in name_en so the row has a usable display name
      // until an admin (or the merge tool) splits it out.
      nameEn: normalised,
    }
  }

  // Pattern 4: everything else is treated as a full name only.
  return {
    shortName: null,
    nameEn: raw.slice(0, 200),
  }
}
