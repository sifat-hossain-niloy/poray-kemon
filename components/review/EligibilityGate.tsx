'use client'

// ─────────────────────────────────────────────────────────────────────────────
// Per-university email-domain gate — inline UX layer.
//
// The server enforces the gate in POST /api/reviews (see lib/eligibility.ts).
// This client component gives the user early, honest feedback: if their
// signed-in email doesn't match the picked university's rules, the banner
// shows before they type a 500-character review that will be rejected.
//
// - Refetches whenever `universityId` changes.
// - Silently succeeds (renders nothing + reports eligible) when the uni has
//   no restriction, or while loading — the server is still the source of
//   truth on submit.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { useLocale } from '@/lib/i18n/client'
import type { EligibilityResult } from '@/lib/eligibility'

interface Payload {
  forUniversityId: number
  universityShortName: string
  requiredSuffixes: string[]
  verdict: EligibilityResult
  userDomain: string | null
}

interface Props {
  universityId: number | null
  /** Called whenever we learn the eligibility state. Parent uses this to
   *  disable the submit button when not eligible. Pass a stable ref. */
  onChange: (eligible: boolean) => void
}

export function EligibilityGate({ universityId, onChange }: Props) {
  const locale = useLocale()
  const [payload, setPayload] = useState<Payload | null>(null)
  // Track the latest onChange without re-triggering the fetch effect on
  // every parent re-render.
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (universityId === null) {
      onChangeRef.current(true)
      return
    }
    let cancelled = false
    fetch(`/api/me/eligibility?university_id=${universityId}`)
      .then((r) => (r.ok ? (r.json() as Promise<Omit<Payload, 'forUniversityId'>>) : null))
      .then((data) => {
        if (cancelled) return
        if (!data) {
          // If the API fails, don't block — server enforces on submit.
          onChangeRef.current(true)
          return
        }
        setPayload({ ...data, forUniversityId: universityId })
        onChangeRef.current(data.verdict.eligible)
      })
      .catch(() => {
        if (cancelled) return
        onChangeRef.current(true)
      })
    return () => {
      cancelled = true
    }
  }, [universityId])

  // Only render when the payload we have describes the currently-picked uni.
  // Guards against a flash of the previous university's banner while a
  // new fetch is in flight.
  const shown =
    payload && payload.forUniversityId === universityId && !payload.verdict.eligible
      ? payload
      : null
  if (!shown) return null

  const t =
    locale === 'en'
      ? {
          headingNoEmail: `Reviews for ${shown.universityShortName} need a verified institutional email.`,
          headingMismatch: `Reviews for ${shown.universityShortName} are limited to students of that university.`,
          bodyRequired: (list: string) => `You'll need to sign in with a ${list} Google account.`,
          bodyCurrentDomain: (d: string) => `Your account is signed in with @${d}.`,
        }
      : {
          headingNoEmail: `${shown.universityShortName}-এর জন্য রিভিউ দিতে প্রাতিষ্ঠানিক ইমেইল প্রয়োজন।`,
          headingMismatch: `${shown.universityShortName}-এর রিভিউ শুধুমাত্র এই বিশ্ববিদ্যালয়ের শিক্ষার্থীদের জন্য।`,
          bodyRequired: (list: string) =>
            `${list} সাবফিক্স-এর গুগল অ্যাকাউন্ট দিয়ে সাইন-ইন করতে হবে।`,
          bodyCurrentDomain: (d: string) => `আপনার বর্তমান অ্যাকাউন্ট: @${d}`,
        }

  const required = shown.requiredSuffixes.map((s) => `@*.${s}`).join(' / ')
  const heading = shown.verdict.reason === 'no-email' ? t.headingNoEmail : t.headingMismatch
  const currentDomain =
    shown.verdict.reason === 'domain-mismatch' ? shown.verdict.userDomain : shown.userDomain

  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      <div className="font-medium">{heading}</div>
      <div className="mt-1 text-destructive/80">{t.bodyRequired(required)}</div>
      {currentDomain ? (
        <div className="mt-0.5 text-xs text-destructive/70">
          {t.bodyCurrentDomain(currentDomain)}
        </div>
      ) : null}
    </div>
  )
}
