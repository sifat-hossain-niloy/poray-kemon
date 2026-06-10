'use client'

// ─────────────────────────────────────────────────────────────────────────────
// DepartmentTypeahead — search-as-you-type picker for the review form.
//
// Same shape as ProfessorTypeahead but scoped to a single university. The
// dropdown surfaces existing departments (verified first) and offers a
// dashed "+ Add 'xxxx' as a new department" fallback row. The server-side
// auto-create path (resolveDepartment in app/api/reviews/route.ts) parses
// the typed text into shortName + nameEn on submit, so the user can type
// any of:
//
//   "CSE"
//   "Computer Science and Engineering"
//   "CSE - Computer Science and Engineering"
//   "Computer Science and Engineering (CSE)"
//
// New rows are stored with status = 'unverified' so the admin merge tool
// can clean up duplicates later.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { useLocale } from '@/lib/i18n/client'
import { parseDepartmentName } from '@/lib/department-parser'

export interface DepartmentSelection {
  id: number | null // null = create on submit
  name_en: string // raw user input when id is null; persisted name otherwise
  short_name: string | null
}

interface Hit {
  id: number
  slug: string | null
  name_en: string
  name_bn: string | null
  short_name: string | null
  status: 'verified' | 'unverified'
  professor_count: number
}

interface Props {
  universityId: number
  /** When non-null the input is "locked" to that selection; user can clear it. */
  selection: DepartmentSelection | null
  onSelect: (selection: DepartmentSelection) => void
  onClear: () => void
  disabled?: boolean
}

export function DepartmentTypeahead({
  universityId,
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
  // When the user taps "+ Add as new", the dropdown swaps to a two-field
  // micro-form. We don't auto-create the dept in the catalog from a single
  // ambiguous input — making the user spell out short name and full name
  // explicitly produces clean data and means the admin merge tool only
  // needs to handle real duplicates, not parse-failures.
  const [addingNew, setAddingNew] = useState(false)
  const [newShortName, setNewShortName] = useState('')
  const [newNameEn, setNewNameEn] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const t =
    locale === 'en'
      ? {
          label: 'Department',
          placeholder: 'Type to search…',
          helper:
            'Type the short name or full name. If your department is not listed, you can add it — an admin will verify it before it goes public.',
          empty: 'No matches.',
          pickedExisting: 'Existing department',
          pickedNew: 'New department — pending admin verification',
          change: 'Change',
          addAsNew: (q: string) => `Add "${q}" as a new department`,
          professorCount: (n: number) =>
            n === 0 ? 'No professors yet' : `${n} professor${n === 1 ? '' : 's'}`,
          unverifiedBadge: 'Pending review',
          // New-department micro-form
          newFormTitle: 'Add a new department',
          newFormHelp:
            'Both fields are required. We submit it as "pending review"; an admin will verify, merge duplicates, or correct the spelling before it becomes searchable for other students.',
          shortLabel: 'Acronym',
          shortPlaceholder: 'e.g. CSE',
          fullLabel: 'Full name',
          fullPlaceholder: 'e.g. Computer Science and Engineering',
          cancel: 'Cancel',
          confirm: 'Add department',
        }
      : {
          label: 'বিভাগ',
          placeholder: 'খুঁজতে টাইপ করুন…',
          helper:
            'সংক্ষিপ্ত বা পূর্ণ নাম টাইপ করুন। তালিকায় না থাকলে নিজে যোগ করতে পারবেন — অ্যাডমিন যাচাই করার পর সবার জন্য দৃশ্যমান হবে।',
          empty: 'কোনো মিল নেই।',
          pickedExisting: 'বিদ্যমান বিভাগ',
          pickedNew: 'নতুন বিভাগ — অ্যাডমিন যাচাইয়ের অপেক্ষায়',
          change: 'পরিবর্তন',
          addAsNew: (q: string) => `"${q}" — নতুন বিভাগ হিসেবে যোগ করুন`,
          professorCount: (n: number) => (n === 0 ? 'এখনও কোনো শিক্ষক নেই' : `${n}জন শিক্ষক`),
          unverifiedBadge: 'যাচাই বাকি',
          newFormTitle: 'নতুন বিভাগ যোগ করুন',
          newFormHelp:
            'দুটো ঘরই পূরণ করুন। আমরা এটি "যাচাইয়ের অপেক্ষায়" হিসেবে যোগ করব; অ্যাডমিন পর্যালোচনা করে নিশ্চিত করার পর অন্যদের কাছে দৃশ্যমান হবে।',
          shortLabel: 'সংক্ষিপ্ত নাম',
          shortPlaceholder: 'যেমন: CSE',
          fullLabel: 'পূর্ণ নাম',
          fullPlaceholder: 'যেমন: কম্পিউটার বিজ্ঞান ও প্রকৌশল',
          cancel: 'বাতিল',
          confirm: 'বিভাগ যোগ করুন',
        }

  // Debounced fetch. State updates are scheduled via the debounce timer so
  // we never call setState synchronously inside the effect body (cascading
  // renders → react-hooks/set-state-in-effect).
  useEffect(() => {
    if (selection) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()

    debounceRef.current = setTimeout(() => {
      setLoading(true)
      if (abortRef.current) abortRef.current.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      const url = `/api/departments/search?q=${encodeURIComponent(q)}&university_id=${universityId}`
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
  }, [query, universityId, selection])

  // ── Locked-in selection card ─────────────────────────────────────────────
  if (selection) {
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium">{t.label} *</label>
        <div className="flex items-center justify-between gap-3 rounded-md border border-primary/60 bg-primary/5 px-3 py-2.5 text-sm">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-base font-semibold text-primary-foreground">
              {avatarLabel(selection.short_name, selection.name_en)}
            </span>
            <div className="min-w-0">
              <div className="truncate font-medium">
                {selection.short_name
                  ? `${selection.short_name} — ${selection.name_en}`
                  : selection.name_en}
              </div>
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
  const hasExactMatch = hits.some((h) => {
    const norm = trimmed.toLowerCase()
    return h.name_en.toLowerCase() === norm || (h.short_name ?? '').toLowerCase() === norm
  })
  // Offer "Add as new" once they've typed at least a meaningful chunk.
  // Department names are short ("CSE"), so we accept ≥ 2 chars.
  const showAddNew = trimmed.length >= 2 && !hasExactMatch
  // Show the dropdown whenever the field is focused, unless the user has
  // entered the "Add a new department" micro-form (then the form takes over).
  // With an empty query we still surface the full department list.
  const showDropdown = focused && !disabled && !addingNew

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium" htmlFor="dept-typeahead">
        {t.label} *
      </label>
      <p className="text-xs text-muted-foreground">{t.helper}</p>
      <div className="relative">
        <input
          id="dept-typeahead"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          placeholder={t.placeholder}
          disabled={disabled}
          autoComplete="off"
          className="w-full rounded-md border-2 border-primary/60 bg-card px-3 py-2.5 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
        />

        {showDropdown ? (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[60vh] overflow-y-auto overscroll-contain rounded-md border border-border bg-card shadow-lg">
            {loading ? <div className="px-3 py-2.5 text-sm text-muted-foreground">…</div> : null}

            {hits.length > 0 ? (
              <ul className="divide-y divide-border">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        onSelect({
                          id: h.id,
                          name_en: h.name_en,
                          short_name: h.short_name,
                        })
                        setQuery('')
                        setHits([])
                        setFocused(false)
                      }}
                      className="flex w-full items-center justify-between gap-3 bg-card px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-base font-semibold text-primary-foreground">
                          {avatarLabel(h.short_name, h.name_en)}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {h.short_name ? `${h.short_name} — ${h.name_en}` : h.name_en}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {h.status === 'unverified' ? (
                              <span className="mr-2 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                                {t.unverifiedBadge}
                              </span>
                            ) : null}
                            {t.professorCount(h.professor_count)}
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

            {!loading && hits.length === 0 && trimmed.length === 0 ? (
              <div className="px-3 py-2.5 text-sm text-muted-foreground">{t.empty}</div>
            ) : null}

            {showAddNew ? (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  // Pre-fill the micro-form by parsing whatever the user
                  // typed. "CSE - Computer Science and Engineering" splits
                  // cleanly into both fields; a bare "CSE" goes into the
                  // short-name field with the full-name left blank so the
                  // user has to fill it in deliberately.
                  const parsed = parseDepartmentName(trimmed)
                  const sn = parsed.shortName ?? ''
                  const fn =
                    parsed.shortName && parsed.nameEn === parsed.shortName ? '' : parsed.nameEn
                  setNewShortName(sn)
                  setNewNameEn(fn)
                  setAddingNew(true)
                }}
                className={
                  'flex w-full items-center gap-2 bg-card px-3 py-2.5 text-left text-sm font-medium text-primary transition-colors hover:bg-primary/10 ' +
                  (hits.length > 0 ? 'border-t border-border' : '')
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

        {addingNew ? (
          <NewDepartmentForm
            locale={locale}
            t={t}
            shortName={newShortName}
            setShortName={setNewShortName}
            nameEn={newNameEn}
            setNameEn={setNewNameEn}
            onCancel={() => {
              setAddingNew(false)
              setNewShortName('')
              setNewNameEn('')
            }}
            onConfirm={() => {
              const sn = newShortName.trim().slice(0, 20)
              const fn = newNameEn.trim().slice(0, 200)
              if (!fn) return
              onSelect({
                id: null,
                name_en: fn,
                short_name: sn || null,
              })
              setAddingNew(false)
              setNewShortName('')
              setNewNameEn('')
              setQuery('')
              setHits([])
              setFocused(false)
            }}
          />
        ) : null}
      </div>
    </div>
  )
}

// ── New-department micro-form ────────────────────────────────────────────────
// Inline panel that swaps in below the typeahead when the user taps "+ Add
// as new". Two required fields (acronym, full name) with smart prefill from
// the search query, plus an explanation of the admin-verification loop.

interface NewDeptFormProps {
  locale: 'en' | 'bn'
  t: {
    newFormTitle: string
    newFormHelp: string
    shortLabel: string
    shortPlaceholder: string
    fullLabel: string
    fullPlaceholder: string
    cancel: string
    confirm: string
  }
  shortName: string
  setShortName: (s: string) => void
  nameEn: string
  setNameEn: (s: string) => void
  onCancel: () => void
  onConfirm: () => void
}

function NewDepartmentForm({
  t,
  shortName,
  setShortName,
  nameEn,
  setNameEn,
  onCancel,
  onConfirm,
}: NewDeptFormProps) {
  const canConfirm = nameEn.trim().length >= 2
  return (
    <div className="mt-3 rounded-md border-2 border-dashed border-primary/60 bg-primary/5 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{t.newFormTitle}</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{t.newFormHelp}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr]">
        <label className="block space-y-1.5">
          <span className="block text-xs font-medium">{t.shortLabel}</span>
          <input
            type="text"
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            placeholder={t.shortPlaceholder}
            maxLength={20}
            autoComplete="off"
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="block text-xs font-medium">{t.fullLabel} *</span>
          <input
            type="text"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder={t.fullPlaceholder}
            maxLength={200}
            autoComplete="off"
            className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            required
          />
        </label>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          {t.cancel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!canConfirm}
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity disabled:opacity-50"
        >
          {t.confirm}
        </button>
      </div>
    </div>
  )
}

/** Compact avatar label — short name if present (e.g. "CSE"), else first
 *  meaningful letter of the full name. */
function avatarLabel(shortName: string | null, nameEn: string): string {
  if (shortName && shortName.length > 0) {
    return shortName.slice(0, 3).toUpperCase()
  }
  const trimmed = nameEn.trim()
  if (!trimmed) return '?'
  return trimmed[0]!.toUpperCase()
}
