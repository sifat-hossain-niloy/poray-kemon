'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { SearchResult, SearchResultKind } from '@/lib/search'
import { useStrings, useLocale } from '@/lib/i18n/client'
import { Badge } from '@/components/ui/badge'

const KIND_LABELS_BN: Record<SearchResultKind, string> = {
  university: 'বিশ্ববিদ্যালয়',
  department: 'বিভাগ',
  professor: 'শিক্ষক',
}
const KIND_LABELS_EN: Record<SearchResultKind, string> = {
  university: 'University',
  department: 'Department',
  professor: 'Professor',
}

const KIND_VARIANT: Record<SearchResultKind, 'default' | 'secondary' | 'outline'> = {
  university: 'default',
  department: 'secondary',
  professor: 'outline',
}

interface Props {
  /** Visual style — homepage uses 'hero' (big), navbar uses 'compact' (small) */
  variant?: 'hero' | 'compact'
  /** Defaults to the placeholder from STRINGS */
  placeholder?: string
  autoFocus?: boolean
}

export function SearchBox({ variant = 'hero', placeholder, autoFocus = false }: Props) {
  const router = useRouter()
  const strings = useStrings()
  const locale = useLocale()
  const KIND_LABELS = locale === 'en' ? KIND_LABELS_EN : KIND_LABELS_BN

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [, startTransition] = useTransition()

  const containerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // ── Debounced fetch ────────────────────────────────────────────────────────
  useEffect(() => {
    const q = query.trim()

    // Cancel any in-flight request when query changes
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    if (q.length < 2) {
      // No fetch; results will be naturally empty for too-short queries.
      // The render reads `results` directly so we don't need to set state here.
      return
    }

    // 200ms debounce — enough to avoid hammering on every keystroke
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`, {
          signal: ctrl.signal,
        })
        if (!res.ok) return
        const data = (await res.json()) as { results: SearchResult[] }
        setResults(data.results)
        setOpen(true)
        setActiveIndex(-1)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') console.error(err)
      }
    }, 200)

    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query])

  // Stale results when query gets too short: filter at render time instead of
  // mutating state inside the effect. This keeps the effect setState-free.
  const visibleResults = query.trim().length >= 2 ? results : []

  // ── Click-outside to close ─────────────────────────────────────────────────
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  // ── Keyboard nav ───────────────────────────────────────────────────────────
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (visibleResults.length > 0) {
        setOpen(true)
        setActiveIndex((i) => (i + 1) % visibleResults.length)
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (visibleResults.length > 0) {
        setOpen(true)
        setActiveIndex((i) => (i <= 0 ? visibleResults.length - 1 : i - 1))
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const active = activeIndex >= 0 ? visibleResults[activeIndex] : null
      if (active) {
        startTransition(() => router.push(active.href))
      } else if (query.trim().length >= 2) {
        startTransition(() => router.push(`/search?q=${encodeURIComponent(query.trim())}`))
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const showDropdown = open && query.trim().length >= 2

  const inputClasses =
    variant === 'hero'
      ? 'w-full rounded-2xl border border-border bg-card px-5 py-4 pl-12 text-base shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20'
      : 'w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20'

  const iconClasses =
    variant === 'hero'
      ? 'absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground pointer-events-none'
      : 'absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none'

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <svg
          aria-hidden="true"
          className={iconClasses}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={variant === 'hero' ? 1.5 : 2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
        <input
          type="search"
          name="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder ?? strings.site.searchPlaceholder}
          autoFocus={autoFocus}
          autoComplete="off"
          spellCheck={false}
          aria-autocomplete="list"
          aria-controls="search-results-listbox"
          className={inputClasses}
        />
      </div>

      {showDropdown && (
        <div
          id="search-results-listbox"
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-lg ring-1 ring-black/5"
        >
          {visibleResults.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {locale === 'en' ? 'No results found' : 'কোনো ফলাফল পাওয়া যায়নি'}
            </div>
          ) : (
            <ul className="py-1">
              {visibleResults.map((r, i) => (
                <li key={`${r.kind}-${r.id}`} role="option" aria-selected={i === activeIndex}>
                  <Link
                    href={r.href}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => setOpen(false)}
                    className={
                      'flex items-center gap-3 px-3 py-2 text-left transition-colors ' +
                      (i === activeIndex ? 'bg-muted' : 'hover:bg-muted/60')
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{r.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{r.subtitle}</div>
                    </div>
                    <Badge variant={KIND_VARIANT[r.kind]} className="shrink-0 text-[10px]">
                      {KIND_LABELS[r.kind]}
                    </Badge>
                  </Link>
                </li>
              ))}
              <li className="border-t border-border">
                <Link
                  href={`/search?q=${encodeURIComponent(query.trim())}`}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 text-center text-xs font-medium text-primary hover:bg-muted/60"
                >
                  {locale === 'en' ? 'See all results →' : 'সব ফলাফল দেখুন →'}
                </Link>
              </li>
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
