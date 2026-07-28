'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  // Client-side gate — matches the server-side Zod schema so bad inputs
  // never leave the browser. The server still validates independently.
  const clientError =
    newPassword.length > 0 && newPassword.length < 8
      ? 'Password must be at least 8 characters'
      : newPassword.length > 0 &&
          confirmNewPassword.length > 0 &&
          newPassword !== confirmNewPassword
        ? 'Confirmation does not match'
        : newPassword.length > 0 && newPassword === currentPassword
          ? 'New password must differ from the current one'
          : null

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmNewPassword &&
    newPassword !== currentPassword

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    setOk(false)
    setBusy(true)
    try {
      const res = await fetch('/api/admin/me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmNewPassword }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? `Failed (${res.status})`)
        return
      }
      setOk(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
    } catch (err) {
      console.error(err)
      setError('Server error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block space-y-1">
        <span className="block text-xs font-medium">Current password *</span>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </label>
      <label className="block space-y-1">
        <span className="block text-xs font-medium">New password *</span>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          required
          className={inputClass}
        />
        <span className="block text-[11px] text-muted-foreground">
          8–72 characters. A password manager is your friend.
        </span>
      </label>
      <label className="block space-y-1">
        <span className="block text-xs font-medium">Confirm new password *</span>
        <input
          type="password"
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
          autoComplete="new-password"
          required
          className={inputClass}
        />
      </label>

      {clientError ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {clientError}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}
      {ok ? (
        <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs text-primary">
          Password changed. Existing sessions on other devices stay valid until they expire.
        </div>
      ) : null}

      <div className="flex items-center justify-end">
        <Button type="submit" disabled={busy || !canSubmit}>
          {busy ? '…' : 'Update password'}
        </Button>
      </div>
    </form>
  )
}

const inputClass =
  'w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
