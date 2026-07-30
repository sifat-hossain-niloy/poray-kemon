'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  departmentId: number
}

export function VerifyDepartmentButton({ departmentId }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  async function onClick() {
    setError(null)
    const res = await fetch(`/api/admin/departments/${departmentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'verified' }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}) as { error?: string })
      setError(body.error ?? 'Failed to verify')
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? 'Verifying…' : 'Verify'}
      </button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  )
}
