import Link from 'next/link'
import { db } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { STRINGS } from '@/lib/strings'
import { AdminReportActions } from './AdminReportActions'

const REASON_LABEL: Record<string, string> = {
  personal: 'Personal',
  fake: 'Fake / spam',
  offensive: 'Offensive',
  wrong_professor: 'Wrong professor',
  other: 'Other',
}

export default async function AdminReportsPage() {
  const reports = await db.report.findMany({
    where: { status: 'pending' },
    orderBy: { submittedAt: 'asc' }, // oldest first — clear them in order
    take: 100,
    include: {
      review: {
        include: {
          professorCourse: {
            include: {
              professor: { select: { nameEn: true, publicId: true } },
              course: { select: { courseCode: true, courseName: true } },
            },
          },
        },
      },
    },
  })

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{STRINGS.admin.reports}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {reports.length} pending. Oldest first.
        </p>
      </header>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No pending reports.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {reports.map((rep) => {
            const r = rep.review
            const professorName = r.professorCourse.professor.nameEn
            const courseLabel = r.professorCourse.course.courseCode
              ? `${r.professorCourse.course.courseCode} — ${r.professorCourse.course.courseName}`
              : r.professorCourse.course.courseName
            return (
              <li key={rep.id}>
                <Card>
                  <CardContent className="space-y-3 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="destructive">
                          {REASON_LABEL[rep.reason] ?? rep.reason}
                        </Badge>
                        <Link
                          href={`/professors/${r.professorCourse.professor.publicId}`}
                          target="_blank"
                          className="font-semibold hover:underline"
                        >
                          {professorName}
                        </Link>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{courseLabel}</span>
                      </div>
                      <time
                        dateTime={rep.submittedAt.toISOString()}
                        className="text-muted-foreground"
                      >
                        {rep.submittedAt.toISOString().slice(0, 10)}
                      </time>
                    </div>

                    {rep.details ? (
                      <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
                        <div className="mb-1 text-xs font-medium text-muted-foreground">
                          Reporter note
                        </div>
                        <p className="whitespace-pre-wrap">{rep.details}</p>
                      </div>
                    ) : null}

                    <div>
                      <div className="mb-1 text-xs font-medium text-muted-foreground">
                        Review content
                      </div>
                      {r.reviewText ? (
                        <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">
                          {r.reviewText}
                        </p>
                      ) : (
                        <p className="rounded-md bg-muted/40 p-3 text-sm italic text-muted-foreground">
                          (no text)
                        </p>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      Current status: <span className="font-mono">{r.moderationStatus}</span>
                    </div>

                    <AdminReportActions reportId={rep.id} />
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
