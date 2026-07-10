import Link from 'next/link'
import { db } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AdminUniversityRequestActions } from './AdminUniversityRequestActions'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

const STATUSES = ['pending', 'approved', 'rejected'] as const
type Status = (typeof STATUSES)[number]

function isStatus(x: string | undefined): x is Status {
  return x === 'pending' || x === 'approved' || x === 'rejected'
}

export default async function AdminUniversityRequestsPage({ searchParams }: PageProps) {
  const { status: raw } = await searchParams
  const status: Status = isStatus(raw) ? raw : 'pending'

  const [requests, counts] = await Promise.all([
    db.universityRequest.findMany({
      where: { status },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { displayName: true } },
      },
      take: 100,
    }),
    Promise.all(
      STATUSES.map((s) =>
        db.universityRequest.count({ where: { status: s } }).then((n) => [s, n] as const),
      ),
    ),
  ])

  const countByStatus = Object.fromEntries(counts) as Record<Status, number>

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">University requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reviewer-submitted requests to add a university that isn&apos;t in the catalog. Approve to
          publish the row; reject to close the ticket with a note.
        </p>
      </header>

      {/* Status tabs */}
      <nav className="flex flex-wrap gap-2 text-sm">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/university-requests?status=${s}`}
            className={
              'rounded-md border px-3 py-1.5 transition-colors ' +
              (status === s
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card hover:bg-muted')
            }
          >
            {s} <span className="ml-1 text-xs opacity-75">({countByStatus[s]})</span>
          </Link>
        ))}
      </nav>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No {status} requests.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => (
            <li key={r.id}>
              <Card>
                <CardContent className="space-y-3 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-base font-semibold">{r.nameEn}</span>
                        <Badge variant="secondary">{r.type}</Badge>
                        {r.status === 'pending' ? (
                          <Badge variant="outline" className="border-amber-300 text-amber-700">
                            Pending
                          </Badge>
                        ) : r.status === 'approved' ? (
                          <Badge variant="default">Approved</Badge>
                        ) : (
                          <Badge variant="destructive">Rejected</Badge>
                        )}
                      </div>
                      {r.nameBn ? (
                        <div className="mt-0.5 text-xs text-muted-foreground">{r.nameBn}</div>
                      ) : null}
                      <div className="mt-1 text-xs text-muted-foreground">
                        Requested by {r.user?.displayName ?? '(unknown)'} ·{' '}
                        {formatDate(r.createdAt)}
                      </div>
                      {r.adminNote ? (
                        <div className="mt-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
                          <span className="font-medium">Admin note:</span> {r.adminNote}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {r.status === 'pending' ? (
                    <AdminUniversityRequestActions
                      requestId={r.id}
                      initialShortName={suggestShortName(r.nameEn)}
                      initialSlug={suggestSlug(r.nameEn)}
                    />
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

// Same rule the resolver uses when the admin doesn't override.
function suggestShortName(name: string): string {
  const stopwords = new Set(['of', 'and', 'the', 'for'])
  return (
    name
      .split(/\s+/)
      .filter((w) => w.length > 0 && !stopwords.has(w.toLowerCase()))
      .map((w) => w[0]!.toUpperCase())
      .join('')
      .slice(0, 20) || 'UNI'
  )
}

function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
