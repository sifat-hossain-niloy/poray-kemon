import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getAdminSession } from '@/lib/admin-auth'
import { PasswordChangeForm } from './PasswordChangeForm'

export const dynamic = 'force-dynamic'

// /admin/settings — self-service account page.
//
// Every authenticated staff row lands here to change their own password.
// The page also surfaces basic account context (username, email, role, last
// login) so it's obvious which account the change will apply to. If you're
// signed in as two different admins in two browsers, the display disambiguates.

export default async function AdminSettingsPage() {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')

  const me = await db.adminUser.findUnique({
    where: { id: session.adminId },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
      lastLogin: true,
    },
  })
  if (!me) redirect('/admin/login')

  return (
    <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Account settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Change your password. Other account fields (username, email, role) can only be edited by a
          super-admin via <code className="text-xs">/admin/users</code>.
        </p>
      </header>

      <Card>
        <CardContent className="py-4 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold">{me.username}</span>
                <Badge
                  variant={
                    me.role === 'super_admin'
                      ? 'default'
                      : me.role === 'admin'
                        ? 'secondary'
                        : 'outline'
                  }
                  className="text-[10px] uppercase tracking-wide"
                >
                  {me.role.replace('_', ' ')}
                </Badge>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {me.email ? me.email + ' · ' : ''}created {formatDate(me.createdAt)}
                {me.lastLogin ? ' · last login ' + formatDate(me.lastLogin) : ''}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Change password
        </h2>
        <Card>
          <CardContent className="py-5">
            <PasswordChangeForm />
          </CardContent>
        </Card>
      </section>
    </main>
  )
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
