import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { canAdmin, getAdminSession } from '@/lib/admin-auth'
import { CreateStaffForm } from './CreateStaffForm'
import { DeleteStaffButton } from './DeleteStaffButton'

export const dynamic = 'force-dynamic'

// /admin/users
// Super-admin and admin land here. Admins can create/delete moderators only;
// super-admin can also create/delete admins. The super-admin row itself is
// listed but pinned — no delete affordance, no edit.

export default async function AdminUsersPage() {
  const session = await getAdminSession()
  if (!session || !canAdmin(session.role)) redirect('/admin')

  const users = await db.adminUser.findMany({
    orderBy: [{ role: 'asc' }, { username: 'asc' }],
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      createdAt: true,
      lastLogin: true,
    },
  })

  const isSuper = session.role === 'super_admin'

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Staff users</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isSuper
            ? 'Create and remove admins and moderators. The super-admin row (yours) is pinned and cannot be removed.'
            : 'Create and remove moderators. Only the super-admin can add or remove other admins.'}
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Add a user
        </h2>
        <Card>
          <CardContent className="py-5">
            <CreateStaffForm currentRole={session.role} />
          </CardContent>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Existing users
        </h2>
        <ul className="space-y-2">
          {users.map((u) => {
            const isMe = u.id === session.adminId
            const canDelete =
              !isMe &&
              u.role !== 'super_admin' &&
              (session.role === 'super_admin' || u.role === 'moderator')

            return (
              <li key={u.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-semibold">{u.username}</span>
                        <Badge
                          variant={
                            u.role === 'super_admin'
                              ? 'default'
                              : u.role === 'admin'
                                ? 'secondary'
                                : 'outline'
                          }
                          className="text-[10px] uppercase tracking-wide"
                        >
                          {u.role.replace('_', ' ')}
                        </Badge>
                        {isMe ? (
                          <Badge variant="outline" className="text-[10px]">
                            you
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {u.email ? `${u.email} · ` : ''}created {formatDate(u.createdAt)}
                        {u.lastLogin ? ` · last login ${formatDate(u.lastLogin)}` : ''}
                      </div>
                    </div>
                    {canDelete ? <DeleteStaffButton userId={u.id} username={u.username} /> : null}
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      </section>
    </main>
  )
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
