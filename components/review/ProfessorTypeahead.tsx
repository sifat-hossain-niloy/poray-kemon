'use client'

// ─────────────────────────────────────────────────────────────────────────────
// ProfessorTypeahead — search-as-you-type picker for the review form.
//
// Behaviour:
//   - User types → debounced fetch to /api/professors/search (scoped to the
//     selected university + department).
//   - Matches render as tappable rows (initial-letter avatar, name, subtitle).
//   - A dashed "Add 'xxxx' as a new professor" row always appears below the
//     matches (or in place of them when the API returns nothing) so a student
//     can submit even when the professor isn't in our catalog yet.
//   - When the user selects an existing professor, the parent receives an
//     `existing` selection { id, name_en }. When they tap "Add as new", the
//     parent receives `{ id: null, name_en: <trimmed query> }`. The review POST
//     handler already auto-creates Professor rows when `professor_id` is
//     absent — we don't need to create anything client-side.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { useLocale } from '@/lib/i18n/client'

export interface ProfessorSelection {
  id: number | null // null = create on submit
  name_en: string
}

interface Hit {
  id: number
  slug: string
  name_en: string
  name_bn: string | null
  designation: string | null
  review_count: number
}

interface Props {
  universityId: number
  departmentId: number
  /** When non-null the input is "locked" to that selection; user can clear it. */
  selection: ProfessorSelection | null
  onSelect: (selection: ProfessorSelection) => void
  onClear: () => void
  disabled?: boolean
}

export function ProfessorTypeahead({
  universityId,
  departmentId,
  selection,
  onSelect,
  onClear,
  disabled,
}: Props) {
  const locale = useLocale()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const t =
    locale === 'en'
      ? {
          label: 'Professor',
          placeholder: 'Start typing the name…',
          empty: 'No matches yet.',
          pickedExisting: 'Existing professor',
          pickedNew: 'New professor — will be added when you submit',
          change: 'Change',
          addAsNew: (q: string) => `Add "${q}" as a new professor`,
          reviewCount: (n: number) =>
            n === 0 ? 'No reviews yet' : `${n} review${n === 1 ? '' : 's'}`,
          helper: 'Type in English. We’ll show matches as you go.',
        }
      : {
          label: 'শিক্ষক',
          placeholder: 'শিক্ষকের নাম টাইপ করুন…',
          empty: 'এখনও কোনো মিল পাওয়া যায়নি।',
          pickedExisting: 'বিদ্যমান শিক্ষক',
          pickedNew: 'নতুন শিক্ষক — সাবমিট করলে যোগ হবে',
          change: 'পরিবর্তন',
          addAsNew: (q: string) => `"${q}" — নতুন শিক্ষক হিসেবে যোগ করুন`,
          reviewCount: (n: number) => (n === 0 ? 'এখনও কোনো রিভিউ নেই' : `${n}টি রিভিউ`),
          helper: 'ইংরেজিতে টাইপ করুন। টাইপ করার সাথে সাথে মিল দেখাবো।',
        }

  // Debounced fetch. State updates are scheduled via the debounce timer so
  // we never call setState synchronously inside the effect body — that would
  // trigger cascading renders (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (selection) return // when a pick is locked in we don't fetch
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()

    debounceRef.current = setTimeout(() => {
      if (q.length < 1) {
        setHits([])
        setLoading(false)
        return
      }
      setLoading(true)
      if (abortRef.current) abortRef.current.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      const url = `/api/professors/search?q=${encodeURIComponent(q)}&university_id=${universityId}&department_id=${departmentId}`
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
  }, [query, universityId, departmentId, selection])

  // ── Locked-in selection card ─────────────────────────────────────────────
  if (selection) {
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium">{t.label} *</label>
        <div className="flex items-center justify-between gap-3 rounded-md border border-primary/60 bg-primary/5 px-3 py-2.5 text-sm">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-base font-semibold text-primary-foreground">
              {initial(selection.name_en)}
            </span>
            <div className="min-w-0">
              <div className="truncate font-medium">{selection.name_en}</div>
              <div className="truncate text-xs text-muted-foreground">
                {selection.id ? t.pickedExisting : t.pickedNew}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onClear()
              setQuery('')
              setHits([])
            }}
            className="shrink-0 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted"
          >
            {t.change}
          </button>
        </div>
      </div>
    )
  }

  // ── Active search UI ─────────────────────────────────────────────────────
  const trimmed = query.trim()
  const hasExactMatch = hits.some((h) => h.name_en.toLowerCase() === trimmed.toLowerCase())
  // Show "Add as new" once the user has typed something meaningful and we
  // didn't surface an exact match (case-insensitive). The catch-all guard
  // (length ≥ 2) prevents the chip from flashing on a single keystroke.
  const showAddNew = trimmed.length >= 2 && !hasExactMatch
  const showDropdown = focused && trimmed.length >= 1 && !disabled

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium" htmlFor="prof-typeahead">
        {t.label} *
      </label>
      <p className="text-xs text-muted-foreground">{t.helper}</p>
      <div className="relative">
        <input
          id="prof-typeahead"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          // Delay blur so a click on a dropdown row still registers.
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          placeholder={t.placeholder}
          disabled={disabled}
          autoComplete="off"
          className="w-full rounded-md border-2 border-primary/60 bg-card px-3 py-2.5 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
        />

        {showDropdown ? (
          // Opaque floating panel — without bg-card + shadow on the wrapper,
          // the absolute children let the form rows beneath bleed through.
          <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[60vh] overflow-y-auto overscroll-contain rounded-md border border-border bg-card shadow-lg">
            {loading ? <div className="px-3 py-2.5 text-sm text-muted-foreground">…</div> : null}

            {hits.length > 0 ? (
              <ul className="divide-y divide-border">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      // onMouseDown so the click fires before onBlur closes the dropdown.
                      onMouseDown={(e) => {
                        e.preventDefault()
                        onSelect({ id: h.id, name_en: h.name_en })
                        setQuery('')
                        setHits([])
                        setFocused(false)
                      }}
                      className="flex w-full items-center justify-between gap-3 bg-card px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-base font-semibold text-primary-foreground">
                          {initial(h.name_en)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium">{h.name_en}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {[h.designation, t.reviewCount(h.review_count)]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
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

            {!loading && hits.length === 0 && trimmed.length >= 1 && !showAddNew ? (
              <div className="px-3 py-2.5 text-sm text-muted-foreground">{t.empty}</div>
            ) : null}

            {showAddNew ? (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  onSelect({ id: null, name_en: trimmed })
                  setQuery('')
                  setHits([])
                  setFocused(false)
                }}
                className={
                  'flex w-full items-center gap-2 bg-card px-3 py-2.5 text-left text-sm font-medium text-primary transition-colors hover:bg-primary/10 ' +
                  (hits.length > 0 || (!loading && trimmed.length >= 1)
                    ? 'border-t border-border'
                    : '')
                }
              >
                <span aria-hidden className="text-lg leading-none">
                  +
                </span>
                <span className="truncate">{t.addAsNew(trimmed)}</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function initial(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  // Skip an honorific so "Dr. Rahman" shows R, not D.
  const stripped = trimmed.replace(/^(dr\.?|prof\.?|mr\.?|ms\.?|mrs\.?)\s+/i, '')
  return stripped[0]!.toUpperCase()
}
