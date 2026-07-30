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

export function Navbar() {
  const { data: session, status } = useSession()
  const strings = useStrings()

  const writeReviewLabel = (
    <>
      <span className="hidden sm:inline">{strings.nav.writeReview}</span>
      <span className="sm:hidden">{strings.nav.writeReviewShort}</span>
    </>
  )

  // On phones the row of actions could not fit the search box AND a sign-in
  // button in the same line, so sign-in got hidden and users struggled to
  // find it. Two-row layout on mobile: actions on top, full-width search
  // below. From sm up, everything sits back on a single row.
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background sm:bg-background/80 sm:backdrop-blur sm:supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto w-full max-w-6xl px-3 sm:px-6">
        <nav className="flex h-14 items-center justify-between gap-2 sm:h-16 sm:gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-lg shrink-0"
            aria-label={strings.site.name}
          >
            <span className="inline-block h-7 w-7 rounded-lg bg-primary text-primary-foreground text-center leading-7 font-bold">
              প
            </span>
            <span className="hidden sm:inline">{strings.site.name}</span>
          </Link>

          {/* Search sits inline from sm up; on mobile it drops to a second row below. */}
          <div className="hidden sm:block min-w-0 flex-1 max-w-md">
            <SearchBox variant="compact" />
          </div>

          <LanguageToggle />

          {session?.user ? (
            <Button size="sm" className="shrink-0" render={<Link href="/review/new" />}>
              {writeReviewLabel}
            </Button>
          ) : (
            <Button
              size="sm"
              className="shrink-0"
              disabled={status === 'loading'}
              onClick={() => signIn('google', { callbackUrl: '/review/new' })}
            >
              {writeReviewLabel}
            </Button>
          )}

          <div className="flex items-center gap-2 shrink-0">
            {status === 'loading' ? (
              <div className="h-9 w-9 animate-pulse rounded-md bg-muted sm:w-20" />
            ) : session?.user ? (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" className="h-9 gap-2 px-1 sm:px-2">
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
              // Icon-only on phones so the sign-in affordance stays visible
              // without stretching the row past the viewport width.
              <Button
                variant="outline"
                onClick={() => signIn('google')}
                size="sm"
                className="shrink-0"
                aria-label={strings.auth.signInWithGoogle}
              >
                <span className="hidden sm:inline">{strings.auth.signInWithGoogle}</span>
                <span className="sm:hidden text-sm font-semibold">Sign in</span>
              </Button>
            )}
          </div>
        </nav>

        {/* Second row on mobile only — full-width search. */}
        <div className="pb-2 sm:hidden">
          <SearchBox variant="compact" />
        </div>
      </div>
    </header>
  )
}
