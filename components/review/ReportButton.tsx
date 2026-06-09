'use client'

import { useEffect, useRef, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { useLocale, useStrings } from '@/lib/i18n/client'
import { REPORT_REASONS } from '@/lib/reports'

interface Props {
  reviewId: number
}

type Reason = (typeof REPORT_REASONS)[number]

export function ReportButton({ reviewId }: Props) {
  const strings = useStrings()
  const locale = useLocale()
  const REASON_LABELS = strings.report.reasons satisfies Record<Reason, string>
  const { status } = useSession()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [reason, setReason] = useState<Reason | ''>('')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Reset state every time the dialog opens
  function open() {
    if (status === 'unauthenticated') {
      void signIn('google')
      return
    }
    setReason('')
    setDetails('')
    setError(null)
    setDone(false)
    dialogRef.current?.showModal()
  }

  function close() {
    dialogRef.current?.close()
  }

  // Close on backdrop click — native <dialog> doesn't do this by default
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    function onClick(e: MouseEvent) {
      if (e.target === dialog) close()
    }
    dialog.addEventListener('click', onClick)
    return () => dialog.removeEventListener('click', onClick)
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason) {
      setError(locale === 'en' ? 'Pick a reason' : 'একটি কারণ বেছে নিন')
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_id: reviewId,
          reason,
          details: details.trim() || undefined,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        message?: string
      }

      if (!res.ok) {
        if (res.status === 401) {
          void signIn('google')
          return
        }
        setError(body.error ?? (locale === 'en' ? 'Report failed' : 'রিপোর্ট ব্যর্থ হয়েছে'))
        return
      }
      setDone(true)
    } catch (err) {
      console.error(err)
      setError(strings.errors.serverError)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive"
      >
        <FlagIcon />
        {strings.reviewDisplay.report}
      </button>

      <dialog
        ref={dialogRef}
        className="m-auto w-full max-w-md rounded-2xl border border-border bg-popover p-0 text-popover-foreground shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
      >
        {done ? (
          <div className="space-y-4 p-6 text-center">
            <h2 className="text-lg font-semibold">{strings.report.success}</h2>
            <Button type="button" onClick={close}>
              {locale === 'en' ? 'Close' : 'বন্ধ করুন'}
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4 p-6">
            <header>
              <h2 className="text-lg font-semibold">{strings.report.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {locale === 'en'
                  ? 'An admin will review your report.'
                  : 'আপনার রিপোর্ট অ্যাডমিন পর্যালোচনা করবেন।'}
              </p>
            </header>

            {/* Reason — radio group */}
            <fieldset className="space-y-2">
              <legend className="sr-only">{locale === 'en' ? 'Reason' : 'কারণ'}</legend>
              {REPORT_REASONS.map((r) => (
                <label
                  key={r}
                  className={
                    'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors ' +
                    (reason === r
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card hover:bg-muted')
                  }
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                    className="h-4 w-4 accent-primary"
                  />
                  <span>{REASON_LABELS[r]}</span>
                </label>
              ))}
            </fieldset>

            {/* Optional details */}
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">
                {locale === 'en' ? 'Anything to add? (optional)' : 'আরও কিছু বলবেন? (ঐচ্ছিক)'}
              </span>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={500}
                rows={3}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>

            {error ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            ) : null}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={close} className="flex-1">
                {locale === 'en' ? 'Cancel' : 'বাতিল'}
              </Button>
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting
                  ? locale === 'en'
                    ? 'Submitting…'
                    : '...জমা দিচ্ছি'
                  : strings.report.submitButton}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </>
  )
}

function FlagIcon() {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 22V4a1 1 0 0 1 1-1h11l-2 4 2 4H5" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  )
}
