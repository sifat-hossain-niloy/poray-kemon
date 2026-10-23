'use client'

import { useEffect, useRef, useState } from 'react'
import { LocaleLink as Link } from '@/components/i18n/LocaleLink'
import type { SearchResult } from '@/lib/search'
import { compareHref } from '@/lib/compare'

interface Props {
  /** Professors already in the comparison, in column order. */
  ids: string[]
  labels: { placeholder: string; noMatches: string }
}

// Each hit is a plain link to the next comparison URL, so picking one is a
// normal navigation (works with keyboard, middle-click, and back button).
export function CompareAdder({ ids, labels }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const q = query.trim()
    abortRef.current?.abort()
    if (q.length < 2) return
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=10`, {
          signal: ctrl.signal,
        })
        if (!res.ok) return
        const data = (await res.json()) as { results: SearchResult[] }
        setResults(data.results.filter((r) => r.kind === 'professor' && !ids.includes(r.slug)))
      } catch (err) {
        if ((err as Error).name !== 'AbortError') console.error(err)
      }
    }, 200)
    return () => clearTimeout(t)
  }, [query, ids])

  const showResults = query.trim().length >= 2 && results !== null

  return (
    <div className="relative">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={labels.placeholder}
        aria-label={labels.placeholder}
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {showResults ? (
        <ul className="absolute z-20 mt-1 max-h-[60vh] w-full overflow-y-auto rounded-md border border-border bg-card shadow-lg">
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">{labels.noMatches}</li>
          ) : (
            results.map((r) => (
              <li key={r.slug}>
                <Link
                  href={compareHref([...ids, r.slug])}
                  className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm hover:bg-muted"
                >
                  <span className="font-medium">{r.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{r.subtitle}</span>
                </Link>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
