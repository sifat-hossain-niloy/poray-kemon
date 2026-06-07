import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { STRINGS } from '@/lib/strings'
import Link from 'next/link'

export const revalidate = 60

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const prof = await db.professor.findUnique({
    where: { slug },
    select: { nameEn: true, nameBn: true },
  })
  if (!prof) return { title: 'Not found' }
  return {
    title: prof.nameBn ?? prof.nameEn,
    description: `${prof.nameEn} এর শিক্ষাগত রিভিউ ও রেটিং`,
  }
}

export default async function ProfessorPage({ params }: PageProps) {
  const { slug } = await params

  const professor = await db.professor.findUnique({
    where: { slug },
    include: {
      university: true,
      department: true,
      professorCourses: {
        orderBy: { reviewCount: 'desc' },
        include: { course: true },
      },
    },
  })

  if (!professor) notFound()

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <Link href="/universities" className="text-muted-foreground hover:text-foreground">
            বিশ্ববিদ্যালয়
          </Link>
          <span className="text-muted-foreground">›</span>
          <Link
            href={`/universities/${professor.university.slug}`}
            className="text-muted-foreground hover:text-foreground"
          >
            {professor.university.shortName}
          </Link>
        </div>

        <h1 className="text-3xl font-bold tracking-tight">
          {professor.nameBn ?? professor.nameEn}
        </h1>
        {professor.nameBn ? (
          <p className="mt-1 text-sm text-muted-foreground">{professor.nameEn}</p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="secondary">{professor.university.shortName}</Badge>
          <Badge variant="outline">
            {professor.department.shortName ?? professor.department.nameEn}
          </Badge>
          {professor.designation ? (
            <Badge variant="outline">{STRINGS.professor.designation[professor.designation]}</Badge>
          ) : null}
          <Badge variant="outline">{STRINGS.professor.status[professor.status]}</Badge>
        </div>

        <div className="mt-6">
          <Button render={<Link href={`/review/new?professor=${professor.slug}`} />}>
            {STRINGS.professor.writeReview}
          </Button>
        </div>
      </div>

      {/* Courses */}
      <section>
        <h2 className="mb-4 text-xl font-semibold">কোর্সসমূহ</h2>

        {professor.professorCourses.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {STRINGS.professor.noCoursesYet}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {professor.professorCourses.map((pc) => (
              <Card key={pc.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    {pc.course.courseCode ? `${pc.course.courseCode} — ` : ''}
                    {pc.course.courseName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <Stat label={STRINGS.ratings.teachingQuality} value={pc.avgTeachingQuality} />
                  <Stat label={STRINGS.ratings.gradingFairness} value={pc.avgGradingFairness} />
                  <Stat label={STRINGS.ratings.courseDifficulty} value={pc.avgCourseDifficulty} />
                  <Stat label={STRINGS.ratings.attendance} value={pc.avgAttendance} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: { toString: () => string } | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">
        {value ? Number(value.toString()).toFixed(1) : '—'}
      </div>
    </div>
  )
}
