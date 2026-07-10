'use client'

// ─────────────────────────────────────────────────────────────────────────────
// UniversityTypeahead — search-as-you-type picker for the review form's
// university field.
//
// Same debounced/opaque-panel pattern as DepartmentTypeahead. The key
// difference: unmatched input opens a "Request new university" micro-form
// rather than an auto-create flow, because universities are heavier and
// admin-vetted (FR-DIR-07). Submitting the form creates a
// UniversityRequest row and shows the user a "waiting for admin" success
// message — the review submission itself cannot proceed until an admin
// approves the request.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { useLocale } from '@/lib/i18n/client'

export interface UniversitySelection {
  id: number
  name_en: string
  short_name: string
}

interface Hit {
  id: number
  slug: string
  name_en: string
  name_bn: string | null
  short_name: string
  type: 'public' | 'private' | 'international'
  location_city: string | null
}

interface Props {
  /** Currently locked-in selection (id + name_en + short_name), or null. */
  selection: UniversitySelection | null
  onSelect: (u: UniversitySelection) => void
  onClear: () => void
  /** Whether the user has an authenticated session — controls whether the
   *  "Request new university" affordance can even open. Unauthenticated
   *  users see a sign-in prompt instead. */
  isAuthenticated: boolean
}

type UniversityType = 'public' | 'private' | 'international'

export function UniversityTypeahead({ selection, onSelect, onClear, isAuthenticated }: Props) {
  const locale = useLocale()
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  // Request-new sub-form state.
  const [requesting, setRequesting] = useState(false)
  const [reqName, setReqName] = useState('')
  const [reqNameBn, setReqNameBn] = useState('')
  const [reqType, setReqType] = useState<UniversityType | ''>('')
  const [reqBusy, setReqBusy] = useState(false)
  const [reqError, setReqError] = useState<string | null>(null)
  // After a successful submit we swap the sub-form for a "request received"
  // confirmation card. It clears when the user starts a new search.
  const [reqConfirmedName, setReqConfirmedName] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const t =
    locale === 'en'
      ? {
          label: 'University',
          placeholder: 'Type to search — e.g. BUET, University of Dhaka',
          helper:
            'Type the short name (BUET) or the full name. If your university is not listed, you can request an admin to add it.',
          empty: 'No matches.',
          change: 'Change',
          reqButton: (q: string) => `Request "${q}" as a new university`,
          reqTitle: 'Request a new university',
          reqHelp:
            'A message will be sent to the admins. Once approved, you can submit your review. This usually takes a day.',
          reqNameLabel: 'University name (English)',
          reqNameHelp: 'Full name in English — e.g. "United International University".',
          reqNameBnLabel: 'Bangla name (optional)',
          reqTypeLabel: 'Type',
          reqTypeOptions: {
            public: 'Public',
            private: 'Private',
            international: 'International',
          },
          reqSignInNote: 'Sign in to request a new university.',
          reqSend: 'Send request',
          reqCancel: 'Cancel',
          reqSuccessTitle: 'Request sent!',
          reqSuccessBody: (name: string) =>
            `"${name}" has been sent to the admins for review. You'll be able to submit a review for it once it's approved.`,
          reqDone: 'Done',
        }
      : {
          label: 'বিশ্ববিদ্যালয়',
          placeholder: 'খুঁজতে টাইপ করুন — যেমন BUET, ঢাকা বিশ্ববিদ্যালয়',
          helper:
            'সংক্ষিপ্ত (BUET) বা পূর্ণ নাম টাইপ করুন। তালিকায় না থাকলে অ্যাডমিনকে যোগ করতে অনুরোধ পাঠাতে পারবেন।',
          empty: 'কোনো মিল নেই।',
          change: 'পরিবর্তন',
          reqButton: (q: string) => `"${q}" — নতুন বিশ্ববিদ্যালয় হিসেবে অনুরোধ পাঠান`,
          reqTitle: 'নতুন বিশ্ববিদ্যালয় অনুরোধ',
          reqHelp:
            'অ্যাডমিনদের কাছে অনুরোধ পাঠানো হবে। অনুমোদন পেলে আপনি রিভিউ জমা দিতে পারবেন। সাধারণত ১ দিন সময় লাগে।',
          reqNameLabel: 'বিশ্ববিদ্যালয়ের নাম (ইংরেজিতে)',
          reqNameHelp: 'ইংরেজিতে পূর্ণ নাম — যেমন "United International University"।',
          reqNameBnLabel: 'বাংলা নাম (ঐচ্ছিক)',
          reqTypeLabel: 'ধরন',
          reqTypeOptions: {
            public: 'পাবলিক',
            private: 'প্রাইভেট',
            international: 'আন্তর্জাতিক',
          },
          reqSignInNote: 'নতুন বিশ্ববিদ্যালয় অনুরোধ পাঠাতে সাইন ইন করুন।',
          reqSend: 'অনুরোধ পাঠান',
          reqCancel: 'বাতিল',
          reqSuccessTitle: 'অনুরোধ পাঠানো হয়েছে!',
          reqSuccessBody: (name: string) =>
            `"${name}" পর্যালোচনার জন্য অ্যাডমিনদের কাছে পাঠানো হয়েছে। অনুমোদন পেলে আপনি রিভিউ জমা দিতে পারবেন।`,
          reqDone: 'সম্পন্ন',
        }

  // Debounced search
  useEffect(() => {
    if (selection) return
    if (requesting) return
    if (!focused) return
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(() => {
      setLoading(true)
      if (abortRef.current) abortRef.current.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      const url = `/api/universities/search?q=${encodeURIComponent(query.trim())}`
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
  }, [query, focused, selection, requesting])

  async function submitRequest() {
    if (!isAuthenticated) return
    const nameEn = reqName.trim()
    if (nameEn.length < 2 || !reqType) return
    setReqError(null)
    setReqBusy(true)
    try {
      const res = await fetch('/api/university-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameEn,
          nameBn: reqNameBn.trim() || undefined,
          type: reqType,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setReqError(body.error ?? `Failed (${res.status})`)
        return
      }
      setReqConfirmedName(nameEn)
      setRequesting(false)
      setReqName('')
      setReqNameBn('')
      setReqType('')
    } catch (err) {
      console.error(err)
      setReqError('Server error')
    } finally {
      setReqBusy(false)
    }
  }

  // ── Locked-in selection ───────────────────────────────────────────────
  if (selection) {
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-medium">{t.label} *</label>
        <div className="flex items-center justify-between gap-3 rounded-md border border-primary/60 bg-primary/5 px-3 py-2.5 text-sm">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
              {selection.short_name.slice(0, 5)}
            </span>
            <div className="min-w-0">
              <div className="truncate font-medium">
                {selection.short_name} — {selection.name_en}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onClear()
              setQuery('')
              setHits([])
              setReqConfirmedName(null)
            }}
            className="shrink-0 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted"
          >
            {t.change}
          </button>
        </div>
      </div>
    )
  }

  const trimmed = query.trim()
  const hasExactMatch = hits.some(
    (h) =>
      h.name_en.toLowerCase() === trimmed.toLowerCase() ||
      h.short_name.toLowerCase() === trimmed.toLowerCase(),
  )
  const showRequestBtn = trimmed.length >= 2 && !hasExactMatch
  const showDropdown = focused && !requesting && reqConfirmedName === null

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium" htmlFor="uni-typeahead">
        {t.label} *
      </label>
      <p className="text-xs text-muted-foreground">{t.helper}</p>

      {reqConfirmedName ? (
        <div className="rounded-md border-2 border-primary/60 bg-primary/5 p-4 text-sm">
          <div className="mb-2 font-semibold">✓ {t.reqSuccessTitle}</div>
          <p className="text-xs text-muted-foreground">{t.reqSuccessBody(reqConfirmedName)}</p>
          <button
            type="button"
            onClick={() => setReqConfirmedName(null)}
            className="mt-3 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium hover:bg-muted"
          >
            {t.reqDone}
          </button>
        </div>
      ) : null}

      {reqConfirmedName === null ? (
        <div className="relative">
          <input
            id="uni-typeahead"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 120)}
            placeholder={t.placeholder}
            disabled={requesting}
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
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
                            {h.short_name.slice(0, 5)}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {h.short_name} — {h.name_en}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {[h.type, h.location_city].filter(Boolean).join(' · ')}
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

              {showRequestBtn ? (
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    if (!isAuthenticated) return
                    setReqName(trimmed)
                    setReqNameBn('')
                    setReqType('')
                    setReqError(null)
                    setRequesting(true)
                    setFocused(false)
                  }}
                  disabled={!isAuthenticated}
                  className={
                    'flex w-full items-center gap-2 bg-card px-3 py-2.5 text-left text-sm font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60 ' +
                    (hits.length > 0 ? 'border-t border-border' : '')
                  }
                >
                  <span aria-hidden className="text-lg leading-none">
                    +
                  </span>
                  <span className="truncate">
                    {isAuthenticated ? t.reqButton(trimmed) : t.reqSignInNote}
                  </span>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {requesting ? (
        <div className="rounded-md border-2 border-dashed border-primary/60 bg-primary/5 p-4">
          <h3 className="mb-2 text-sm font-semibold">{t.reqTitle}</h3>
          <p className="mb-3 text-xs text-muted-foreground">{t.reqHelp}</p>
          <div className="space-y-3">
            <label className="block space-y-1.5">
              <span className="block text-xs font-medium">{t.reqNameLabel} *</span>
              <input
                type="text"
                value={reqName}
                onChange={(e) => setReqName(e.target.value)}
                maxLength={200}
                autoComplete="off"
                required
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <span className="block text-[11px] text-muted-foreground">{t.reqNameHelp}</span>
            </label>

            <label className="block space-y-1.5">
              <span className="block text-xs font-medium">{t.reqNameBnLabel}</span>
              <input
                type="text"
                value={reqNameBn}
                onChange={(e) => setReqNameBn(e.target.value)}
                maxLength={200}
                autoComplete="off"
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <fieldset className="space-y-1.5">
              <legend className="block text-xs font-medium">{t.reqTypeLabel} *</legend>
              <div className="flex flex-wrap gap-2">
                {(['public', 'private', 'international'] as const).map((v) => (
                  <label
                    key={v}
                    className={
                      'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors ' +
                      (reqType === v
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card hover:bg-muted')
                    }
                  >
                    <input
                      type="radio"
                      name="uni-type"
                      value={v}
                      checked={reqType === v}
                      onChange={() => setReqType(v)}
                      className="hidden"
                    />
                    {t.reqTypeOptions[v]}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          {reqError ? (
            <div className="mt-3 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {reqError}
            </div>
          ) : null}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setRequesting(false)
                setReqError(null)
              }}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
              disabled={reqBusy}
            >
              {t.reqCancel}
            </button>
            <button
              type="button"
              onClick={submitRequest}
              disabled={reqBusy || reqName.trim().length < 2 || !reqType}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity disabled:opacity-50"
            >
              {reqBusy ? '…' : t.reqSend}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
