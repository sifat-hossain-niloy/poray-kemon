import Link from 'next/link'
import { db } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { STRINGS } from '@/lib/strings'
import { AdminReviewActions } from './AdminReviewActions'

type Filter = 'soft_flagged' | 'flagged_hidden' | 'live'

interface PageProps {
  searchParams: Promise<{ filter?: string }>
}

function parseFilter(raw: string | undefined): Filter {
  if (raw === 'flagged_hidden') return 'flagged_hidden'
  if (raw === 'live') return 'live'
  return 'soft_flagged'
}

const FILTER_LABEL: Record<Filter, string> = {
  soft_flagged: STRINGS.admin.softFlagged,
  flagged_hidden: STRINGS.admin.flaggedHidden,
  live: 'Live reviews',
}

export default async function AdminQueuePage({ searchParams }: PageProps) {
  const { filter: filterRaw } = await searchParams
  const filter = parseFilter(filterRaw)

  const reviews = await db.review.findMany({
    where: { moderationStatus: filter },
    orderBy: [{ submittedAt: 'desc' }],
    take: 50,
    include: {
      professorCourse: {
        include: {
          professor: { select: { nameEn: true, publicId: true } },
          course: { select: { courseCode: true, courseName: true } },
        },
      },
      _count: { select: { reports: { where: { status: 'pending' } } } },
    },
  })

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{STRINGS.admin.queue}</h1>
      </header>

      {/* Filter tabs */}
      <nav className="flex flex-wrap gap-2">
        <FilterLink filter="soft_flagged" current={filter} />
        <FilterLink filter="flagged_hidden" current={filter} />
        <FilterLink filter="live" current={filter} />
      </nav>

      {/* List */}
      {reviews.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nothing here. Take a coffee break.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => {
            const professorName = r.professorCourse.professor.nameEn
            const courseLabel = r.professorCourse.course.courseCode
              ? `${r.professorCourse.course.courseCode} — ${r.professorCourse.course.courseName}`
              : r.professorCourse.course.courseName
            return (
              <li key={r.id}>
                <Card>
                  <CardContent className="space-y-3 py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/professors/${r.professorCourse.professor.publicId}`}
                          target="_blank"
                          className="font-semibold text-foreground hover:underline"
                        >
                          {professorName}
                        </Link>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{courseLabel}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <time
                          dateTime={r.submittedAt.toISOString()}
                          className="text-muted-foreground"
                        >
                          {r.submittedAt.toISOString().slice(0, 10)}
                        </time>
                        {r._count.reports > 0 ? (
                          <Badge variant="destructive">
                            {r._count.reports} pending{' '}
                            {r._count.reports === 1 ? 'report' : 'reports'}
                          </Badge>
                        ) : null}
                        {r.moderationReason ? (
                          <Badge variant="outline" className="font-mono text-[10px]">
                            {r.moderationReason}
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    {/* Star summary */}
                    <div className="text-xs text-muted-foreground">
                      T:{r.teachingQuality} G:{r.gradingFairness} D:{r.courseDifficulty} A:
                      {r.attendanceStrictness} · {r.wouldRecommend ? '👍' : '👎'}
                    </div>

                    {r.reviewText ? (
                      <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm leading-relaxed">
                        {r.reviewText}
                      </p>
                    ) : (
                      <p className="rounded-md bg-muted/40 p-3 text-sm italic text-muted-foreground">
                        (no text)
                      </p>
                    )}

                    {r.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {r.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px]">
                            {(STRINGS.tags as Record<string, string>)[tag] ?? tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null}

                    <AdminReviewActions reviewId={r.id} moderationStatus={r.moderationStatus} />
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

function FilterLink({ filter, current }: { filter: Filter; current: Filter }) {
  const active = filter === current
  return (
    <Link
      href={filter === 'soft_flagged' ? '/admin/queue' : `/admin/queue?filter=${filter}`}
      aria-current={active ? 'page' : undefined}
      className={
        'rounded-full px-3 py-1 text-xs font-medium transition-colors ' +
        (active
          ? 'bg-primary text-primary-foreground'
          : 'border border-border bg-card text-muted-foreground hover:bg-muted')
      }
    >
      {FILTER_LABEL[filter]}
    </Link>
  )
}
