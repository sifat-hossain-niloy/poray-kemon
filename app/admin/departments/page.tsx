import Link from 'next/link'
import { db } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { VerifyDepartmentButton } from './VerifyDepartmentButton'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ status?: string }>
}

const STATUSES = ['unverified', 'verified'] as const
type Status = (typeof STATUSES)[number]

function isStatus(x: string | undefined): x is Status {
  return x === 'unverified' || x === 'verified'
}

// Departments the app auto-creates when a reviewer types a name that isn't
// in the catalog. They land here as `unverified` and stay usable — this
// queue is purely for the admin badge/cleanup pass, not a gate on data
// entry (that's by design; see docs/architecture/system-architecture.md).
export default async function AdminDepartmentsPage({ searchParams }: PageProps) {
  const { status: raw } = await searchParams
  const status: Status = isStatus(raw) ? raw : 'unverified'

  const [departments, counts] = await Promise.all([
    db.department.findMany({
      where: { status },
      orderBy: [{ createdAt: 'desc' }],
      include: {
        university: { select: { shortName: true, slug: true } },
        _count: { select: { professors: true } },
      },
      take: 100,
    }),
    Promise.all(
      STATUSES.map((s) =>
        db.department.count({ where: { status: s } }).then((n) => [s, n] as const),
      ),
    ),
  ])

  const countByStatus = Object.fromEntries(counts) as Record<Status, number>

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reviewer-typed departments start as <em>unverified</em>. They are visible on the site from
          day one, this queue only flips the badge once you have confirmed the name.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2 text-sm">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/departments?status=${s}`}
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

      {departments.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No {status} departments.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {departments.map((d) => (
            <li key={d.id}>
              <Card>
                <CardContent className="space-y-3 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="text-base font-semibold">{d.shortName ?? d.nameEn}</span>
                        <Badge variant="secondary">{d.university.shortName}</Badge>
                        {d.status === 'unverified' ? (
                          <Badge variant="outline" className="border-amber-300 text-amber-700">
                            Unverified
                          </Badge>
                        ) : (
                          <Badge variant="default">Verified</Badge>
                        )}
                      </div>
                      <div className="mt-0.5 text-sm text-muted-foreground">{d.nameEn}</div>
                      {d.nameBn ? (
                        <div className="mt-0.5 text-xs text-muted-foreground">{d.nameBn}</div>
                      ) : null}
                      <div className="mt-1 text-xs text-muted-foreground">
                        {d._count.professors} professor{d._count.professors === 1 ? '' : 's'} ·
                        added {formatDate(d.createdAt)}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/universities/${d.universityId}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Open in university →
                      </Link>
                      {d.status === 'unverified' ? (
                        <VerifyDepartmentButton departmentId={d.id} />
                      ) : null}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
