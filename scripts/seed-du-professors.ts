// ─────────────────────────────────────────────────────────────────────────────
// Seed DU departments + professors from data/du-directory.json.
//
// Idempotent. Reads the scraped file, resolves each department (find-or-create
// under the "du" university), then for each professor:
//   - looks up by (universityId, departmentId, nameEn) case-insensitive
//   - if present → skip
//   - if absent → insert with parsed designation + status + a collision-safe slug
//
// Run with:
//   env $(grep -v '^#' .env.local | xargs) pnpm tsx scripts/seed-du-professors.ts
//
// The script prints a per-department summary (created / skipped) so the run
// can be diffed against expectations. Safe to re-run — extra invocations do
// nothing to already-present rows.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PrismaClient, type Designation, type ProfessorStatus } from '@prisma/client'
import { slugify } from '../lib/slug'

const db = new PrismaClient()

interface DirectoryProfessor {
  nameEn: string
  nameBn?: string | null
  designation?: string | null
  sourceUrl?: string | null
}

interface DirectoryDepartment {
  nameEn: string
  shortName?: string | null
  sourceUrl?: string | null
  professors: DirectoryProfessor[]
  notes?: string
}

interface DirectoryFaculty {
  nameEn: string
  departments: DirectoryDepartment[]
}

interface DirectoryFile {
  university: { slug: string; shortName: string; nameEn: string; nameBn?: string | null }
  faculties: DirectoryFaculty[]
}

// ── Parsers ──────────────────────────────────────────────────────────────────

/** Map a raw DU designation string to the Designation enum. Preserves any
 *  status hint (LPR / on leave) into the returned `status` slot. */
function parseDesignation(raw: string | null | undefined): {
  designation: Designation
  status: ProfessorStatus
} {
  if (!raw) return { designation: 'other', status: 'active' }
  const s = raw.toLowerCase()

  // Retirement / Leave Preparatory to Retirement is effectively retired.
  const status: ProfessorStatus = /\blpr\b|retire/.test(s) ? 'retired' : 'active'

  if (/associate\s+professor/.test(s)) return { designation: 'associate_professor', status }
  if (/assistant\s+professor/.test(s)) return { designation: 'assistant_professor', status }
  if (/\bprofessor\b/.test(s)) return { designation: 'professor', status }
  if (/lecturer/.test(s)) return { designation: 'lecturer', status }
  // Chairs / heads without an underlying academic rank listed — treat as professor.
  if (/chair|head\s+of\s+dept/.test(s)) return { designation: 'professor', status }
  if (/adjunct/.test(s)) return { designation: 'adjunct', status }
  return { designation: 'other', status }
}

// ── Slug resolution ──────────────────────────────────────────────────────────

/** Give the row a slug that survives collisions. Legacy `slug` column is
 *  unique globally; append the uni short name and then a numeric tail if
 *  needed. This keeps the field human-readable while guaranteeing insert. */
async function uniqueProfessorSlug(nameEn: string, uniShortName: string): Promise<string> {
  const base = slugify(nameEn)
  const withUni = `${base}-${slugify(uniShortName)}`
  for (const candidate of [
    base,
    withUni,
    ...Array.from({ length: 30 }, (_, i) => `${withUni}-${i + 2}`),
  ]) {
    if (!candidate) continue
    const clash = await db.professor.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
    if (!clash) return candidate
  }
  throw new Error(`Could not find a unique slug for "${nameEn}" — too many collisions`)
}

// ── Department resolution ────────────────────────────────────────────────────

async function findOrCreateDept(
  universityId: number,
  dir: DirectoryDepartment,
): Promise<{ id: number; created: boolean }> {
  const existing = await db.department.findFirst({
    where: {
      universityId,
      OR: [
        { nameEn: { equals: dir.nameEn, mode: 'insensitive' } },
        ...(dir.shortName
          ? [{ shortName: { equals: dir.shortName, mode: 'insensitive' as const } }]
          : []),
      ],
    },
    select: { id: true },
  })
  if (existing) return { id: existing.id, created: false }

  // Match the ReviewForm's slug format so future user-added rows collide
  // properly. Global unique on slug so append numeric tail on collision.
  const baseSlug = slugify(dir.nameEn)
  let candidateSlug = baseSlug
  for (let i = 2; i < 30; i++) {
    const clash = await db.department.findFirst({
      where: { slug: candidateSlug },
      select: { id: true },
    })
    if (!clash) break
    candidateSlug = `${baseSlug}-${i}`
  }

  const created = await db.department.create({
    data: {
      universityId,
      nameEn: dir.nameEn.slice(0, 200),
      shortName: dir.shortName?.slice(0, 20) ?? null,
      slug: candidateSlug.slice(0, 50),
      status: 'verified', // seeded from official source
    },
    select: { id: true },
  })
  return { id: created.id, created: true }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const filePath = resolve(process.cwd(), 'data/du-directory.json')
  const doc = JSON.parse(readFileSync(filePath, 'utf8')) as DirectoryFile

  const uni = await db.university.findUnique({
    where: { slug: doc.university.slug },
    select: { id: true, shortName: true },
  })
  if (!uni) {
    throw new Error(
      `University with slug "${doc.university.slug}" not found — seed universities first`,
    )
  }

  let totalDeptsCreated = 0
  let totalProfsCreated = 0
  let totalProfsSkipped = 0

  for (const fac of doc.faculties) {
    for (const dir of fac.departments) {
      const dept = await findOrCreateDept(uni.id, dir)
      if (dept.created) totalDeptsCreated += 1

      let deptCreated = 0
      let deptSkipped = 0
      for (const prof of dir.professors) {
        const name = prof.nameEn.trim()
        if (!name) continue

        const existing = await db.professor.findFirst({
          where: {
            universityId: uni.id,
            departmentId: dept.id,
            nameEn: { equals: name, mode: 'insensitive' },
          },
          select: { id: true },
        })
        if (existing) {
          deptSkipped += 1
          continue
        }

        const { designation, status } = parseDesignation(prof.designation)
        const slug = await uniqueProfessorSlug(name, uni.shortName)

        await db.professor.create({
          data: {
            universityId: uni.id,
            departmentId: dept.id,
            nameEn: name.slice(0, 200),
            nameBn: prof.nameBn?.slice(0, 200) ?? null,
            designation,
            status,
            slug,
          },
        })
        deptCreated += 1
      }

      totalProfsCreated += deptCreated
      totalProfsSkipped += deptSkipped
      console.log(
        `  ${dir.shortName ?? '?'.padEnd(6)} ${dir.nameEn.padEnd(50)}  +${deptCreated} new / ~${deptSkipped} skipped${dept.created ? ' (dept created)' : ''}`,
      )
    }
  }

  console.log('')
  console.log(`Done. Departments created: ${totalDeptsCreated}`)
  console.log(`      Professors created:   ${totalProfsCreated}`)
  console.log(`      Professors skipped:   ${totalProfsSkipped}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
