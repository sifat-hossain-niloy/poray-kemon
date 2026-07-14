'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface Props {
  userId: number
  username: string
}

export function DeleteStaffButton({ userId, username }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function del() {
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? `Failed (${res.status})`)
        return
      }
      setConfirming(false)
      startTransition(() => router.refresh())
    } catch (err) {
      console.error(err)
      setError('Server error')
    } finally {
      setBusy(false)
    }
  }

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setConfirming(true)}
        disabled={pending}
      >
        Remove
      </Button>
    )
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Delete “{username}”?</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(false)}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={del} disabled={busy}>
          {busy ? '…' : 'Confirm'}
        </Button>
      </div>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  )
}
