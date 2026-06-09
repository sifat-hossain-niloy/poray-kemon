'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface DepartmentRow {
  id: number
  nameEn: string
  nameBn: string | null
  shortName: string | null
  slug: string | null
  professorCount: number
}

interface Props {
  universityId: number
  departments: DepartmentRow[]
}

export function DepartmentList({ universityId, departments }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  // ── Create form state ────────────────────────────────────────────────────
  const [newNameEn, setNewNameEn] = useState('')
  const [newNameBn, setNewNameBn] = useState('')
  const [newShortName, setNewShortName] = useState('')
  const [newSlug, setNewSlug] = useState('')

  async function createDept(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setCreating(true)
    try {
      const res = await fetch(`/api/admin/universities/${universityId}/departments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameEn: newNameEn.trim(),
          nameBn: newNameBn.trim() || undefined,
          shortName: newShortName.trim() || undefined,
          slug: newSlug.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? `Failed (${res.status})`)
        return
      }
      setNewNameEn('')
      setNewNameBn('')
      setNewShortName('')
      setNewSlug('')
      startTransition(() => router.refresh())
    } catch (err) {
      console.error(err)
      setError('Server error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Add-new card */}
      <Card>
        <CardContent className="py-4">
          <form onSubmit={createDept} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <input
              type="text"
              value={newNameEn}
              onChange={(e) => setNewNameEn(e.target.value)}
              placeholder="Name (EN) *"
              required
              className={inputClass + ' sm:col-span-2'}
            />
            <input
              type="text"
              value={newShortName}
              onChange={(e) => setNewShortName(e.target.value)}
              placeholder="Short (e.g. CSE)"
              className={inputClass}
            />
            <input
              type="text"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value.toLowerCase())}
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              placeholder="slug (optional)"
              className={inputClass}
            />
            <input
              type="text"
              value={newNameBn}
              onChange={(e) => setNewNameBn(e.target.value)}
              placeholder="Name (BN)"
              className={inputClass + ' sm:col-span-3'}
            />
            <Button type="submit" disabled={creating || pending} size="sm">
              {creating ? '...' : 'Add department'}
            </Button>
            {error ? (
              <div className="sm:col-span-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {/* Existing departments */}
      {departments.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            No departments yet.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {departments.map((d) => (
            <li key={d.id}>
              {editingId === d.id ? (
                <EditDepartmentRow
                  initial={d}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => {
                    setEditingId(null)
                    startTransition(() => router.refresh())
                  }}
                />
              ) : (
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <div className="font-semibold">
                        {d.shortName ?? d.nameEn}
                        {d.shortName && d.nameEn !== d.shortName ? (
                          <span className="ml-2 text-muted-foreground font-normal">
                            — {d.nameEn}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {d.nameBn ? d.nameBn + ' · ' : ''}slug: {d.slug ?? '—'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{d.professorCount} profs</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingId(d.id)}
                      >
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Edit row ────────────────────────────────────────────────────────────────

function EditDepartmentRow({
  initial,
  onCancel,
  onSaved,
}: {
  initial: DepartmentRow
  onCancel: () => void
  onSaved: () => void
}) {
  const [nameEn, setNameEn] = useState(initial.nameEn)
  const [nameBn, setNameBn] = useState(initial.nameBn ?? '')
  const [shortName, setShortName] = useState(initial.shortName ?? '')
  const [slug, setSlug] = useState(initial.slug ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/departments/${initial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameEn: nameEn.trim(),
          nameBn: nameBn.trim() || undefined,
          shortName: shortName.trim() || undefined,
          slug: slug.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? `Failed (${res.status})`)
        return
      }
      onSaved()
    } catch (err) {
      console.error(err)
      setError('Server error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardContent className="py-4">
        <form onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <input
            type="text"
            value={nameEn}
            onChange={(e) => setNameEn(e.target.value)}
            placeholder="Name (EN) *"
            required
            className={inputClass + ' sm:col-span-2'}
          />
          <input
            type="text"
            value={shortName}
            onChange={(e) => setShortName(e.target.value)}
            placeholder="Short"
            className={inputClass}
          />
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
            placeholder="slug"
            className={inputClass}
          />
          <input
            type="text"
            value={nameBn}
            onChange={(e) => setNameBn(e.target.value)}
            placeholder="Name (BN)"
            className={inputClass + ' sm:col-span-3'}
          />
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} size="sm">
              {busy ? '...' : 'Save'}
            </Button>
          </div>
          {error ? (
            <div className="sm:col-span-4 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  )
}

const inputClass =
  'w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'
