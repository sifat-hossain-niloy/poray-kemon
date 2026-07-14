import { NextResponse, type NextRequest } from 'next/server'
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from '@/lib/admin-auth'

// Routes that must be staff-authenticated (admin OR moderator — role checks
// happen inside the individual handlers via require* helpers in
// lib/admin-auth.ts). The two login pages and the login endpoint are
// explicitly allowed through unauthenticated.
function isProtectedAdminPath(pathname: string): boolean {
  if (pathname === '/admin/login') return false
  if (pathname === '/moderator/login') return false
  if (pathname === '/api/admin/login') return false
  return pathname.startsWith('/admin') || pathname.startsWith('/api/admin')
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (!isProtectedAdminPath(pathname)) return NextResponse.next()

  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value
  const session = await verifyAdminSessionToken(token)

  if (session) return NextResponse.next()

  // API routes: respond JSON 401 instead of redirecting (browsers + fetch)
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 })
  }

  // UI routes: bounce to login, preserving where the user was headed
  const loginUrl = new URL('/admin/login', req.url)
  if (pathname !== '/admin') loginUrl.searchParams.set('from', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/admin/:path*', '/moderator/:path*', '/api/admin/:path*'],
}
