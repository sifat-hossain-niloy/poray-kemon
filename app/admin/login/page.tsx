import { redirect } from 'next/navigation'
import { getAdminSession } from '@/lib/admin-auth'
import { StaffLoginForm } from '@/components/admin/StaffLoginForm'

interface PageProps {
  searchParams: Promise<{ from?: string; error?: string }>
}

export default async function AdminLoginPage({ searchParams }: PageProps) {
  // Already authenticated? Bounce.
  if (await getAdminSession()) redirect('/admin')
  const { from, error } = await searchParams
  return <StaffLoginForm variant="admin" from={from} hasError={Boolean(error)} />
}
