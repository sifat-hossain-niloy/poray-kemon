'use client'

import Link from 'next/link'
import { useSession, signIn, signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SearchBox } from '@/components/search/SearchBox'
import { LanguageToggle } from '@/components/i18n/LanguageToggle'
import { useStrings } from '@/lib/i18n/client'

type StaffRole = 'super_admin' | 'admin' | 'moderator'

export function Navbar({ staffRole }: { staffRole: StaffRole | null }) {
  const { data: session, status } = useSession()
  const strings = useStrings()

  // Staff sessions (admin/moderator) are mutually exclusive with user
  // sessions — the login endpoints clear each other's cookies. But the
  // NextAuth session cookie may briefly appear alongside if a Google
  // sign-in raced with our clear; treat staff as authoritative on that
  // page load and hide user-facing CTAs entirely.
  const isStaff = staffRole !== null

  async function handleStaffSignOut() {
    await fetch('/api/admin/logout', { method: 'POST' })
    window.location.href = '/'
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg shrink-0">
          <span className="inline-block h-7 w-7 rounded-lg bg-primary text-primary-foreground text-center leading-7 font-bold">
            প
          </span>
          <span className="hidden sm:inline">{strings.site.name}</span>
        </Link>

        {/* Live debounced search */}
        <div className="flex-1 max-w-md">
          <SearchBox variant="compact" />
        </div>

        {/* Language toggle */}
        <LanguageToggle />

        {isStaff ? (
          // Staff view: no user-facing CTAs. Just a link back to the
          // dashboard and a sign-out control so the browser can drop the
          // staff cookie without visiting /admin/login → sign-out.
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="secondary" render={<Link href="/admin" />}>
              {staffRole === 'moderator' ? 'Moderator' : 'Admin'}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleStaffSignOut}>
              {strings.auth.signOut}
            </Button>
          </div>
        ) : (
          <>
            {/* Write-a-review CTA — always visible for the public. Signed-in
                users go straight to /review/new; signed-out users bounce
                through Google and land on /review/new after auth. */}
            {session?.user ? (
              <Button size="sm" className="shrink-0" render={<Link href="/review/new" />}>
                {strings.nav.writeReview}
              </Button>
            ) : (
              <Button
                size="sm"
                className="shrink-0"
                disabled={status === 'loading'}
                onClick={() => signIn('google', { callbackUrl: '/review/new' })}
              >
                {strings.nav.writeReview}
              </Button>
            )}

            {/* Auth control */}
            <div className="flex items-center gap-2 shrink-0">
              {status === 'loading' ? (
                <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
              ) : session?.user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" className="h-9 gap-2 px-2">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-xs font-semibold">
                            {session.user.name?.[0]?.toUpperCase() ?? '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="hidden sm:inline text-sm">{session.user.name}</span>
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>
                        {strings.auth.signedInAs(session.user.name ?? '')}
                      </DropdownMenuLabel>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => signOut()}>
                      {strings.auth.signOut}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="outline" onClick={() => signIn('google')} size="sm">
                  {strings.auth.signInWithGoogle}
                </Button>
              )}
            </div>
          </>
        )}
      </nav>
    </header>
  )
}
