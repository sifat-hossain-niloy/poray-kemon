'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

const UNI_TYPES = ['public', 'private', 'international'] as const
type UniType = (typeof UNI_TYPES)[number]

export function CreateUniversityForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [nameEn, setNameEn] = useState('')
  const [nameBn, setNameBn] = useState('')
  const [shortName, setShortName] = useState('')
  const [slug, setSlug] = useState('')
  const [locationCity, setLocationCity] = useState('')
  const [type, setType] = useState<UniType>('public')
  const [websiteUrl, setWebsiteUrl] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)

    try {
      const res = await fetch('/api/admin/universities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameEn: nameEn.trim(),
          nameBn: nameBn.trim() || undefined,
          shortName: shortName.trim(),
          slug: slug.trim(),
          locationCity: locationCity.trim() || undefined,
          type,
          websiteUrl: websiteUrl.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setError(body.error ?? `Failed (${res.status})`)
        return
      }
      // Reset + refresh the listing
      setNameEn('')
      setNameBn('')
      setShortName('')
      setSlug('')
      setLocationCity('')
      setType('public')
      setWebsiteUrl('')
      startTransition(() => router.refresh())
    } catch (err) {
      console.error(err)
      setError('Server error — check the console')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label="Name (EN) *">
        <input
          type="text"
          value={nameEn}
          onChange={(e) => setNameEn(e.target.value)}
          required
          minLength={2}
          maxLength={200}
          className={inputClass}
        />
      </Field>
      <Field label="Name (BN)">
        <input
          type="text"
          value={nameBn}
          onChange={(e) => setNameBn(e.target.value)}
          maxLength={200}
          className={inputClass}
        />
      </Field>

      <Field label="Short name *">
        <input
          type="text"
          value={shortName}
          onChange={(e) => setShortName(e.target.value)}
          required
          maxLength={20}
          placeholder="BUET"
          className={inputClass}
        />
      </Field>
      <Field label="Slug *">
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase())}
          required
          maxLength={50}
          pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
          placeholder="buet"
          className={inputClass}
        />
      </Field>

      <Field label="City">
        <input
          type="text"
          value={locationCity}
          onChange={(e) => setLocationCity(e.target.value)}
          maxLength={100}
          className={inputClass}
        />
      </Field>
      <Field label="Type *">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as UniType)}
          className={inputClass + ' cursor-pointer'}
          required
        >
          {UNI_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Website URL" className="sm:col-span-2">
        <input
          type="url"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          maxLength={255}
          placeholder="https://..."
          className={inputClass}
        />
      </Field>

      {error ? (
        <div className="sm:col-span-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <div className="sm:col-span-2 flex justify-end">
        <Button type="submit" disabled={busy || pending} size="sm">
          {busy || pending ? '...' : 'Create'}
        </Button>
      </div>
    </form>
  )
}

const inputClass =
  'w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

function Field({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={'block space-y-1.5 ' + (className ?? '')}>
      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}
