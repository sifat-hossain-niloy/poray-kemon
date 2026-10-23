import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { canAdmin, getAdminSession } from '@/lib/admin-auth'
import { AUDIT_ACTIONS, auditCategory } from '@/lib/audit'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

// /admin/audit — append-only trail of staff actions. Admin+ only: moderators
// are the people most of these entries are about.

const PAGE_SIZE = 50
const CATEGORIES = [...new Set(AUDIT_ACTIONS.map(auditCategory))]

interface PageProps {
  searchParams: Promise<{ category?: string; page?: string }>
}

const TARGET_HREF: Partial<Record<string, (id: string) => string>> = {
  university: (id) => `/admin/universities/${id}`,
}

export default async function AdminAuditPage({ searchParams }: PageProps) {
  const session = await getAdminSession()
  if (!session || !canAdmin(session.role)) redirect('/admin')

  const { category: rawCategory, page: rawPage } = await searchParams
  const category = CATEGORIES.includes(rawCategory ?? '') ? rawCategory : undefined
  const page = Math.min(Math.max(1, Math.floor(Number(rawPage) || 1)), 1000)

  const where: Prisma.AdminAuditLogWhereInput = category
    ? { action: { startsWith: `${category}.` } }
    : {}
  const [entries, total] = await Promise.all([
    db.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.adminAuditLog.count({ where }),
  ])
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const href = (patch: { category?: string; page?: number }) => {
    const qs = new URLSearchParams()
    const c = 'category' in patch ? patch.category : category
    if (c) qs.set('category', c)
    const p = patch.page ?? 1
    if (p > 1) qs.set('page', String(p))
    const s = qs.toString()
    return `/admin/audit${s ? `?${s}` : ''}`
  }
  const fmt = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Dhaka',
  })

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every staff action, newest first. Entries are append-only. Times are Asia/Dhaka.
        </p>
      </header>

      <nav className="flex flex-wrap gap-1.5" aria-label="Filter by category">
        {[undefined, ...CATEGORIES].map((c) => (
          <Link
            key={c ?? 'all'}
            href={href({ category: c })}
            aria-current={c === category ? 'true' : undefined}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              c === category
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {c ?? 'All'}
          </Link>
        ))}
      </nav>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No entries yet.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">When</th>
                <th className="p-3 font-medium">Who</th>
                <th className="p-3 font-medium">Action</th>
                <th className="p-3 font-medium">Target</th>
                <th className="p-3 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const targetHref = TARGET_HREF[e.targetType]?.(e.targetId)
                return (
                  <tr key={e.id} className="border-t border-border align-top">
                    <td className="whitespace-nowrap p-3 tabular-nums text-muted-foreground">
                      {fmt.format(e.createdAt)}
                    </td>
                    <td className="p-3">
                      {e.adminUsername}
                      {e.adminId === null ? (
                        <span className="ml-1 text-xs text-muted-foreground">(removed)</span>
                      ) : null}
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="font-mono text-[11px]">
                        {e.action}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap p-3 font-mono text-xs">
                      {targetHref ? (
                        <Link href={targetHref} className="text-primary hover:underline">
                          {e.targetType}#{e.targetId}
                        </Link>
                      ) : (
                        `${e.targetType}#${e.targetId}`
                      )}
                    </td>
                    <td className="max-w-xs p-3">
                      {e.details ? (
                        <code className="block whitespace-pre-wrap break-all text-[11px] text-muted-foreground">
                          {JSON.stringify(e.details)}
                        </code>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          {page > 1 ? <Link href={href({ page: page - 1 })}>← Newer</Link> : <span />}
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          {page < pages ? <Link href={href({ page: page + 1 })}>Older →</Link> : <span />}
        </div>
      ) : null}
    </main>
  )
}
