import Link from 'next/link'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { canAdmin, getAdminSession } from '@/lib/admin-auth'
import { CreateUniversityForm } from './CreateUniversityForm'

export default async function AdminUniversitiesPage() {
  // Middleware guaranteed a session; here we narrow to admin+super_admin.
  // Moderators land on the dashboard instead — the nav already hides this
  // link for them, but direct-URL visits need a server-side gate too.
  const session = await getAdminSession()
  if (!session || !canAdmin(session.role)) redirect('/admin')
  const universities = await db.university.findMany({
    orderBy: [{ type: 'asc' }, { shortName: 'asc' }],
    include: {
      _count: { select: { departments: true, professors: true } },
    },
  })

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Universities</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {universities.length} universities · seeded + admin-managed
          </p>
        </div>
      </header>

      {/* Create form */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Add a university
        </h2>
        <Card>
          <CardContent className="py-5">
            <CreateUniversityForm />
          </CardContent>
        </Card>
      </section>

      {/* List */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          All universities
        </h2>
        <ul className="space-y-2">
          {universities.map((u) => (
            <li key={u.id}>
              <Link href={`/admin/universities/${u.id}`} className="block">
                <Card className="transition-shadow hover:shadow-md">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-semibold">
                        <span>{u.shortName}</span>
                        <Badge variant={typeBadge(u.type)}>{u.type}</Badge>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{u.nameEn}</div>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{u._count.departments} depts</span>
                      <span>{u._count.professors} profs</span>
                      <Button variant="outline" size="sm" tabIndex={-1}>
                        Edit →
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}

function typeBadge(type: 'public' | 'private' | 'international') {
  if (type === 'public') return 'default' as const
  if (type === 'private') return 'secondary' as const
  return 'outline' as const
}
