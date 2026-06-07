import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { STRINGS } from '@/lib/strings'
import { getAdminSession } from '@/lib/admin-auth'

interface PageProps {
  searchParams: Promise<{ from?: string; error?: string }>
}

export default async function AdminLoginPage({ searchParams }: PageProps) {
  // Already authenticated? Bounce.
  if (await getAdminSession()) redirect('/admin')

  const { from, error } = await searchParams

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{STRINGS.admin.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action="/api/admin/login" method="POST" className="space-y-3">
            {from ? <input type="hidden" name="from" value={from} /> : null}
            <Field label={STRINGS.admin.usernameLabel}>
              <input
                type="text"
                name="username"
                autoComplete="username"
                required
                className={inputClass}
              />
            </Field>
            <Field label={STRINGS.admin.passwordLabel}>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                className={inputClass}
              />
            </Field>

            {error ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {STRINGS.admin.invalidCredentials}
              </div>
            ) : null}

            <Button type="submit" className="w-full">
              {STRINGS.admin.login}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}

const inputClass =
  'w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}
