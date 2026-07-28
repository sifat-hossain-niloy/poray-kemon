import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-auth'
import { StaffLoginForm } from '@/components/admin/StaffLoginForm'

// The moderator login page is a UI-only twin of /admin/login — same
// credentials table, same POST endpoint. Both admins and moderators can
// authenticate here; role in the session cookie decides what they can do
// once inside /admin.

interface PageProps {
  searchParams: Promise<{ from?: string; error?: string }>
}

export default async function ModeratorLoginPage({ searchParams }: PageProps) {
  if (await getAdminSession()) redirect('/admin')
  const { from, error } = await searchParams
  return <StaffLoginForm variant="moderator" from={from} hasError={Boolean(error)} />
}
