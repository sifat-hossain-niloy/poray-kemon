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

  // Shortened on phones so the row cannot outgrow a 320px viewport.
  const writeReviewLabel = (
    <>
      <span className="hidden sm:inline">{strings.nav.writeReview}</span>
      <span className="sm:hidden">{strings.nav.writeReviewShort}</span>
    </>
  )

  return (
    // Opaque on phones: backdrop-blur forces a full-width recomposite of the
    // area behind a sticky header on every scroll frame, which is the main
    // source of scroll jank on mid-range mobile. The frosted look is kept
    // from sm up, where it is cheap enough.
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background sm:bg-background/80 sm:backdrop-blur sm:supports-[backdrop-filter]:bg-background/60">
      {/* justify-between with a max-w-md-capped flex-1 search: without it,
          the row's leftover slack all accumulates on the right side of the
          last child, which reads as a left-shifted navbar on wide screens. */}
      <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-3 sm:gap-3 sm:px-6">
        {/* Logo */}
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

        {/* Live debounced search — takes the remaining space and may shrink. */}
        <div className="min-w-0 flex-1 max-w-md">
          <SearchBox variant="compact" />
        </div>

        {/* Language toggle */}
        <LanguageToggle />

        {/* Write-a-review CTA. Signed-in users go straight to /review/new;
            signed-out users bounce through Google and land there after auth. */}
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

        {/* Auth */}
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
                {/* Base UI's Menu.GroupLabel (wrapped by DropdownMenuLabel)
                    reads its GroupContext, so it MUST live inside a Group. */}
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
            // Hidden on phones: for a signed-out visitor this button and the
            // CTA above start the identical OAuth flow, and rendering both is
            // what stretched the navbar to 452px inside a 375px viewport.
            // Sign-in stays reachable via the CTA and via HelpfulButton.
            <Button
              variant="outline"
              onClick={() => signIn('google')}
              size="sm"
              className="hidden sm:inline-flex"
            >
              {strings.auth.signInWithGoogle}
            </Button>
          )}
        </div>
      </nav>
    </header>
  )
}
