import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EditUniversityForm } from './EditUniversityForm'
import { DepartmentList } from './DepartmentList'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function AdminUniversityDetailPage({ params }: PageProps) {
  const { id: idRaw } = await params
  const id = Number(idRaw)
  if (!Number.isInteger(id) || id <= 0) notFound()

  const university = await db.university.findUnique({
    where: { id },
    include: {
      departments: {
        orderBy: { shortName: 'asc' },
        include: { _count: { select: { professors: true } } },
      },
      _count: { select: { professors: true } },
    },
  })
  if (!university) notFound()

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <div className="mb-2 text-sm">
        <Link href="/admin/universities" className="text-muted-foreground hover:text-foreground">
          ← All universities
        </Link>
      </div>

      <header>
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-3xl font-bold tracking-tight">{university.shortName}</h1>
          <Badge variant="secondary">{university.type}</Badge>
          {university.locationCity ? (
            <Badge variant="outline">{university.locationCity}</Badge>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{university.nameEn}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {university.departments.length} departments · {university._count.professors} professors
        </p>
      </header>

      {/* Edit university */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Edit university
        </h2>
        <Card>
          <CardContent className="py-5">
            <EditUniversityForm
              id={university.id}
              initial={{
                nameEn: university.nameEn,
                nameBn: university.nameBn ?? '',
                shortName: university.shortName,
                slug: university.slug,
                locationCity: university.locationCity ?? '',
                type: university.type,
                websiteUrl: university.websiteUrl ?? '',
              }}
            />
          </CardContent>
        </Card>
      </section>

      {/* Departments */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Departments
        </h2>
        <DepartmentList
          universityId={university.id}
          departments={university.departments.map((d) => ({
            id: d.id,
            nameEn: d.nameEn,
            nameBn: d.nameBn,
            shortName: d.shortName,
            slug: d.slug,
            status: d.status,
            professorCount: d._count.professors,
          }))}
        />
      </section>
    </main>
  )
}
