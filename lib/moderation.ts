// ─────────────────────────────────────────────────────────────────────────────
// Two-tier content moderation (SRS §4.9)
//
// Tier 1 — Hard block: reject submission before INSERT. Returns 400 with a
//                      Bangla error message naming the rule violated.
//
// Tier 2 — Soft flag: review is published immediately but added to the admin
//                     moderation queue (`moderation_status = 'soft_flagged'`).
//
// Word lists are deliberately conservative for now. They live here in code so
// they can be unit-tested; a future migration can move them to a `blocklist`
// table managed by admins.
// ─────────────────────────────────────────────────────────────────────────────

import { STRINGS } from '@/lib/strings'

// ── Hard-block lists ──────────────────────────────────────────────────────────

/** English profanity — case-insensitive whole-word matches. Conservative list. */
const ENGLISH_PROFANITY = [
  'fuck',
  'shit',
  'bitch',
  'bastard',
  'asshole',
  'dickhead',
  'motherfucker',
  'cunt',
] as const

/** Bangla profanity — case-insensitive substring (Bangla has no case so substring suffices). */
const BANGLA_PROFANITY = ['মাগী', 'বেশ্যা', 'খানকি', 'হারামজাদা', 'কুত্তা'] as const

/** Slurs (religious / ethnic / gender) — substring match. */
const SLURS = ['কাফের', 'মালাউন', 'নাস্তিক বেজন্মা'] as const

/**
 * Unsubstantiated personal accusations — pattern phrases. These must be
 * matched as substrings to catch surrounding text.
 *
 * The intent here is NOT to silence legitimate criticism of teaching style.
 * It is to prevent the platform being used as a vehicle for unverifiable
 * criminal accusations like bribery or sexual harassment. Anyone with such
 * an allegation should report it through proper institutional channels.
 */
const ACCUSATION_PATTERNS = [
  /\bbribe[ds]?\b/i,
  /\bbribery\b/i,
  /\btook\s+bribe/i,
  /ঘুষ/, // Bangla: "bribe"
  /\bsexual(ly)?\s+harass(es|ed|ment)?\b/i,
  /\bharass(es|ed|ment)\b/i,
  /যৌন\s+হয়রানি/, // Bangla: "sexual harassment"
] as const

// ── Soft-flag patterns ────────────────────────────────────────────────────────

/** ≥ 3 consecutive exclamation marks → high-emotion indicator. */
const MULTIPLE_EXCLAMATIONS = /!{3,}/

/** ALL CAPS detector — requires ≥ 8 letters and ≥ 90% uppercase. */
function isAllCaps(text: string): boolean {
  const letters = text.match(/[A-Za-z]/g) ?? []
  if (letters.length < 8) return false
  const upper = letters.filter((c) => c === c.toUpperCase() && c !== c.toLowerCase())
  return upper.length / letters.length >= 0.9
}

/** English grudge-style phrasing — possible vendetta content. */
const GRUDGE_PATTERNS = [
  /\bhe\s+ruin(ed|s)\b/i,
  /\bshe\s+ruin(ed|s)\b/i,
  /\bhate[sd]?\s+me\b/i,
  /\bout\s+to\s+get\s+me\b/i,
  /\bunfair(ly)?\s+failed\s+me\b/i,
] as const

// ── Public API ────────────────────────────────────────────────────────────────

export type ModerationVerdict =
  | { kind: 'pass' }
  | { kind: 'hard_block'; reason: string; messageBn: string }
  | { kind: 'soft_flag'; reason: string }

/**
 * Run all moderation checks against the optional review text.
 *
 * The verdict drives:
 * - `hard_block` → API returns 400, no DB write
 * - `soft_flag` → write proceeds but `moderation_status = 'soft_flagged'`
 *                 so it lands in the admin queue
 * - `pass`      → write proceeds normally
 *
 * No-op for empty/null text — most reviews ship without prose.
 */
export function moderate(text: string | null | undefined): ModerationVerdict {
  if (!text) return { kind: 'pass' }
  const t = text.trim()
  if (!t) return { kind: 'pass' }

  const lower = t.toLowerCase()

  // ── Tier 1 — Hard block ────────────────────────────────────────────────────

  for (const word of ENGLISH_PROFANITY) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(t)) {
      return {
        kind: 'hard_block',
        reason: `profanity_en:${word}`,
        messageBn: STRINGS.reviewResponse.profanityBlock,
      }
    }
  }

  for (const word of BANGLA_PROFANITY) {
    if (t.includes(word)) {
      return {
        kind: 'hard_block',
        reason: `profanity_bn:${word}`,
        messageBn: STRINGS.reviewResponse.profanityBlock,
      }
    }
  }

  for (const word of SLURS) {
    if (t.includes(word)) {
      return {
        kind: 'hard_block',
        reason: `slur:${word}`,
        messageBn: STRINGS.reviewResponse.slurBlock,
      }
    }
  }

  for (const pattern of ACCUSATION_PATTERNS) {
    if (pattern.test(t)) {
      return {
        kind: 'hard_block',
        reason: `accusation:${pattern.source}`,
        messageBn: STRINGS.reviewResponse.accusationBlock,
      }
    }
  }

  // ── Tier 2 — Soft flag ─────────────────────────────────────────────────────

  if (t.length < 20) {
    return { kind: 'soft_flag', reason: 'too_short' }
  }

  if (isAllCaps(t)) {
    return { kind: 'soft_flag', reason: 'all_caps' }
  }

  if (MULTIPLE_EXCLAMATIONS.test(t)) {
    return { kind: 'soft_flag', reason: 'high_emotion' }
  }

  for (const pattern of GRUDGE_PATTERNS) {
    if (pattern.test(t)) {
      return { kind: 'soft_flag', reason: `grudge:${pattern.source}` }
    }
  }

  // Exhaustively-checked sentinel
  void lower
  return { kind: 'pass' }
}
