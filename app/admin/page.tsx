import Link from 'next/link'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { STRINGS } from '@/lib/strings'

export default async function AdminDashboardPage() {
  // All counts in one round-trip so the dashboard stays snappy
  const [
    pendingReports,
    softFlagged,
    flaggedHidden,
    totalReviews,
    totalProfessors,
    totalUniversities,
  ] = await Promise.all([
    db.report.count({ where: { status: 'pending' } }),
    db.review.count({ where: { moderationStatus: 'soft_flagged' } }),
    db.review.count({ where: { moderationStatus: 'flagged_hidden' } }),
    db.review.count(),
    db.professor.count(),
    db.university.count(),
  ])

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{STRINGS.admin.dashboard}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Operational view — counts are live, never cached.
        </p>
      </header>

      {/* Action queues */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <QueueCard
          href="/admin/reports"
          title={STRINGS.admin.pendingReports}
          count={pendingReports}
          tone={pendingReports > 0 ? 'attention' : 'idle'}
        />
        <QueueCard
          href="/admin/queue?filter=soft_flagged"
          title={STRINGS.admin.softFlagged}
          count={softFlagged}
          tone={softFlagged > 0 ? 'attention' : 'idle'}
        />
        <QueueCard
          href="/admin/queue?filter=flagged_hidden"
          title={STRINGS.admin.flaggedHidden}
          count={flaggedHidden}
          tone={flaggedHidden > 0 ? 'warn' : 'idle'}
        />
      </section>

      {/* Site stats */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title={STRINGS.admin.totalReviews} count={totalReviews} />
        <StatCard title={STRINGS.admin.totalProfessors} count={totalProfessors} />
        <StatCard title={STRINGS.admin.totalUniversities} count={totalUniversities} />
      </section>
    </main>
  )
}

function QueueCard({
  href,
  title,
  count,
  tone,
}: {
  href: string
  title: string
  count: number
  tone: 'idle' | 'attention' | 'warn'
}) {
  return (
    <Link href={href} className="block">
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-baseline justify-between gap-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Badge
              variant={tone === 'idle' ? 'outline' : tone === 'warn' ? 'destructive' : 'default'}
            >
              {count > 0 ? 'open' : 'clear'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <span className="text-3xl font-bold tabular-nums">{count.toLocaleString('en-US')}</span>
        </CardContent>
      </Card>
    </Link>
  )
}

function StatCard({ title, count }: { title: string; count: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <span className="text-3xl font-bold tabular-nums">{count.toLocaleString('en-US')}</span>
      </CardContent>
    </Card>
  )
}
