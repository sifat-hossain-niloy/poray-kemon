'use client'

// Self-serve account deletion. The confirmation is an inline panel rather
// than window.confirm so it can spell out what is deleted, what stays, and
// that previously reviewed courses stay closed. Self-contained so it can sit
// on /privacy now and on /me once that page lands.

import { useId, useState } from 'react'
import { signIn, signOut, useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { useLocale, useStrings } from '@/lib/i18n/client'

type Phase = 'idle' | 'confirming' | 'deleting' | 'deleted' | 'error'

export function DeleteAccountSection({ returnTo }: { returnTo: string }) {
  const locale = useLocale()
  const strings = useStrings()
  const s = strings.account
  const { status } = useSession()
  const [phase, setPhase] = useState<Phase>('idle')
  const [acknowledged, setAcknowledged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const checkboxId = useId()

  async function deleteAccount() {
    setPhase('deleting')
    setError(null)
    try {
      const res = await fetch('/api/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: true }),
      })
      if (res.status === 401) {
        await signIn('google', { callbackUrl: returnTo })
        return
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? s.failed)
        setPhase('error')
        return
      }
      setPhase('deleted')
      await signOut({ callbackUrl: `/${locale}` })
    } catch {
      setError(s.failed)
      setPhase('error')
    }
  }

  return (
    <section
      id="delete-account"
      aria-labelledby="delete-account-heading"
      className="space-y-3 rounded-lg border border-destructive/30 p-4"
    >
      <h2 id="delete-account-heading" className="text-xl font-semibold tracking-tight">
        {s.deleteHeading}
      </h2>
      <p className="text-sm leading-relaxed text-foreground/90">{s.deleteIntro}</p>

      {status === 'unauthenticated' ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">{s.signInToDelete}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => signIn('google', { callbackUrl: returnTo })}
          >
            {strings.auth.signInWithGoogle}
          </Button>
        </div>
      ) : status === 'loading' ? null : phase === 'idle' ? (
        <Button variant="destructive" onClick={() => setPhase('confirming')}>
          {s.deleteButton}
        </Button>
      ) : phase === 'deleted' ? (
        <p role="status" className="text-sm font-medium">
          {s.deleted}
        </p>
      ) : (
        <div className="space-y-3 rounded-md bg-destructive/5 p-4">
          <h3 className="font-semibold">{s.confirmTitle}</h3>
          <ul className="space-y-2 text-sm leading-relaxed">
            <li>{s.confirmRemoved}</li>
            <li>{s.confirmKept}</li>
            <li>{s.confirmNoRereview}</li>
          </ul>
          <label htmlFor={checkboxId} className="flex items-start gap-2 text-sm">
            <input
              id={checkboxId}
              type="checkbox"
              className="mt-1"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              disabled={phase === 'deleting'}
            />
            <span>{s.confirmCheckbox}</span>
          </label>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="destructive"
              disabled={!acknowledged || phase === 'deleting'}
              onClick={deleteAccount}
            >
              {phase === 'deleting' ? s.deleting : s.confirmButton}
            </Button>
            <Button
              variant="ghost"
              disabled={phase === 'deleting'}
              onClick={() => {
                setPhase('idle')
                setAcknowledged(false)
                setError(null)
              }}
            >
              {s.cancel}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
