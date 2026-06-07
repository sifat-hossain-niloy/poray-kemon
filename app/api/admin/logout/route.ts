import { NextResponse } from 'next/server'
import { clearAdminSessionCookie } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  await clearAdminSessionCookie()
  return NextResponse.redirect(new URL('/admin/login', req.url), { status: 303 })
}
