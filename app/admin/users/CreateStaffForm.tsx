'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { AdminRoleLiteral } from '@/lib/admin-auth'

interface Props {
  currentRole: AdminRoleLiteral
}

export function CreateStaffForm({ currentRole }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'moderator'>('moderator')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const canCreateAdmins = currentRole === 'super_admin'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(null)
    setBusy(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          email: email.trim() || undefined,
          password,
          role,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        user?: { username: string; role: string }
      }
      if (!res.ok) {
        setError(body.error ?? `Failed (${res.status})`)
        return
      }
      setOk(`Created ${body.user?.role ?? role} "${body.user?.username ?? username}".`)
      setUsername('')
      setEmail('')
      setPassword('')
      setRole('moderator')
      startTransition(() => router.refresh())
    } catch (err) {
      console.error(err)
      setError('Server error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="block text-xs font-medium">Username *</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            pattern="^[A-Za-z0-9_.-]+$"
            minLength={3}
            maxLength={100}
            required
            autoComplete="off"
            className={inputClass}
          />
        </label>
        <label className="block space-y-1">
          <span className="block text-xs font-medium">Email (optional)</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={255}
            autoComplete="off"
            className={inputClass}
          />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="block text-xs font-medium">Password *</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          maxLength={72}
          required
          autoComplete="new-password"
          className={inputClass}
        />
        <span className="block text-[11px] text-muted-foreground">
          Minimum 8 characters. Share it with the user privately — the app never emails it.
        </span>
      </label>
      <fieldset className="space-y-1">
        <legend className="block text-xs font-medium">Role *</legend>
        <div className="flex flex-wrap gap-2 pt-1">
          <RoleRadio value="moderator" current={role} onChange={setRole} label="Moderator" />
          <RoleRadio
            value="admin"
            current={role}
            onChange={setRole}
            label="Admin"
            disabled={!canCreateAdmins}
            title={canCreateAdmins ? undefined : 'Only the super-admin can create admins'}
          />
        </div>
      </fieldset>

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}
      {ok ? (
        <div className="rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs text-primary">
          {ok}
        </div>
      ) : null}

      <div className="flex items-center justify-end">
        <Button type="submit" disabled={busy || pending}>
          {busy ? '…' : 'Create user'}
        </Button>
      </div>
    </form>
  )
}

function RoleRadio({
  value,
  current,
  onChange,
  label,
  disabled,
  title,
}: {
  value: 'admin' | 'moderator'
  current: 'admin' | 'moderator'
  onChange: (v: 'admin' | 'moderator') => void
  label: string
  disabled?: boolean
  title?: string
}) {
  return (
    <label
      title={title}
      className={
        'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-colors ' +
        (current === value
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card hover:bg-muted') +
        (disabled ? ' cursor-not-allowed opacity-50' : '')
      }
    >
      <input
        type="radio"
        name="role"
        value={value}
        checked={current === value}
        onChange={() => onChange(value)}
        disabled={disabled}
        className="hidden"
      />
      {label}
    </label>
  )
}

const inputClass =
  'w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
