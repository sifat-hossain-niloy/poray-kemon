import { Prisma, PrismaClient, UniversityType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Bangladeshi-university catalog.
//
// Most rows here come from a flat list of names — no departments, no city,
// no Bangla name. They give the platform a complete public catalog so any
// student can find their institution from day one. Admins can fill in the
// missing fields (city, type adjustments, departments) via /admin/universities.
//
// We dedupe against the detailed seed above by NORMALIZED name (case-fold,
// "&" → "and", strip hyphens/commas, collapse whitespace). The detailed
// seed wins — it carries departments. The bulk seed only creates rows that
// the detailed seed doesn't already cover.
// ─────────────────────────────────────────────────────────────────────────────

const ALL_BD_UNIVERSITIES: readonly string[] = [
  'Ahsanullah University of Science and Technology',
  'American International University-Bangladesh',
  'Anwer Khan Modern University',
  'ASA University Bangladesh',
  'Asian University for Women',
  'Asian University of Bangladesh',
  'Atish Dipankar University of Science and Technology',
  'Bandarban University',
  'Bangabandhu Sheikh Mujib Medical University',
  'Bangabandhu Sheikh Mujibur Rahman Agricultural University',
  'Bangabandhu Sheikh Mujibur Rahman Maritime University',
  'Bangabandhu Sheikh Mujibur Rahman Science and Technology University',
  'Bangamata Sheikh Fojilatunnesa Mujib Science and Technology University',
  'Bangladesh Agricultural University',
  'Bangladesh Islami University',
  'Bangladesh University',
  'Bangladesh University of Business and Technology',
  'Bangladesh University of Engineering and Technology',
  'Bangladesh University of Health Sciences',
  'Bangladesh University of Professionals',
  'Bangladesh University of Textiles',
  'Begum Gulchemonara Trust University',
  'Begum Rokeya University',
  'BGMEA University of Fashion and Technology',
  'BRAC University',
  'Britannia University',
  'Canadian University of Bangladesh',
  'CCN University of Science and Technology',
  'Central University of Science and Technology',
  "Central Women's University",
  'Chittagong Independent University',
  'Chittagong Medical University',
  'Chittagong University of Engineering and Technology',
  'Chittagong Veterinary and Animal Sciences University',
  'City University',
  'Comilla University',
  "Cox's Bazar International University",
  'Daffodil International University',
  'Dhaka International University',
  'Dhaka University of Engineering and Technology',
  'East Delta University',
  'East West University',
  'Eastern University',
  'European University of Bangladesh',
  'Exim Bank Agricultural University of Bangladesh',
  'Fareast International University',
  'Feni University',
  'First Capital University of Bangladesh',
  'German University Bangladesh',
  'Global University Bangladesh',
  'Gono Bishwabidyalay',
  'Green University of Bangladesh',
  'Hajee Mohammad Danesh Science and Technology University',
  'Hamdard University of Bangladesh',
  'IBAIS University',
  'Independent University',
  'International Islamic University',
  'International Standard University',
  'International University of Business Agriculture and Technology',
  'Ishakha International University',
  'Islamic Arabic University',
  'Islamic University',
  'Islamic University of Technology',
  'Jagannath University',
  'Jahangirnagar University',
  'Jatiya Kabi Kazi Nazrul Islam University',
  'Jessore University of Science and Technology',
  'Khulna Agricultural University',
  'Khulna University',
  'Khulna University of Engineering and Technology',
  'Khwaja Yunus Ali University',
  'Leading University',
  'Manarat International University',
  'Mawlana Bhashani Science and Technology University',
  'Metropolitan University',
  'N.P.I. University of Bangladesh',
  'National University',
  'Noakhali Science and Technology University',
  'North Bengal International University',
  'North East University Bangladesh',
  'North South University',
  'North Western University',
  'Northern University of Bangladesh',
  'Northern University of Business and Technology',
  'Notre Dame University Bangladesh',
  'Pabna Science and Technology University',
  'Patuakhali Science and Technology University',
  'Port City International University',
  'Premier University',
  'Presidency University',
  'Prime University',
  'Primeasia University',
  'Pundra University of Science and Technology',
  'Queens University',
  'Rabindra Maitree University',
  'Rabindra University',
  'Rajshahi Medical University',
  'Rajshahi Science and Technology University',
  'Rajshahi University',
  'Rajshahi University of Engineering and Technology',
  'Ranada Prasad Shaha University',
  'Rangamati Science and Technology University',
  'Royal University of Dhaka',
  'Shahjalal University of Science and Technology',
  'Shanto Mariam University of Creative Technology',
  'Sheikh Fazilatunnesa Mujib University',
  'Sheikh Hasina University',
  'Sher-e-Bangla Agricultural University',
  'Sonargaon University',
  'Southeast University',
  'Southern University Bangladesh',
  'Stamford University Bangladesh',
  'State University of Bangladesh',
  'Sylhet Agricultural University',
  'Sylhet International University',
  'Sylhet Medical University',
  'The International University of Scholars',
  'The Millenium University',
  "The People's University of Bangladesh",
  'Times University of Bangladesh',
  'United International University',
  'University of Asia Pacific',
  'University of Barisal',
  'University of Chittagong',
  'University of Creative Technology',
  'University of Development Alternative',
  'University of Dhaka',
  'University of Global Village',
  'University of Information Technology and Sciences',
  'University of Liberal Arts Bangladesh',
  'University of Science and Technology Chittagong',
  'University of South Asia',
  'Uttara University',
  'Varendra University',
  'Victoria University of Bangladesh',
  'World University of Bangladesh',
  'Z.H. Sikder University of Science and Technology',
  'ZNRF University of Management Sciences',
]

// ── Helpers for the bulk seed ───────────────────────────────────────────────

const STOP_WORDS = new Set(['of', 'and', 'the', 'for', 'in', 'at', 'to', 'a', 'an'])

/** Lowercase, "&"→"and", strip hyphens/commas/periods, collapse whitespace. */
function normalizeName(s: string): string {
  return s.toLowerCase().replace(/&/g, 'and').replace(/[-,.]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** ASCII slug helper (mirrors lib/slug.slugify — duplicated to keep seed standalone). */
function slugifyAscii(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Pick first letters of significant words, uppercased, capped at 8 chars. */
function makeShortName(name: string): string {
  const words = name
    .replace(/[.,'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w.toLowerCase()))
  let initials = words
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8)
  if (!initials) initials = slugifyAscii(name).toUpperCase().slice(0, 8)
  return initials || 'UNI'
}

/** Heuristic: public if the name looks like a government/public institution. */
function inferType(name: string): UniversityType {
  const lower = name.toLowerCase()
  const publicSignals = [
    /university of engineering/,
    /agricultural university/,
    /medical university/,
    /maritime university/,
    /science and technology university/,
    /university of science and technology/,
    /\bnational university\b/,
    /\bbangabandhu\b/,
    /\bsheikh mujib/,
    /jagannath university/,
    /jahangirnagar university/,
    /\buniversity of (dhaka|chittagong|rajshahi|barisal)\b/,
    /\bislamic arabic university\b/,
    /^islamic university$/,
    /comilla university/,
    /khulna university$/,
    /begum rokeya/,
    /bangladesh university of professionals/,
    /military institute/,
  ]
  if (publicSignals.some((re) => re.test(lower))) return 'public'
  return 'private'
}

// ── University seed data (from SRS Appendix A + FR-DIR-01) ──────────────────

const universities = [
  {
    nameEn: 'Bangladesh University of Engineering and Technology',
    nameBn: 'বাংলাদেশ প্রকৌশল বিশ্ববিদ্যালয়',
    shortName: 'BUET',
    slug: 'buet',
    locationCity: 'Dhaka',
    type: 'public' as const,
    departments: [
      {
        nameEn: 'Computer Science & Engineering',
        nameBn: 'কম্পিউটার বিজ্ঞান ও প্রকৌশল',
        shortName: 'CSE',
        slug: 'cse',
      },
      {
        nameEn: 'Electrical & Electronic Engineering',
        nameBn: 'তড়িৎ ও ইলেকট্রনিক প্রকৌশল',
        shortName: 'EEE',
        slug: 'eee',
      },
      { nameEn: 'Mechanical Engineering', nameBn: 'যন্ত্র প্রকৌশল', shortName: 'ME', slug: 'me' },
      { nameEn: 'Civil Engineering', nameBn: 'পুরকৌশল', shortName: 'CE', slug: 'ce' },
      {
        nameEn: 'Chemical Engineering',
        nameBn: 'রাসায়নিক প্রকৌশল',
        shortName: 'ChE',
        slug: 'che',
      },
      { nameEn: 'Urban & Regional Planning', shortName: 'URP', slug: 'urp' },
      { nameEn: 'Architecture', nameBn: 'স্থাপত্য', shortName: 'Arch', slug: 'arch' },
    ],
  },
  {
    nameEn: 'University of Dhaka',
    nameBn: 'ঢাকা বিশ্ববিদ্যালয়',
    shortName: 'DU',
    slug: 'du',
    locationCity: 'Dhaka',
    type: 'public' as const,
    departments: [
      { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
      { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
      {
        nameEn: 'Business Administration',
        nameBn: 'ব্যবসায় প্রশাসন',
        shortName: 'BBA',
        slug: 'bba',
      },
      { nameEn: 'Economics', nameBn: 'অর্থনীতি', shortName: 'ECO', slug: 'eco' },
      { nameEn: 'English', nameBn: 'ইংরেজি', shortName: 'ENG', slug: 'eng' },
      { nameEn: 'Law', nameBn: 'আইন', shortName: 'LAW', slug: 'law' },
      { nameEn: 'Physics', nameBn: 'পদার্থ বিজ্ঞান', shortName: 'PHY', slug: 'phy' },
    ],
  },
  {
    nameEn: 'North South University',
    nameBn: 'নর্থ সাউথ ইউনিভার্সিটি',
    shortName: 'NSU',
    slug: 'nsu',
    locationCity: 'Dhaka',
    type: 'private' as const,
    departments: [
      { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
      { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
      { nameEn: 'Business Administration', shortName: 'BBA', slug: 'bba' },
      { nameEn: 'Economics', shortName: 'ECO', slug: 'eco' },
      { nameEn: 'English', shortName: 'ENG', slug: 'eng' },
      { nameEn: 'Environmental Science', shortName: 'ENV', slug: 'env' },
      { nameEn: 'Law', shortName: 'LAW', slug: 'law' },
    ],
  },
  {
    nameEn: 'BRAC University',
    nameBn: 'ব্র্যাক ইউনিভার্সিটি',
    shortName: 'BRACU',
    slug: 'bracu',
    locationCity: 'Dhaka',
    type: 'private' as const,
    departments: [
      { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
      { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
      { nameEn: 'Business Administration', shortName: 'BBA', slug: 'bba' },
      { nameEn: 'English & Humanities', shortName: 'ENH', slug: 'enh' },
      { nameEn: 'Economics & Social Science', shortName: 'ECO', slug: 'eco' },
      { nameEn: 'Law', shortName: 'LAW', slug: 'law' },
      { nameEn: 'Architecture', shortName: 'ARCH', slug: 'arch' },
    ],
  },
  {
    nameEn: 'Independent University, Bangladesh',
    nameBn: 'ইনডিপেন্ডেন্ট ইউনিভার্সিটি',
    shortName: 'IUB',
    slug: 'iub',
    locationCity: 'Dhaka',
    type: 'private' as const,
    departments: [
      { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
      { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
      { nameEn: 'Business Administration', shortName: 'BBA', slug: 'bba' },
    ],
  },
  {
    nameEn: 'American International University Bangladesh',
    nameBn: 'আমেরিকান ইন্টারন্যাশনাল ইউনিভার্সিটি বাংলাদেশ',
    shortName: 'AIUB',
    slug: 'aiub',
    locationCity: 'Dhaka',
    type: 'private' as const,
    departments: [
      { nameEn: 'Computer Science', shortName: 'CS', slug: 'cs' },
      { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
      { nameEn: 'Business Administration', shortName: 'BBA', slug: 'bba' },
    ],
  },
  {
    nameEn: 'Rajshahi University of Engineering & Technology',
    nameBn: 'রাজশাহী প্রকৌশল ও প্রযুক্তি বিশ্ববিদ্যালয়',
    shortName: 'RUET',
    slug: 'ruet',
    locationCity: 'Rajshahi',
    type: 'public' as const,
    departments: [
      { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
      { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
      { nameEn: 'Mechanical Engineering', shortName: 'ME', slug: 'me' },
      { nameEn: 'Civil Engineering', shortName: 'CE', slug: 'ce' },
    ],
  },
  {
    nameEn: 'Chittagong University of Engineering & Technology',
    nameBn: 'চট্টগ্রাম প্রকৌশল ও প্রযুক্তি বিশ্ববিদ্যালয়',
    shortName: 'CUET',
    slug: 'cuet',
    locationCity: 'Chittagong',
    type: 'public' as const,
    departments: [
      { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
      { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
      { nameEn: 'Civil Engineering', shortName: 'CE', slug: 'ce' },
    ],
  },
  {
    nameEn: 'Khulna University of Engineering & Technology',
    shortName: 'KUET',
    slug: 'kuet',
    locationCity: 'Khulna',
    type: 'public' as const,
    departments: [
      { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
      { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
    ],
  },
  {
    nameEn: 'Shahjalal University of Science and Technology',
    nameBn: 'শাহজালাল বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    shortName: 'SUST',
    slug: 'sust',
    locationCity: 'Sylhet',
    type: 'public' as const,
    departments: [
      { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
      { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
      { nameEn: 'Business Administration', shortName: 'BBA', slug: 'bba' },
    ],
  },
  {
    nameEn: 'Islamic University of Technology',
    shortName: 'IUT',
    slug: 'iut',
    locationCity: 'Gazipur',
    type: 'international' as const,
    departments: [
      { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
      { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
      { nameEn: 'Mechanical & Chemical Engineering', shortName: 'MCE', slug: 'mce' },
    ],
  },
  {
    nameEn: 'Daffodil International University',
    nameBn: 'ড্যাফোডিল ইন্টারন্যাশনাল ইউনিভার্সিটি',
    shortName: 'DIU',
    slug: 'diu',
    locationCity: 'Dhaka',
    type: 'private' as const,
    departments: [
      { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
      { nameEn: 'Software Engineering', shortName: 'SWE', slug: 'swe' },
      { nameEn: 'Business Administration', shortName: 'BBA', slug: 'bba' },
    ],
  },
  {
    nameEn: 'East West University',
    shortName: 'EWU',
    slug: 'ewu',
    locationCity: 'Dhaka',
    type: 'private' as const,
    departments: [
      { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
      { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
      { nameEn: 'Business Administration', shortName: 'BBA', slug: 'bba' },
    ],
  },
  {
    nameEn: 'United International University',
    shortName: 'UIU',
    slug: 'uiu',
    locationCity: 'Dhaka',
    type: 'private' as const,
    departments: [
      { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
      { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
    ],
  },
  {
    nameEn: 'Military Institute of Science and Technology',
    shortName: 'MIST',
    slug: 'mist',
    locationCity: 'Dhaka',
    type: 'public' as const,
    departments: [
      { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
      { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
      { nameEn: 'Civil Engineering', shortName: 'CE', slug: 'ce' },
    ],
  },
]

async function main() {
  console.log('🌱 Seeding database...')

  // ── Universities + Departments ───────────────────────────────────────────
  for (const uni of universities) {
    const { departments, ...uniData } = uni

    const university = await db.university.upsert({
      where: { slug: uniData.slug },
      create: uniData,
      update: {},
    })

    for (const dept of departments) {
      await db.department.upsert({
        where: {
          universityId_shortName: {
            universityId: university.id,
            shortName: dept.shortName,
          },
        },
        create: { ...dept, universityId: university.id },
        update: {},
      })
    }

    console.log(`  ✓ ${university.shortName} — ${departments.length} departments`)
  }

  // ── Bulk catalog (no departments) ────────────────────────────────────────
  // The detailed seed above wins. We dedupe by normalized nameEn AND by the
  // normalized form of names that already exist in the DB (so re-runs are
  // idempotent even after admin renames).
  const existingUniversities = await db.university.findMany({
    select: { id: true, nameEn: true, shortName: true, slug: true },
  })
  const existingNormalizedNames = new Set(existingUniversities.map((u) => normalizeName(u.nameEn)))
  const takenShortNames = new Set(existingUniversities.map((u) => u.shortName))
  const takenSlugs = new Set(existingUniversities.map((u) => u.slug))

  let added = 0
  let skippedDup = 0

  for (const name of ALL_BD_UNIVERSITIES) {
    const norm = normalizeName(name)
    if (existingNormalizedNames.has(norm)) {
      skippedDup += 1
      continue
    }

    // Pick a unique shortName (cap 20 chars) — try initials, then suffix digits
    let shortName = makeShortName(name)
    if (shortName.length > 20) shortName = shortName.slice(0, 20)
    if (takenShortNames.has(shortName)) {
      let n = 2
      while (takenShortNames.has(`${shortName}${n}`)) n += 1
      shortName = `${shortName}${n}`.slice(0, 20)
    }

    // Slug from shortName (lowercase, ≤ 50 chars, ASCII-safe, unique). Fall back
    // to a name-derived slug if the shortName collapses to nothing.
    let slug = slugifyAscii(shortName) || slugifyAscii(name).slice(0, 50)
    if (takenSlugs.has(slug)) {
      let n = 2
      while (takenSlugs.has(`${slug}-${n}`)) n += 1
      slug = `${slug}-${n}`
    }

    try {
      await db.university.create({
        data: {
          nameEn: name,
          shortName,
          slug,
          type: inferType(name),
        },
        select: { id: true },
      })
      takenShortNames.add(shortName)
      takenSlugs.add(slug)
      existingNormalizedNames.add(norm)
      added += 1
    } catch (err) {
      // Defensive — if some constraint we didn't anticipate fires, log and skip.
      // The seed must never abort mid-run for a single bad entry.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        console.warn(`  ⚠ skipped "${name}" — unique constraint on ${String(err.meta?.target)}`)
        skippedDup += 1
        continue
      }
      throw err
    }
  }

  console.log(`  ✓ Bulk catalog — ${added} added, ${skippedDup} already-present skipped`)

  // ── Admin user ───────────────────────────────────────────────────────────
  const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? 'changeme123'
  const passwordHash = await bcrypt.hash(adminPassword, 12)

  await db.adminUser.upsert({
    where: { username: 'admin' },
    create: { username: 'admin', passwordHash },
    update: {},
  })

  console.log('  ✓ Admin user created (username: admin)')

  const totalUniversities = await db.university.count()
  const totalDepartments = await db.department.count()
  console.log('')
  console.log(
    `✅ Seed complete — ${totalUniversities} universities, ${totalDepartments} departments`,
  )
  console.log('⚠️  Change the admin password before going to production!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
