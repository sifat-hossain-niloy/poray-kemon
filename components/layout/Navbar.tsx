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

        {/* Auth */}
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
                {/* Base UI's Menu.GroupLabel (wrapped by DropdownMenuLabel)
                    reads its GroupContext, so it MUST live inside a Group. */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    {strings.auth.signedInAs(session.user.name ?? '')}
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/review/new" />}>
                  {strings.nav.writeReview}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  {strings.auth.signOut}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={() => signIn('google')} size="sm">
              {strings.auth.signInWithGoogle}
            </Button>
          )}
        </div>
      </nav>
    </header>
  )
}
