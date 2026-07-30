import Link from 'next/link'
import type { Metadata } from 'next'
import { STRINGS } from '@/lib/strings'
import { getAdminSession, canAdmin, canSuperAdmin } from '@/lib/admin-auth'
import { Badge } from '@/components/ui/badge'

// Admin is internal tooling — keep it out of search engines entirely.
export const metadata: Metadata = {
  title: { default: STRINGS.admin.title, template: `%s · ${STRINGS.admin.title}` },
  robots: { index: false, follow: false },
}

// Dynamic — admin views must reflect the current DB state, never cache.
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The middleware already gates /admin/* — but reading the session here lets
  // us hide the chrome on /admin/login itself by returning early.
  const session = await getAdminSession()

  return (
    <div className="flex min-h-screen flex-col">
      {session ? (
        <header className="border-b border-border bg-card">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
            <Link href="/admin" className="font-semibold">
              {STRINGS.admin.title}
            </Link>
            <nav className="flex flex-1 items-center gap-4 text-sm">
              <Link
                href="/admin"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {STRINGS.admin.dashboard}
              </Link>
              <Link
                href="/admin/queue"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {STRINGS.admin.queue}
              </Link>
              <Link
                href="/admin/reports"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {STRINGS.admin.reports}
              </Link>
              <Link
                href="/admin/university-requests"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Uni requests
              </Link>
              <Link
                href="/admin/departments"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Departments
              </Link>
              {canAdmin(session.role) ? (
                <Link
                  href="/admin/universities"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Universities
                </Link>
              ) : null}
              {canSuperAdmin(session.role) ? (
                <Link
                  href="/admin/users"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Users
                </Link>
              ) : null}
              <Link
                href="/admin/settings"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Account
              </Link>
            </nav>
            <Badge
              variant={
                session.role === 'super_admin'
                  ? 'default'
                  : session.role === 'admin'
                    ? 'secondary'
                    : 'outline'
              }
              className="text-[10px] uppercase tracking-wide"
            >
              {session.role.replace('_', ' ')}
            </Badge>
            <form action="/api/admin/logout" method="POST">
              <button
                type="submit"
                className="rounded-md border border-border bg-card px-3 py-1 text-xs font-medium transition-colors hover:bg-muted"
              >
                {STRINGS.admin.logout}
              </button>
            </form>
          </div>
        </header>
      ) : null}

      <div className="flex-1">{children}</div>
    </div>
  )
}
