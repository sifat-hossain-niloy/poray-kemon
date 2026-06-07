'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { STRINGS } from '@/lib/strings'

type ModerationStatus = 'live' | 'soft_flagged' | 'flagged_hidden' | 'deleted'
type Action = 'approve' | 'hide' | 'delete'

export function AdminReviewActions({
  reviewId,
  moderationStatus,
}: {
  reviewId: number
  moderationStatus: ModerationStatus
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<Action | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(action: Action) {
    if (action === 'delete' && !window.confirm(STRINGS.admin.confirmDelete)) return
    if (action === 'hide' && !window.confirm(STRINGS.admin.confirmHide)) return

    setError(null)
    setBusy(action)
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}/moderation`, {
        method: 'PATCH',
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

  // Already-live reviews don't need an "Approve" button
  const showApprove = moderationStatus !== 'live'

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {showApprove ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || busy !== null}
            onClick={() => run('approve')}
          >
            {busy === 'approve' ? '…' : `✅ ${STRINGS.admin.actionApprove}`}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending || busy !== null || moderationStatus === 'flagged_hidden'}
          onClick={() => run('hide')}
        >
          {busy === 'hide' ? '…' : `🚫 ${STRINGS.admin.actionHide}`}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={pending || busy !== null}
          onClick={() => run('delete')}
        >
          {busy === 'delete' ? '…' : `❌ ${STRINGS.admin.actionDelete}`}
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
