import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

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
      // Seed-curated departments are trusted, so flip status to verified —
      // departments created by users via the review form default to
      // unverified and surface in the admin merge tool.
      await db.department.upsert({
        where: {
          universityId_shortName: {
            universityId: university.id,
            shortName: dept.shortName,
          },
        },
        create: { ...dept, universityId: university.id, status: 'verified' },
        update: { status: 'verified' },
      })
    }

    console.log(`  ✓ ${university.shortName} — ${departments.length} departments`)
  }

  // ── Admin user ───────────────────────────────────────────────────────────
  const adminPassword = process.env.ADMIN_SEED_PASSWORD ?? 'changeme123'
  const passwordHash = await bcrypt.hash(adminPassword, 12)

  await db.adminUser.upsert({
    where: { username: 'admin' },
    create: { username: 'admin', passwordHash },
    update: {},
  })

  console.log('  ✓ Admin user created (username: admin)')
  console.log('')
  console.log(`✅ Seed complete — ${universities.length} universities seeded`)
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
