// ─────────────────────────────────────────────────────────────────────────────
// Server component — the shared login form rendered by /admin/login and
// /moderator/login. Both pages POST to the same /api/admin/login endpoint;
// this component just tailors the copy and the ?from= redirect target.
//
// Login accepts either the username OR the email of an admin_users row.
// The identifier field is named `login` on the wire — the server sniffs
// whether it looks like an email and picks the right column.
// ─────────────────────────────────────────────────────────────────────────────

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Props {
  variant: 'admin' | 'moderator'
  from?: string
  hasError: boolean
}

export function StaffLoginForm({ variant, from, hasError }: Props) {
  const copy =
    variant === 'admin'
      ? {
          title: 'Admin sign-in',
          subtitle: 'Full access — user management, catalog editing, moderation.',
          errorMsg: 'Invalid credentials. Check your username / email and password.',
          submit: 'Sign in',
          switchPrompt: 'Are you a moderator?',
          switchLink: '/moderator/login',
          switchLabel: 'Use the moderator sign-in →',
        }
      : {
          title: 'Moderator sign-in',
          subtitle: 'Moderation queues, university requests, review actions.',
          errorMsg: 'Invalid credentials. Check your username / email and password.',
          submit: 'Sign in',
          switchPrompt: 'Are you an admin?',
          switchLink: '/admin/login',
          switchLabel: 'Use the admin sign-in →',
        }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{copy.subtitle}</p>
        </CardHeader>
        <CardContent>
          <form action="/api/admin/login" method="POST" className="space-y-3">
            {from ? <input type="hidden" name="from" value={from} /> : null}
            <label className="block space-y-1.5">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Username or email
              </span>
              <input
                type="text"
                name="login"
                autoComplete="username"
                required
                className={inputClass}
                placeholder="e.g. admin or you@example.com"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Password
              </span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
                className={inputClass}
              />
            </label>

            {hasError ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {copy.errorMsg}
              </div>
            ) : null}

            <Button type="submit" className="w-full">
              {copy.submit}
            </Button>
          </form>

          <p className="mt-4 text-xs text-muted-foreground">
            {copy.switchPrompt}{' '}
            <a href={copy.switchLink} className="text-primary underline underline-offset-2">
              {copy.switchLabel}
            </a>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}

const inputClass =
  'w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20'
