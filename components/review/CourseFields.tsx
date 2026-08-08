'use client'

// ─────────────────────────────────────────────────────────────────────────────
// CourseFields — twin autocomplete inputs for course code + course name.
//
// Both fields share one underlying search against /api/courses/search scoped
// to the chosen department. Whichever field the user is in drives the query.
// Picking a hit from either dropdown prefills BOTH fields ("CSE 301" → also
// fills "Data Structures", and vice versa). Both stay freely editable —
// students may be reviewing an unlisted course variant where the listed
// name doesn't match exactly.
//
// No "add as new" UI here. POST /api/reviews already runs find-or-create on
// `(department_id, course_code)`; a typed code that doesn't match anything
// just creates a new course row on submit. No admin verification step —
// courses don't have a status field (the duplication risk is much lower
// than for departments, because course codes are inherently structured).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { useLocale } from '@/lib/i18n/client'

interface Hit {
  id: number
  course_code: string | null
  course_name: string
  slug: string | null
  review_count: number
}

interface Props {
  /** When null, the inputs render but autocomplete is disabled (we have
   *  nothing to scope the search by yet). */
  departmentId: number | null
  courseCode: string
  setCourseCode: (s: string) => void
  courseName: string
  setCourseName: (s: string) => void
  /** Hint text + label strings — supplied by the parent so they stay in
   *  sync with the rest of the form's i18n. */
  labels: {
    codeLabel: string
    codePlaceholder: string
    nameLabel: string
    namePlaceholder: string
  }
}

export function CourseFields({
  departmentId,
  courseCode,
  setCourseCode,
  courseName,
  setCourseName,
  labels,
}: Props) {
  const locale = useLocale()
  const [hits, setHits] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)
  // Which input has the dropdown open. Two separate flags so blur on one
  // doesn't close the dropdown opened on the other.
  const [codeFocused, setCodeFocused] = useState(false)
  const [nameFocused, setNameFocused] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const focused = codeFocused || nameFocused
  // Whichever field is active drives the search. Code field takes priority
  // when both are focused (shouldn't happen, but defensive).
  const query = codeFocused ? courseCode : nameFocused ? courseName : ''
  const showDropdown = focused && departmentId !== null

  const t =
    locale === 'en'
      ? {
          helper:
            'Start typing — we’ll suggest matching courses from this department. Selecting one fills both fields, but you can edit them.',
          empty: 'No matches.',
          reviewCount: (n: number) =>
            n === 0 ? 'No reviews yet' : `${n} review${n === 1 ? '' : 's'}`,
        }
      : {
          helper:
            'টাইপ করুন — এই বিভাগের মিল-পাওয়া কোর্সগুলো দেখাব। একটি বাছাই করলে দুটো ঘরই পূরণ হবে, কিন্তু আপনি সম্পাদনা করতে পারবেন।',
          empty: 'কোনো মিল নেই।',
          reviewCount: (n: number) => (n === 0 ? 'এখনও কোনো রিভিউ নেই' : `${n}টি রিভিউ`),
        }

  // Debounced fetch. State updates inside the timer to avoid sync setState
  // in the effect body (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (departmentId === null) return
    if (!focused) return
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      setLoading(true)
      if (abortRef.current) abortRef.current.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      const url = `/api/courses/search?q=${encodeURIComponent(query)}&department_id=${departmentId}`
      fetch(url, { signal: ctrl.signal })
        .then((r) => r.json() as Promise<{ results: Hit[] }>)
        .then((data) => {
          setHits(data.results ?? [])
          setLoading(false)
        })
        .catch((err: unknown) => {
          if ((err as { name?: string })?.name === 'AbortError') return
          setHits([])
          setLoading(false)
        })
    }, 180)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, departmentId, focused])

  function applyHit(h: Hit) {
    setCourseCode(h.course_code ?? '')
    setCourseName(h.course_name)
    setHits([])
    setCodeFocused(false)
    setNameFocused(false)
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr]">
      <FieldWrap label={labels.codeLabel}>
        <div className="relative">
          <input
            type="text"
            value={courseCode}
            onChange={(e) => setCourseCode(e.target.value)}
            onFocus={() => setCodeFocused(true)}
            onBlur={() => setTimeout(() => setCodeFocused(false), 120)}
            placeholder={labels.codePlaceholder}
            autoComplete="off"
            className={inputClass}
          />
          {showDropdown && codeFocused ? (
            <Dropdown
              loading={loading}
              hits={hits}
              empty={t.empty}
              reviewCount={t.reviewCount}
              onPick={applyHit}
            />
          ) : null}
        </div>
      </FieldWrap>
      <FieldWrap label={labels.nameLabel}>
        <div className="relative">
          <input
            type="text"
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setTimeout(() => setNameFocused(false), 120)}
            placeholder={labels.namePlaceholder}
            autoComplete="off"
            className={inputClass}
            required
          />
          {showDropdown && nameFocused ? (
            <Dropdown
              loading={loading}
              hits={hits}
              empty={t.empty}
              reviewCount={t.reviewCount}
              onPick={applyHit}
            />
          ) : null}
        </div>
      </FieldWrap>
      <p className="text-xs text-muted-foreground sm:col-span-2">{t.helper}</p>
    </div>
  )
}

function Dropdown({
  loading,
  hits,
  empty,
  reviewCount,
  onPick,
}: {
  loading: boolean
  hits: Hit[]
  empty: string
  reviewCount: (n: number) => string
  onPick: (h: Hit) => void
}) {
  return (
    <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[60vh] overflow-y-auto overscroll-contain rounded-md border border-border bg-card shadow-lg">
      {loading ? <div className="px-3 py-2.5 text-sm text-muted-foreground">…</div> : null}
      {!loading && hits.length === 0 ? (
        <div className="px-3 py-2.5 text-sm text-muted-foreground">{empty}</div>
      ) : null}
      {hits.length > 0 ? (
        <ul className="divide-y divide-border">
          {hits.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onPick(h)
                }}
                className="flex w-full items-center justify-between gap-3 bg-card px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {h.course_code ? `${h.course_code} — ${h.course_name}` : h.course_name}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {reviewCount(h.review_count)}
                  </div>
                </div>
                <span aria-hidden className="text-muted-foreground">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function FieldWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50'
