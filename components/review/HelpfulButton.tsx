'use client'

import { useState, useTransition } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { STRINGS } from '@/lib/strings'

interface Props {
  reviewId: number
  initialHelpfulCount: number
  /** When the page was rendered server-side, did the current user already vote? */
  initialVoted?: boolean
}

export function HelpfulButton({ reviewId, initialHelpfulCount, initialVoted = false }: Props) {
  const { status } = useSession()
  const [helpful, setHelpful] = useState(initialHelpfulCount)
  const [voted, setVoted] = useState(initialVoted)
  const [busy, setBusy] = useState(false)
  const [needSignIn, setNeedSignIn] = useState(false)
  const [, startTransition] = useTransition()

  async function onClick() {
    // Not signed in → prompt then trigger Google OAuth
    if (status === 'unauthenticated') {
      setNeedSignIn(true)
      return
    }
    if (status === 'loading' || busy) return

    // Optimistic toggle
    const nextVoted = !voted
    const prevHelpful = helpful
    const prevVoted = voted
    setVoted(nextVoted)
    setHelpful((c) => Math.max(0, c + (nextVoted ? 1 : -1)))
    setBusy(true)

    try {
      const res = await fetch(`/api/reviews/${reviewId}/helpful`, { method: 'POST' })
      if (!res.ok) {
        if (res.status === 401) {
          // Session probably expired between mount and click
          setNeedSignIn(true)
          setVoted(prevVoted)
          setHelpful(prevHelpful)
          return
        }
        throw new Error(`HTTP ${res.status}`)
      }
      const data = (await res.json()) as { voted: boolean; helpful_count: number }
      // Reconcile with server truth (in case our optimistic guess was wrong)
      startTransition(() => {
        setVoted(data.voted)
        setHelpful(data.helpful_count)
      })
    } catch (err) {
      console.error('helpful-vote toggle failed:', err)
      // Roll back optimistic update
      setVoted(prevVoted)
      setHelpful(prevHelpful)
    } finally {
      setBusy(false)
    }
  }

  if (needSignIn) {
    return (
      <button
        type="button"
        onClick={() => signIn('google')}
        className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
      >
        <HeartIcon active />
        {STRINGS.auth.signInToVote}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || status === 'loading'}
      aria-pressed={voted}
      title={voted ? STRINGS.reviewDisplay.helpful(helpful) : STRINGS.reviewDisplay.markHelpful}
      className={
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60 ' +
        (voted
          ? 'border-primary/40 bg-primary/15 text-primary'
          : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground')
      }
    >
      <HeartIcon active={voted} />
      <span className="tabular-nums">{helpful.toLocaleString('bn-BD')}</span>
      <span className="hidden sm:inline">{STRINGS.reviewDisplay.markHelpful}</span>
    </button>
  )
}

function HeartIcon({ active }: { active: boolean }) {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 5.65-7 10-7 10z"
      />
    </svg>
  )
}
