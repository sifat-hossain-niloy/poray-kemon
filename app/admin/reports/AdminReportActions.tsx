'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { STRINGS } from '@/lib/strings'

type ResolveAction = 'keep' | 'remove'

export function AdminReportActions({ reportId }: { reportId: number }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<ResolveAction | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function resolve(action: ResolveAction) {
    if (action === 'remove' && !window.confirm(STRINGS.admin.confirmDelete)) return
    setError(null)
    setBusy(action)
    try {
      const res = await fetch(`/api/admin/reports/${reportId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? `Action failed (${res.status})`)
        return
      }
      startTransition(() => router.refresh())
    } catch (err) {
      console.error(err)
      setError(STRINGS.errors.serverError)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending || busy !== null}
          onClick={() => resolve('keep')}
        >
          {busy === 'keep' ? '…' : STRINGS.admin.actionResolveKeep}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={pending || busy !== null}
          onClick={() => resolve('remove')}
        >
          {busy === 'remove' ? '…' : STRINGS.admin.actionResolveRemove}
        </Button>
      </div>
      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          {error}
        </div>
      ) : null}
    </div>
  )
}
