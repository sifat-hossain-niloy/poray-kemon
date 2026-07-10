'use client'

// ─────────────────────────────────────────────────────────────────────────────
// AdminUniversityRequestActions — approve / reject controls for a single
// pending UniversityRequest row.
//
// Approve flow: opens a small edit panel where the admin can polish
// short_name / slug / location_city before publishing. The requester
// supplied only nameEn + nameBn + type; those are the only fields we let
// them touch, since acronym and slug choices belong to the admin.
//
// Reject flow: opens a note field so the requester eventually understands
// why (surfaced back to them via future notification hook — for now the
// note lives in the DB for audit).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface Props {
  requestId: number
  initialShortName: string
  initialSlug: string
}

type Mode = 'idle' | 'approve' | 'reject'

export function AdminUniversityRequestActions({ requestId, initialShortName, initialSlug }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [mode, setMode] = useState<Mode>('idle')
  const [shortName, setShortName] = useState(initialShortName)
  const [slug, setSlug] = useState(initialSlug)
  const [locationCity, setLocationCity] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(action: 'approve' | 'reject') {
    setError(null)
    setBusy(true)
    try {
      const body: Record<string, unknown> = { action }
      if (action === 'approve') {
        body.short_name = shortName.trim() || undefined
        body.slug = slug.trim() || undefined
        body.location_city = locationCity.trim() || undefined
      }
      if (note.trim()) body.admin_note = note.trim()

      const res = await fetch(`/api/admin/university-requests/${requestId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setError(j.error ?? `Failed (${res.status})`)
        return
      }
      startTransition(() => router.refresh())
    } catch (err) {
      console.error(err)
      setError('Server error')
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'idle') {
    return (
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button type="button" size="sm" onClick={() => setMode('approve')} disabled={pending}>
          Approve →
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setMode('reject')}
          disabled={pending}
        >
          Reject
        </Button>
      </div>
    )
  }

  if (mode === 'approve') {
    return (
      <div className="rounded-md border border-primary/40 bg-primary/5 p-3">
        <h4 className="mb-2 text-sm font-semibold">Approve — polish before publishing</h4>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <label className="block space-y-1">
            <span className="block text-xs font-medium">Short name *</span>
            <input
              type="text"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              maxLength={20}
              className={inputClass}
            />
          </label>
          <label className="block space-y-1">
            <span className="block text-xs font-medium">Slug *</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              maxLength={50}
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              className={inputClass}
            />
          </label>
          <label className="block space-y-1">
            <span className="block text-xs font-medium">City</span>
            <input
              type="text"
              value={locationCity}
              onChange={(e) => setLocationCity(e.target.value)}
              maxLength={100}
              placeholder="Dhaka"
              className={inputClass}
            />
          </label>
        </div>
        <label className="mt-2 block space-y-1">
          <span className="block text-xs font-medium">Note to requester (optional)</span>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            className={inputClass}
          />
        </label>
        {error ? (
          <div className="mt-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}
        <div className="mt-3 flex items-center justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setMode('idle')}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={() => submit('approve')} disabled={busy}>
            {busy ? '…' : 'Approve + create'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
      <h4 className="mb-2 text-sm font-semibold">Reject request</h4>
      <label className="block space-y-1">
        <span className="block text-xs font-medium">
          Note (optional — surfaces to the requester)
        </span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="e.g. duplicate of BUET, misspelled, not a university, etc."
          className={inputClass}
        />
      </label>
      {error ? (
        <div className="mt-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}
      <div className="mt-3 flex items-center justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setMode('idle')}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={() => submit('reject')}
          disabled={busy}
        >
          {busy ? '…' : 'Reject'}
        </Button>
      </div>
    </div>
  )
}

const inputClass =
  'w-full rounded-md border border-border bg-card px-2.5 py-1.5 text-sm shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'
