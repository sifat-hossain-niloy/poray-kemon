import { PrismaClient, UniversityType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

// ─────────────────────────────────────────────────────────────────────────────
// Curated Bangladeshi-university catalog.
//
// Source: https://en.wikipedia.org/wiki/List_of_universities_in_Bangladesh
// Bangla names: https://bn.wikipedia.org/wiki/বাংলাদেশের_বিশ্ববিদ্যালয়ের_তালিকা
//
// Each entry is authoritative — we never auto-generate acronyms here. When
// two institutions naturally share an acronym (BU = Univ of Barisal vs
// Bangladesh University vs Britannia University vs Bandarban) we keep the
// most-recognised owner's plain acronym and disambiguate the others with
// readable suffixes (BdshU for Bangladesh University, BritU for Britannia,
// BdU for Bandarban). The Wikipedia-listed initial is preserved in the
// `nameEn` so search-by-acronym still finds them via pg_trgm.
//
// Re-running this seed UPDATES rows in place (matched by canonical nameEn);
// any pre-existing university with a stale acronym gets healed. Rows that
// aren't in this list AND have zero professors attached are pruned at the
// end — so historical bad data created during earlier bulk-seed runs is
// cleaned up automatically without taking out any real review activity.
// ─────────────────────────────────────────────────────────────────────────────

type Dept = { nameEn: string; nameBn?: string; shortName: string; slug: string }
type Uni = {
  shortName: string
  slug: string
  nameEn: string
  nameBn?: string
  locationCity?: string
  type: UniversityType
}

// ── Departments only for the 15 with curated department lists ───────────────
const DEPARTMENTS_BY_SHORT_NAME: Record<string, Dept[]> = {
  BUET: [
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
    { nameEn: 'Chemical Engineering', nameBn: 'রাসায়নিক প্রকৌশল', shortName: 'ChE', slug: 'che' },
    { nameEn: 'Urban & Regional Planning', shortName: 'URP', slug: 'urp' },
    { nameEn: 'Architecture', nameBn: 'স্থাপত্য', shortName: 'Arch', slug: 'arch' },
  ],
  DU: [
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
  NSU: [
    { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
    { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
    { nameEn: 'Business Administration', shortName: 'BBA', slug: 'bba' },
    { nameEn: 'Economics', shortName: 'ECO', slug: 'eco' },
    { nameEn: 'English', shortName: 'ENG', slug: 'eng' },
    { nameEn: 'Environmental Science', shortName: 'ENV', slug: 'env' },
    { nameEn: 'Law', shortName: 'LAW', slug: 'law' },
  ],
  BRACU: [
    { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
    { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
    { nameEn: 'Business Administration', shortName: 'BBA', slug: 'bba' },
    { nameEn: 'English & Humanities', shortName: 'ENH', slug: 'enh' },
    { nameEn: 'Economics & Social Science', shortName: 'ECO', slug: 'eco' },
    { nameEn: 'Law', shortName: 'LAW', slug: 'law' },
    { nameEn: 'Architecture', shortName: 'ARCH', slug: 'arch' },
  ],
  IUB: [
    { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
    { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
    { nameEn: 'Business Administration', shortName: 'BBA', slug: 'bba' },
  ],
  AIUB: [
    { nameEn: 'Computer Science', shortName: 'CS', slug: 'cs' },
    { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
    { nameEn: 'Business Administration', shortName: 'BBA', slug: 'bba' },
  ],
  RUET: [
    { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
    { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
    { nameEn: 'Mechanical Engineering', shortName: 'ME', slug: 'me' },
    { nameEn: 'Civil Engineering', shortName: 'CE', slug: 'ce' },
  ],
  CUET: [
    { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
    { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
    { nameEn: 'Civil Engineering', shortName: 'CE', slug: 'ce' },
  ],
  KUET: [
    { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
    { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
  ],
  SUST: [
    { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
    { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
    { nameEn: 'Business Administration', shortName: 'BBA', slug: 'bba' },
  ],
  IUT: [
    { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
    { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
    { nameEn: 'Mechanical & Chemical Engineering', shortName: 'MCE', slug: 'mce' },
  ],
  DIU: [
    { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
    { nameEn: 'Software Engineering', shortName: 'SWE', slug: 'swe' },
    { nameEn: 'Business Administration', shortName: 'BBA', slug: 'bba' },
  ],
  EWU: [
    { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
    { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
    { nameEn: 'Business Administration', shortName: 'BBA', slug: 'bba' },
  ],
  UIU: [
    { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
    { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
  ],
  MIST: [
    { nameEn: 'Computer Science & Engineering', shortName: 'CSE', slug: 'cse' },
    { nameEn: 'Electrical & Electronic Engineering', shortName: 'EEE', slug: 'eee' },
    { nameEn: 'Civil Engineering', shortName: 'CE', slug: 'ce' },
  ],
}

// ── Full curated university catalog (Wikipedia-sourced) ─────────────────────
const BD_UNIVERSITIES: Uni[] = [
  // ── Public general universities ──────────────────────────────────────────
  {
    shortName: 'DU',
    slug: 'du',
    nameEn: 'University of Dhaka',
    nameBn: 'ঢাকা বিশ্ববিদ্যালয়',
    locationCity: 'Dhaka',
    type: 'public',
  },
  {
    shortName: 'RU',
    slug: 'ru',
    nameEn: 'University of Rajshahi',
    nameBn: 'রাজশাহী বিশ্ববিদ্যালয়',
    locationCity: 'Rajshahi',
    type: 'public',
  },
  {
    shortName: 'CU',
    slug: 'cu',
    nameEn: 'University of Chittagong',
    nameBn: 'চট্টগ্রাম বিশ্ববিদ্যালয়',
    locationCity: 'Chittagong',
    type: 'public',
  },
  {
    shortName: 'JU',
    slug: 'ju',
    nameEn: 'Jahangirnagar University',
    nameBn: 'জাহাঙ্গীরনগর বিশ্ববিদ্যালয়',
    locationCity: 'Savar',
    type: 'public',
  },
  {
    shortName: 'IU',
    slug: 'iu',
    nameEn: 'Islamic University, Bangladesh',
    nameBn: 'ইসলামী বিশ্ববিদ্যালয়',
    locationCity: 'Kushtia',
    type: 'public',
  },
  {
    shortName: 'KU',
    slug: 'ku',
    nameEn: 'Khulna University',
    nameBn: 'খুলনা বিশ্ববিদ্যালয়',
    locationCity: 'Khulna',
    type: 'public',
  },
  {
    shortName: 'JnU',
    slug: 'jnu',
    nameEn: 'Jagannath University',
    nameBn: 'জগন্নাথ বিশ্ববিদ্যালয়',
    locationCity: 'Dhaka',
    type: 'public',
  },
  {
    shortName: 'CoU',
    slug: 'cou',
    nameEn: 'Comilla University',
    nameBn: 'কুমিল্লা বিশ্ববিদ্যালয়',
    locationCity: 'Comilla',
    type: 'public',
  },
  {
    shortName: 'JKKNIU',
    slug: 'jkkniu',
    nameEn: 'Jatiya Kabi Kazi Nazrul Islam University',
    nameBn: 'জাতীয় কবি কাজী নজরুল ইসলাম বিশ্ববিদ্যালয়',
    locationCity: 'Mymensingh',
    type: 'public',
  },
  {
    shortName: 'BUP',
    slug: 'bup',
    nameEn: 'Bangladesh University of Professionals',
    nameBn: 'বাংলাদেশ ইউনিভার্সিটি অব প্রফেশনালস',
    locationCity: 'Dhaka',
    type: 'public',
  },
  {
    shortName: 'BRUR',
    slug: 'brur',
    nameEn: 'Begum Rokeya University',
    nameBn: 'বেগম রোকেয়া বিশ্ববিদ্যালয়',
    locationCity: 'Rangpur',
    type: 'public',
  },
  {
    shortName: 'BU',
    slug: 'bu',
    nameEn: 'University of Barisal',
    nameBn: 'বরিশাল বিশ্ববিদ্যালয়',
    locationCity: 'Barisal',
    type: 'public',
  },
  {
    shortName: 'RUB',
    slug: 'rub',
    nameEn: 'Rabindra University, Bangladesh',
    nameBn: 'রবীন্দ্র বিশ্ববিদ্যালয়',
    locationCity: 'Sirajganj',
    type: 'public',
  },
  {
    shortName: 'NkU',
    slug: 'nku',
    nameEn: 'Netrokona University',
    nameBn: 'নেত্রকোণা বিশ্ববিদ্যালয়',
    locationCity: 'Netrokona',
    type: 'public',
  },
  {
    shortName: 'KgU',
    slug: 'kgu',
    nameEn: 'Kishoreganj University',
    nameBn: 'কিশোরগঞ্জ বিশ্ববিদ্যালয়',
    locationCity: 'Kishoreganj',
    type: 'public',
  },
  {
    shortName: 'MhU',
    slug: 'mhu',
    nameEn: 'Meherpur University',
    nameBn: 'মেহেরপুর বিশ্ববিদ্যালয়',
    locationCity: 'Meherpur',
    type: 'public',
  },
  {
    shortName: 'TU',
    slug: 'tu',
    nameEn: 'Thakurgaon University',
    nameBn: 'ঠাকুরগাঁও বিশ্ববিদ্যালয়',
    locationCity: 'Thakurgaon',
    type: 'public',
  },
  {
    shortName: 'DCU',
    slug: 'dcu',
    nameEn: 'Dhaka Central University',
    nameBn: 'ঢাকা সেন্ট্রাল ইউনিভার্সিটি',
    locationCity: 'Dhaka',
    type: 'public',
  },
  // ── Public science & technology universities ─────────────────────────────
  {
    shortName: 'SUST',
    slug: 'sust',
    nameEn: 'Shahjalal University of Science and Technology',
    nameBn: 'শাহজালাল বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Sylhet',
    type: 'public',
  },
  {
    shortName: 'HSTU',
    slug: 'hstu',
    nameEn: 'Hajee Mohammad Danesh Science and Technology University',
    nameBn: 'হাজী মোহাম্মদ দানেশ বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Dinajpur',
    type: 'public',
  },
  {
    shortName: 'MBSTU',
    slug: 'mbstu',
    nameEn: 'Mawlana Bhashani Science and Technology University',
    nameBn: 'মাওলানা ভাসানী বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Tangail',
    type: 'public',
  },
  {
    shortName: 'PSTU',
    slug: 'pstu',
    nameEn: 'Patuakhali Science and Technology University',
    nameBn: 'পটুয়াখালী বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Patuakhali',
    type: 'public',
  },
  {
    shortName: 'NSTU',
    slug: 'nstu',
    nameEn: 'Noakhali Science and Technology University',
    nameBn: 'নোয়াখালী বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Noakhali',
    type: 'public',
  },
  {
    shortName: 'JUST',
    slug: 'just',
    nameEn: 'Jashore University of Science and Technology',
    nameBn: 'যশোর বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Jashore',
    type: 'public',
  },
  {
    shortName: 'PUST',
    slug: 'pust',
    nameEn: 'Pabna University of Science and Technology',
    nameBn: 'পাবনা বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Pabna',
    type: 'public',
  },
  {
    shortName: 'GSTU',
    slug: 'gstu',
    nameEn: 'Gopalganj Science and Technology University',
    nameBn: 'গোপালগঞ্জ বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Gopalganj',
    type: 'public',
  },
  {
    shortName: 'RmSTU',
    slug: 'rmstu',
    nameEn: 'Rangamati Science and Technology University',
    nameBn: 'রাঙ্গামাটি বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Rangamati',
    type: 'public',
  },
  {
    shortName: 'JSTU',
    slug: 'jstu',
    nameEn: 'Jamalpur Science and Technology University',
    nameBn: 'জামালপুর বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Jamalpur',
    type: 'public',
  },
  {
    shortName: 'CSTU',
    slug: 'cstu',
    nameEn: 'Chandpur Science and Technology University',
    nameBn: 'চাঁদপুর বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Chandpur',
    type: 'public',
  },
  {
    shortName: 'SSTU',
    slug: 'sstu',
    nameEn: 'Sunamganj Science and Technology University',
    nameBn: 'সুনামগঞ্জ বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Sunamganj',
    type: 'public',
  },
  {
    shortName: 'BSTU',
    slug: 'bstu',
    nameEn: 'Bogura Science and Technology University',
    nameBn: 'বগুড়া বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Bogura',
    type: 'public',
  },
  {
    shortName: 'LSTU',
    slug: 'lstu',
    nameEn: 'Lakshmipur Science and Technology University',
    nameBn: 'লক্ষ্মীপুর বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Lakshmipur',
    type: 'public',
  },
  {
    shortName: 'PrSTU',
    slug: 'prstu',
    nameEn: 'Pirojpur Science and Technology University',
    nameBn: 'পিরোজপুর বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Pirojpur',
    type: 'public',
  },
  {
    shortName: 'SaUST',
    slug: 'saust',
    nameEn: 'Satkhira University of Science and Technology',
    nameBn: 'সাতক্ষীরা বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Satkhira',
    type: 'public',
  },
  {
    shortName: 'NGSTU',
    slug: 'ngstu',
    nameEn: 'Narayanganj Science and Technology University',
    nameBn: 'নারায়ণগঞ্জ বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Narayanganj',
    type: 'public',
  },
  // ── Public engineering universities ──────────────────────────────────────
  {
    shortName: 'BUET',
    slug: 'buet',
    nameEn: 'Bangladesh University of Engineering and Technology',
    nameBn: 'বাংলাদেশ প্রকৌশল বিশ্ববিদ্যালয়',
    locationCity: 'Dhaka',
    type: 'public',
  },
  {
    shortName: 'MIST',
    slug: 'mist',
    nameEn: 'Military Institute of Science and Technology',
    nameBn: 'মিলিটারি ইনস্টিটিউট অব সায়েন্স অ্যান্ড টেকনোলজি',
    locationCity: 'Dhaka',
    type: 'public',
  },
  {
    shortName: 'RUET',
    slug: 'ruet',
    nameEn: 'Rajshahi University of Engineering & Technology',
    nameBn: 'রাজশাহী প্রকৌশল ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Rajshahi',
    type: 'public',
  },
  {
    shortName: 'KUET',
    slug: 'kuet',
    nameEn: 'Khulna University of Engineering & Technology',
    nameBn: 'খুলনা প্রকৌশল ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Khulna',
    type: 'public',
  },
  {
    shortName: 'CUET',
    slug: 'cuet',
    nameEn: 'Chittagong University of Engineering & Technology',
    nameBn: 'চট্টগ্রাম প্রকৌশল ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Chittagong',
    type: 'public',
  },
  {
    shortName: 'DUET',
    slug: 'duet',
    nameEn: 'Dhaka University of Engineering & Technology',
    nameBn: 'ঢাকা প্রকৌশল ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Gazipur',
    type: 'public',
  },
  // ── Public agricultural universities ─────────────────────────────────────
  {
    shortName: 'BAU',
    slug: 'bau',
    nameEn: 'Bangladesh Agricultural University',
    nameBn: 'বাংলাদেশ কৃষি বিশ্ববিদ্যালয়',
    locationCity: 'Mymensingh',
    type: 'public',
  },
  {
    shortName: 'GAU',
    slug: 'gau',
    nameEn: 'Gazipur Agricultural University',
    nameBn: 'গাজীপুর কৃষি বিশ্ববিদ্যালয়',
    locationCity: 'Gazipur',
    type: 'public',
  },
  {
    shortName: 'SBAU',
    slug: 'sbau',
    nameEn: 'Sher-e-Bangla Agricultural University',
    nameBn: 'শেরেবাংলা কৃষি বিশ্ববিদ্যালয়',
    locationCity: 'Dhaka',
    type: 'public',
  },
  {
    shortName: 'SAU',
    slug: 'sau',
    nameEn: 'Sylhet Agricultural University',
    nameBn: 'সিলেট কৃষি বিশ্ববিদ্যালয়',
    locationCity: 'Sylhet',
    type: 'public',
  },
  {
    shortName: 'KAU',
    slug: 'kau',
    nameEn: 'Khulna Agricultural University',
    nameBn: 'খুলনা কৃষি বিশ্ববিদ্যালয়',
    locationCity: 'Khulna',
    type: 'public',
  },
  {
    shortName: 'HAU',
    slug: 'hau',
    nameEn: 'Habiganj Agricultural University',
    nameBn: 'হবিগঞ্জ কৃষি বিশ্ববিদ্যালয়',
    locationCity: 'Habiganj',
    type: 'public',
  },
  {
    shortName: 'KuriAU',
    slug: 'kuriau',
    nameEn: 'Kurigram Agricultural University',
    nameBn: 'কুড়িগ্রাম কৃষি বিশ্ববিদ্যালয়',
    locationCity: 'Kurigram',
    type: 'public',
  },
  {
    shortName: 'ShAU',
    slug: 'shau',
    nameEn: 'Shariatpur Agriculture University',
    nameBn: 'শরীয়তপুর কৃষি বিশ্ববিদ্যালয়',
    locationCity: 'Shariatpur',
    type: 'public',
  },
  // ── Public medical & specialised universities ────────────────────────────
  {
    shortName: 'BMU',
    slug: 'bmu',
    nameEn: 'Bangladesh Medical University',
    nameBn: 'বাংলাদেশ মেডিক্যাল বিশ্ববিদ্যালয়',
    locationCity: 'Dhaka',
    type: 'public',
  },
  {
    shortName: 'CMU',
    slug: 'cmu',
    nameEn: 'Chittagong Medical University',
    nameBn: 'চট্টগ্রাম মেডিকেল বিশ্ববিদ্যালয়',
    locationCity: 'Chittagong',
    type: 'public',
  },
  {
    shortName: 'RMU',
    slug: 'rmu',
    nameEn: 'Rajshahi Medical University',
    nameBn: 'রাজশাহী মেডিকেল বিশ্ববিদ্যালয়',
    locationCity: 'Rajshahi',
    type: 'public',
  },
  {
    shortName: 'SMU',
    slug: 'smu',
    nameEn: 'Sylhet Medical University',
    nameBn: 'সিলেট মেডিকেল বিশ্ববিদ্যালয়',
    locationCity: 'Sylhet',
    type: 'public',
  },
  {
    shortName: 'KhMU',
    slug: 'khmu',
    nameEn: 'Khulna Medical University',
    nameBn: 'খুলনা মেডিক্যাল বিশ্ববিদ্যালয়',
    locationCity: 'Khulna',
    type: 'public',
  },
  {
    shortName: 'CVASU',
    slug: 'cvasu',
    nameEn: 'Chittagong Veterinary and Animal Sciences University',
    nameBn: 'চট্টগ্রাম ভেটেরিনারি ও এনিম্যাল সাইন্সেস বিশ্ববিদ্যালয়',
    locationCity: 'Chittagong',
    type: 'public',
  },
  {
    shortName: 'BUTEX',
    slug: 'butex',
    nameEn: 'Bangladesh University of Textiles',
    nameBn: 'বাংলাদেশ টেক্সটাইল বিশ্ববিদ্যালয়',
    locationCity: 'Dhaka',
    type: 'public',
  },
  {
    shortName: 'BMarU',
    slug: 'bmaru',
    nameEn: 'Bangladesh Maritime University',
    nameBn: 'বাংলাদেশ মেরিটাইম ইউনিভার্সিটি',
    locationCity: 'Chittagong',
    type: 'public',
  },
  {
    shortName: 'UFTB',
    slug: 'uftb',
    nameEn: 'University of Frontier Technology, Bangladesh',
    nameBn: 'ইউনিভার্সিটি অব ফ্রন্টিয়ার টেকনোলজি, বাংলাদেশ',
    locationCity: 'Gazipur',
    type: 'public',
  },
  {
    shortName: 'AAUB',
    slug: 'aaub',
    nameEn: 'Aviation and Aerospace University Bangladesh',
    nameBn: 'অ্যাভিয়েশন অ্যান্ড অ্যারোস্পেস বিশ্ববিদ্যালয়, বাংলাদেশ',
    locationCity: 'Lalmonirhat',
    type: 'public',
  },
  {
    shortName: 'NU',
    slug: 'nu',
    nameEn: 'National University Bangladesh',
    nameBn: 'জাতীয় বিশ্ববিদ্যালয়',
    locationCity: 'Gazipur',
    type: 'public',
  },
  {
    shortName: 'BOU',
    slug: 'bou',
    nameEn: 'Bangladesh Open University',
    nameBn: 'বাংলাদেশ উন্মুক্ত বিশ্ববিদ্যালয়',
    locationCity: 'Gazipur',
    type: 'public',
  },
  {
    shortName: 'IAU',
    slug: 'iau',
    nameEn: 'Islamic Arabic University',
    nameBn: 'ইসলামী আরবি বিশ্ববিদ্যালয়',
    locationCity: 'Dhaka',
    type: 'public',
  },
  // ── International ────────────────────────────────────────────────────────
  {
    shortName: 'IUT',
    slug: 'iut',
    nameEn: 'Islamic University of Technology',
    nameBn: 'ইসলামিক ইউনিভার্সিটি অব টেকনোলজি',
    locationCity: 'Gazipur',
    type: 'international',
  },
  {
    shortName: 'AUW',
    slug: 'auw',
    nameEn: 'Asian University for Women',
    nameBn: 'এশিয়ান ইউনিভার্সিটি ফর উইমেন',
    locationCity: 'Chittagong',
    type: 'international',
  },
  // ── Private universities — Dhaka tier-1 ──────────────────────────────────
  {
    shortName: 'NSU',
    slug: 'nsu',
    nameEn: 'North South University',
    nameBn: 'নর্থ সাউথ বিশ্ববিদ্যালয়',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'BRACU',
    slug: 'bracu',
    nameEn: 'BRAC University',
    nameBn: 'ব্র্যাক বিশ্ববিদ্যালয়',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'IUB',
    slug: 'iub',
    nameEn: 'Independent University, Bangladesh',
    nameBn: 'ইন্ডিপেন্ডেন্ট বিশ্ববিদ্যালয় বাংলাদেশ',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'AIUB',
    slug: 'aiub',
    nameEn: 'American International University-Bangladesh',
    nameBn: 'আমেরিকান ইন্টারন্যাশনাল ইউনিভার্সিটি-বাংলাদেশ',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'EWU',
    slug: 'ewu',
    nameEn: 'East West University',
    nameBn: 'ইস্ট ওয়েস্ট বিশ্ববিদ্যালয়',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'UIU',
    slug: 'uiu',
    nameEn: 'United International University',
    nameBn: 'ইউনাইটেড ইন্টারন্যাশনাল ইউনিভার্সিটি',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'AUST',
    slug: 'aust',
    nameEn: 'Ahsanullah University of Science and Technology',
    nameBn: 'আহ্‌ছানউল্লা বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'DIU',
    slug: 'diu',
    nameEn: 'Daffodil International University',
    nameBn: 'ড্যাফোডিল ইন্টারন্যাশনাল ইউনিভার্সিটি',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'ULAB',
    slug: 'ulab',
    nameEn: 'University of Liberal Arts Bangladesh',
    nameBn: 'ইউনিভার্সিটি অব লিবারেল আর্টস বাংলাদেশ',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'UAP',
    slug: 'uap',
    nameEn: 'University of Asia Pacific',
    nameBn: 'ইউনিভার্সিটি অফ এশিয়া প্যাসিফিক',
    locationCity: 'Dhaka',
    type: 'private',
  },
  // ── Other private universities (Dhaka) ───────────────────────────────────
  {
    shortName: 'IUBAT',
    slug: 'iubat',
    nameEn: 'International University of Business Agriculture and Technology',
    nameBn: 'ইন্টারন্যাশনাল ইউনিভার্সিটি অব বিজনেস এগ্রিকালচার অ্যান্ড টেকনোলজি',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'DhIU',
    slug: 'dhiu',
    nameEn: 'Dhaka International University',
    nameBn: 'ঢাকা ইন্টারন্যাশনাল ইউনিভার্সিটি',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'AUB',
    slug: 'aub',
    nameEn: 'Asian University of Bangladesh',
    nameBn: 'এশিয়ান ইউনিভার্সিটি অব বাংলাদেশ',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'GB',
    slug: 'gb',
    nameEn: 'Gono Bishwabidyalay',
    nameBn: 'গণ বিশ্ববিদ্যালয়',
    locationCity: 'Savar',
    type: 'private',
  },
  {
    shortName: 'PUB',
    slug: 'pub',
    nameEn: "The People's University of Bangladesh",
    nameBn: 'দ্য পিপলস ইউনিভার্সিটি অব বাংলাদেশ',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'QU',
    slug: 'qu',
    nameEn: 'Queens University',
    nameBn: 'কুইন্স বিশ্ববিদ্যালয়',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'MIU',
    slug: 'miu',
    nameEn: 'Manarat International University',
    nameBn: 'মানারাত ইন্টারন্যাশনাল ইউনিভার্সিটি',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'BdshU',
    slug: 'bdshu',
    nameEn: 'Bangladesh University',
    nameBn: 'বাংলাদেশ ইউনিভার্সিটি',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'UODA',
    slug: 'uoda',
    nameEn: 'University of Development Alternative',
    nameBn: 'ইউনিভার্সিটি অব ডেভেলপমেন্ট অল্টারনেটিভ',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'CUB',
    slug: 'cub',
    nameEn: 'City University, Bangladesh',
    nameBn: 'সিটি ইউনিভার্সিটি',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'GUB',
    slug: 'gub',
    nameEn: 'Green University of Bangladesh',
    nameBn: 'গ্রিন ইউনিভার্সিটি অব বাংলাদেশ',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'IBAIS',
    slug: 'ibais',
    nameEn: 'IBAIS University',
    nameBn: 'ইবাইস ইউনিভার্সিটি',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'NUB',
    slug: 'nub',
    nameEn: 'Northern University, Bangladesh',
    nameBn: 'নর্দান ইউনিভার্সিটি বাংলাদেশ',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'PrU',
    slug: 'pru',
    nameEn: 'Prime University',
    nameBn: 'প্রাইম বিশ্ববিদ্যালয়',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'SEU',
    slug: 'seu',
    nameEn: 'Southeast University',
    nameBn: 'সাউথইস্ট ইউনিভার্সিটি',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'StU',
    slug: 'stu',
    nameEn: 'Stamford University Bangladesh',
    nameBn: 'স্ট্যামফোর্ড বিশ্ববিদ্যালয় বাংলাদেশ',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'SUBdsh',
    slug: 'subdsh',
    nameEn: 'State University of Bangladesh',
    nameBn: 'স্টেট ইউনিভার্সিটি অব বাংলাদেশ',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'EastU',
    slug: 'eastu',
    nameEn: 'Eastern University',
    nameBn: 'ইস্টার্ন ইউনিভার্সিটি',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'MillU',
    slug: 'millu',
    nameEn: 'The Millennium University',
    nameBn: 'দ্য মিলেনিয়াম ইউনিভার্সিটি',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'PAU',
    slug: 'pau',
    nameEn: 'Primeasia University',
    nameBn: 'প্রাইম এশিয়া বিশ্ববিদ্যালয়',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'RUD',
    slug: 'rud',
    nameEn: 'Royal University of Dhaka',
    nameBn: 'রয়েল ইউনিভার্সিটি অব ঢাকা',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'UITS',
    slug: 'uits',
    nameEn: 'University of Information Technology and Sciences',
    nameBn: 'ইউনিভার্সিটি অব ইনফরমেশন টেকনোলজি অ্যান্ড সায়েন্সেস',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'USAB',
    slug: 'usab',
    nameEn: 'University of South Asia',
    nameBn: 'ইউনিভার্সিটি অব সাউথ এশিয়া',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'PresU',
    slug: 'presu',
    nameEn: 'Presidency University',
    nameBn: 'প্রেসিডেন্সি বিশ্ববিদ্যালয়',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'UU',
    slug: 'uu',
    nameEn: 'Uttara University',
    nameBn: 'উত্তরা ইউনিভার্সিটি',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'VUB',
    slug: 'vub',
    nameEn: 'Victoria University of Bangladesh',
    nameBn: 'ভিক্টোরিয়া ইউনিভার্সিটি অব বাংলাদেশ',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'WUB',
    slug: 'wub',
    nameEn: 'World University of Bangladesh',
    nameBn: 'ওয়ার্ল্ড ইউনিভার্সিটি অব বাংলাদেশ',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'ASAUB',
    slug: 'asaub',
    nameEn: 'ASA University Bangladesh',
    nameBn: 'আশা বিশ্ববিদ্যালয় বাংলাদেশ',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'BIU',
    slug: 'biu',
    nameEn: 'Bangladesh Islami University',
    nameBn: 'বাংলাদেশ ইসলামী বিশ্ববিদ্যালয়',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'EUB',
    slug: 'eub',
    nameEn: 'European University of Bangladesh',
    nameBn: 'ইউরোপিয়ান ইউনিভার্সিটি অফ বাংলাদেশ',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'BUFT',
    slug: 'buft',
    nameEn: 'BGMEA University of Fashion & Technology',
    nameBn: 'বিজিএমইএ ইউনিভার্সিটি অব ফ্যাশন অ্যান্ড টেকনোলজি',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'NDUB',
    slug: 'ndub',
    nameEn: 'Notre Dame University Bangladesh',
    nameBn: 'নটর ডেম বিশ্ববিদ্যালয় বাংলাদেশ',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'TMUB',
    slug: 'tmub',
    nameEn: 'Times University Bangladesh',
    nameBn: 'টাইমস বিশ্ববিদ্যালয় বাংলাদেশ',
    locationCity: 'Faridpur',
    type: 'private',
  },
  {
    shortName: 'CanU',
    slug: 'canu',
    nameEn: 'Canadian University of Bangladesh',
    nameBn: 'কানাডিয়ান ইউনিভার্সিটি অব বাংলাদেশ',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'FIU',
    slug: 'fiu',
    nameEn: 'Fareast International University',
    nameBn: 'ফারইস্ট ইন্টারন্যাশনাল ইউনিভার্সিটি',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'NPIUB',
    slug: 'npiub',
    nameEn: 'NPI University of Bangladesh',
    nameBn: 'এনপিআই ইউনিভার্সিটি অব বাংলাদেশ',
    locationCity: 'Manikganj',
    type: 'private',
  },
  {
    shortName: 'IUS',
    slug: 'ius',
    nameEn: 'The International University of Scholars',
    nameBn: 'ইন্টারন্যাশনাল ইউনিভার্সিটি অব স্কলার্স',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'AKMU',
    slug: 'akmu',
    nameEn: 'Anwer Khan Modern University',
    nameBn: 'আনোয়ার খান মডার্ন ইউনিভার্সিটি',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'ISU',
    slug: 'isu',
    nameEn: 'International Standard University',
    nameBn: 'ইন্টারন্যাশনাল স্ট্যান্ডার্ড ইউনিভার্সিটি',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'ZUMS',
    slug: 'zums',
    nameEn: 'ZNRF University of Management Sciences',
    nameBn: 'জেডএনআরএফ ইউনিভার্সিটি অব ম্যানেজমেন্ট সায়েন্সেস',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'BUBT',
    slug: 'bubt',
    nameEn: 'Bangladesh University of Business and Technology',
    nameBn: 'বাংলাদেশ ইউনিভার্সিটি অব বিজনেস অ্যান্ড টেকনোলজি',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'ADUST',
    slug: 'adust',
    nameEn: 'Atish Dipankar University of Science and Technology',
    nameBn: 'অতীশ দীপঙ্কর বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'CUST',
    slug: 'cust',
    nameEn: 'Central University of Science and Technology',
    nameBn: 'সেন্ট্রাল ইউনিভার্সিটি অব সায়েন্স অ্যান্ড টেকনোলজি',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'CWU',
    slug: 'cwu',
    nameEn: "Central Women's University",
    nameBn: 'সেন্ট্রাল উইমেন্স ইউনিভার্সিটি',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'SMUCT',
    slug: 'smuct',
    nameEn: 'Shanto-Mariam University of Creative Technology',
    nameBn: 'শান্ত-মারিয়াম ইউনিভার্সিটি অব ক্রিয়েটিভ টেকনোলজি',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'SonU',
    slug: 'sonu',
    nameEn: 'Sonargaon University',
    nameBn: 'সোনারগাঁও বিশ্ববিদ্যালয়',
    locationCity: 'Dhaka',
    type: 'private',
  },
  {
    shortName: 'BUHS',
    slug: 'buhs',
    nameEn: 'Bangladesh University of Health Sciences',
    nameBn: 'বাংলাদেশ ইউনিভার্সিটি অব হেল্‌থ সায়েন্সেস',
    locationCity: 'Dhaka',
    type: 'private',
  },
  // ── Private universities (Chittagong / Sylhet / regional) ────────────────
  {
    shortName: 'IIUC',
    slug: 'iiuc',
    nameEn: 'International Islamic University, Chittagong',
    nameBn: 'আন্তর্জাতিক ইসলামী বিশ্ববিদ্যালয় চট্টগ্রাম',
    locationCity: 'Chittagong',
    type: 'private',
  },
  {
    shortName: 'CIU',
    slug: 'ciu',
    nameEn: 'Chittagong Independent University',
    nameBn: 'চট্টগ্রাম ইনডিপেন্ডেন্ট ইউনিভার্সিটি',
    locationCity: 'Chittagong',
    type: 'private',
  },
  {
    shortName: 'EDU',
    slug: 'edu',
    nameEn: 'East Delta University',
    nameBn: 'ইস্ট ডেল্টা বিশ্ববিদ্যালয়',
    locationCity: 'Chittagong',
    type: 'private',
  },
  {
    shortName: 'PCIU',
    slug: 'pciu',
    nameEn: 'Port City International University',
    nameBn: 'পোর্ট সিটি ইন্টারন্যাশনাল ইউনিভার্সিটি',
    locationCity: 'Chittagong',
    type: 'private',
  },
  {
    shortName: 'USTC',
    slug: 'ustc',
    nameEn: 'University of Science and Technology Chittagong',
    nameBn: 'বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয় চট্টগ্রাম',
    locationCity: 'Chittagong',
    type: 'private',
  },
  {
    shortName: 'UCTC',
    slug: 'uctc',
    nameEn: 'University of Creative Technology, Chittagong',
    nameBn: 'ইউনিভার্সিটি অব ক্রিয়েটিভ টেকনোলজি, চট্টগ্রাম',
    locationCity: 'Chittagong',
    type: 'private',
  },
  {
    shortName: 'PUC',
    slug: 'puc',
    nameEn: 'Premier University, Chittagong',
    nameBn: 'প্রিমিয়ার বিশ্ববিদ্যালয়, চট্টগ্রাম',
    locationCity: 'Chittagong',
    type: 'private',
  },
  {
    shortName: 'SUB',
    slug: 'sub',
    nameEn: 'Southern University Bangladesh',
    nameBn: 'সাউদার্ন ইউনিভার্সিটি বাংলাদেশ',
    locationCity: 'Chittagong',
    type: 'private',
  },
  {
    shortName: 'BGCTUB',
    slug: 'bgctub',
    nameEn: 'BGC Trust University Bangladesh',
    nameBn: 'বিজিসি ট্রাস্ট বিশ্ববিদ্যালয় বাংলাদেশ',
    locationCity: 'Chittagong',
    type: 'private',
  },
  {
    shortName: 'CBIU',
    slug: 'cbiu',
    nameEn: "Cox's Bazar International University",
    nameBn: 'কক্সবাজার ইন্টারন্যাশনাল ইউনিভার্সিটি',
    locationCity: "Cox's Bazar",
    type: 'private',
  },
  {
    shortName: 'LU',
    slug: 'lu',
    nameEn: 'Leading University',
    nameBn: 'লিডিং ইউনিভার্সিটি',
    locationCity: 'Sylhet',
    type: 'private',
  },
  {
    shortName: 'MU',
    slug: 'mu',
    nameEn: 'Metropolitan University',
    nameBn: 'মেট্রোপলিটন ইউনিভার্সিটি',
    locationCity: 'Sylhet',
    type: 'private',
  },
  {
    shortName: 'NEUB',
    slug: 'neub',
    nameEn: 'North East University Bangladesh',
    nameBn: 'নর্থ ইষ্ট ইউনিভার্সিটি',
    locationCity: 'Sylhet',
    type: 'private',
  },
  {
    shortName: 'SIU',
    slug: 'siu',
    nameEn: 'Sylhet International University',
    nameBn: 'সিলেট ইন্টারন্যাশনাল ইউনিভার্সিটি',
    locationCity: 'Sylhet',
    type: 'private',
  },
  {
    shortName: 'RTMAKTU',
    slug: 'rtmaktu',
    nameEn: 'RTM Al-Kabir Technical University',
    nameBn: 'আরটিএম আল-কবির টেকনিক্যাল ইউনিভার্সিটি',
    locationCity: 'Sylhet',
    type: 'private',
  },
  {
    shortName: 'VU',
    slug: 'vu',
    nameEn: 'Varendra University',
    nameBn: 'বরেন্দ্র বিশ্ববিদ্যালয়',
    locationCity: 'Rajshahi',
    type: 'private',
  },
  {
    shortName: 'NBIU',
    slug: 'nbiu',
    nameEn: 'North Bengal International University',
    nameBn: 'নর্থ বেঙ্গল ইন্টারন্যাশনাল ইউনিভার্সিটি',
    locationCity: 'Rajshahi',
    type: 'private',
  },
  {
    shortName: 'NWU',
    slug: 'nwu',
    nameEn: 'North Western University, Bangladesh',
    nameBn: 'নর্থ ওয়েস্টার্ন বিশ্ববিদ্যালয়, বাংলাদেশ',
    locationCity: 'Khulna',
    type: 'private',
  },
  {
    shortName: 'NUBT',
    slug: 'nubt',
    nameEn: 'Northern University of Business and Technology, Khulna',
    nameBn: 'নর্দান ইউনিভার্সিটি অব বিজনেস অ্যান্ড টেকনোলজি খুলনা',
    locationCity: 'Khulna',
    type: 'private',
  },
  {
    shortName: 'KYAU',
    slug: 'kyau',
    nameEn: 'Khwaja Yunus Ali University',
    nameBn: 'খাজা ইউনুস আলী বিশ্ববিদ্যালয়',
    locationCity: 'Sirajganj',
    type: 'private',
  },
  {
    shortName: 'RbMU',
    slug: 'rbmu',
    nameEn: 'Rabindra Maitree University',
    nameBn: 'রবীন্দ্র মৈত্রী বিশ্ববিদ্যালয়',
    locationCity: 'Kushtia',
    type: 'private',
  },
  {
    shortName: 'GUB-G',
    slug: 'gub-g',
    nameEn: 'German University Bangladesh',
    nameBn: 'জার্মান বিশ্ববিদ্যালয় বাংলাদেশ',
    locationCity: 'Gazipur',
    type: 'private',
  },
  {
    shortName: 'GUB-B',
    slug: 'gub-b',
    nameEn: 'Global University Bangladesh',
    nameBn: 'গ্লোবাল ইউনিভার্সিটি বাংলাদেশ',
    locationCity: 'Barisal',
    type: 'private',
  },
  {
    shortName: 'UIGV',
    slug: 'uigv',
    nameEn: 'University of Global Village',
    nameBn: 'ইউনিভার্সিটি অব গ্লোবাল ভিলেজ',
    locationCity: 'Barisal',
    type: 'private',
  },
  {
    shortName: 'TUB',
    slug: 'tub',
    nameEn: 'Trust University, Barishal',
    nameBn: 'ট্রাস্ট ইউনিভার্সিটি, বরিশাল',
    locationCity: 'Barisal',
    type: 'private',
  },
  {
    shortName: 'BritU',
    slug: 'britu',
    nameEn: 'Britannia University',
    nameBn: 'ব্রিটানিয়া বিশ্ববিদ্যালয়',
    locationCity: 'Comilla',
    type: 'private',
  },
  {
    shortName: 'CCNUST',
    slug: 'ccnust',
    nameEn: 'CCN University of Science and Technology',
    nameBn: 'সিসিএন বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Comilla',
    type: 'private',
  },
  {
    shortName: 'BAIUST',
    slug: 'baiust',
    nameEn: 'Bangladesh Army International University of Science & Technology',
    nameBn: 'বাংলাদেশ সেনাবাহিনী আন্তর্জাতিক বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Comilla',
    type: 'private',
  },
  {
    shortName: 'BAUST',
    slug: 'baust',
    nameEn: 'Bangladesh Army University of Science and Technology, Saidpur',
    nameBn: 'বাংলাদেশ সেনাবাহিনী বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Saidpur',
    type: 'private',
  },
  {
    shortName: 'BAUET',
    slug: 'bauet',
    nameEn: 'Bangladesh Army University of Engineering & Technology',
    nameBn: 'বাংলাদেশ আর্মি প্রকৌশল ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Natore',
    type: 'private',
  },
  {
    shortName: 'RSTU',
    slug: 'rstu',
    nameEn: 'Rajshahi Science & Technology University',
    nameBn: 'রাজশাহী বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Natore',
    type: 'private',
  },
  {
    shortName: 'ZHSUST',
    slug: 'zhsust',
    nameEn: 'Z.H. Sikder University of Science and Technology',
    nameBn: 'জেড এইচ সিকদার বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়',
    locationCity: 'Shariatpur',
    type: 'private',
  },
  {
    shortName: 'EBAUB',
    slug: 'ebaub',
    nameEn: 'Exim Bank Agricultural University Bangladesh',
    nameBn: 'এক্সিম ব্যাংক কৃষি বিশ্ববিদ্যালয় বাংলাদেশ',
    locationCity: 'Chapainawabganj',
    type: 'private',
  },
  {
    shortName: 'PDUST',
    slug: 'pdust',
    nameEn: 'Pundra University of Science and Technology',
    nameBn: 'পুন্ড্র ইউনিভার্সিটি অব সায়েন্স অ্যান্ড টেকনোলজি',
    locationCity: 'Bogura',
    type: 'private',
  },
  {
    shortName: 'FU',
    slug: 'fu',
    nameEn: 'Feni University',
    nameBn: 'ফেনী বিশ্ববিদ্যালয়',
    locationCity: 'Feni',
    type: 'private',
  },
  {
    shortName: 'FCUB',
    slug: 'fcub',
    nameEn: 'First Capital University of Bangladesh',
    nameBn: 'ফার্স্ট ক্যাপিটাল ইউনিভার্সিটি অব বাংলাদেশ',
    locationCity: 'Chuadanga',
    type: 'private',
  },
  {
    shortName: 'HUB',
    slug: 'hub',
    nameEn: 'Hamdard University Bangladesh',
    nameBn: 'হামদর্দ বিশ্ববিদ্যালয় বাংলাদেশ',
    locationCity: 'Munshiganj',
    type: 'private',
  },
  {
    shortName: 'IshU',
    slug: 'ishu',
    nameEn: 'Ishakha International University',
    nameBn: 'ঈশা খাঁ ইন্টারন্যাশনাল ইউনিভার্সিটি',
    locationCity: 'Kishoreganj',
    type: 'private',
  },
  {
    shortName: 'RPSU',
    slug: 'rpsu',
    nameEn: 'Ranada Prasad Shaha University',
    nameBn: 'রণদা প্রসাদ সাহা বিশ্ববিদ্যালয়',
    locationCity: 'Narayanganj',
    type: 'private',
  },
  {
    shortName: 'BdU',
    slug: 'bdu',
    nameEn: 'Bandarban University',
    nameBn: 'বান্দরবান বিশ্ববিদ্যালয়',
    locationCity: 'Bandarban',
    type: 'private',
  },
]

async function main() {
  console.log('🌱 Seeding database...')

  // Heal-in-place strategy: an earlier bulk-seed run may have planted rows
  // with auto-generated acronyms like BU/BU1/BU2 and stale slugs. We want
  // to rewrite those rows' shortNames/slugs to the Wikipedia-canonical
  // values without losing any FK-linked professors.
  //
  // Direct upsert hits unique-constraint collisions: uni A wants shortName
  // "DU" but a different stale row currently holds "DU". To avoid the
  // tangle, we first park every existing shortName/slug under a temporary
  // namespace, then run the canonical upserts in a clean field, then prune
  // anything that didn't get reclaimed and has no professors.
  await db.$transaction([
    db.$executeRaw`UPDATE universities SET short_name = '__tmp_' || id, slug = '__tmp_' || id`,
  ])

  let added = 0
  let updated = 0
  for (const u of BD_UNIVERSITIES) {
    const existing = await db.university.findUnique({
      where: { nameEn: u.nameEn },
      select: { id: true },
    })
    const uni = await db.university.upsert({
      where: { nameEn: u.nameEn },
      create: u,
      update: {
        shortName: u.shortName,
        slug: u.slug,
        nameBn: u.nameBn ?? null,
        locationCity: u.locationCity ?? null,
        type: u.type,
      },
    })
    if (existing) updated += 1
    else added += 1

    const depts = DEPARTMENTS_BY_SHORT_NAME[u.shortName]
    if (depts) {
      for (const d of depts) {
        await db.department.upsert({
          where: { universityId_slug: { universityId: uni.id, slug: d.slug } },
          create: { ...d, universityId: uni.id },
          update: { nameEn: d.nameEn, nameBn: d.nameBn ?? null, shortName: d.shortName },
        })
      }
    }
  }

  // Prune stale rows from older runs — but only the ones with NO professors
  // attached. Anything with real activity (reviews live behind professors)
  // keeps its row; the admin panel can rename it later. We identify stale
  // rows by the placeholder shortName prefix we set above — those never got
  // reclaimed by a canonical upsert.
  //
  // Departments FK to universities (no cascade in the schema) so we wipe
  // their departments first, then the universities themselves.
  const stale = await db.university.findMany({
    where: { shortName: { startsWith: '__tmp_' }, professors: { none: {} } },
    select: { id: true },
  })
  const staleIds = stale.map((u) => u.id)
  if (staleIds.length > 0) {
    await db.department.deleteMany({ where: { universityId: { in: staleIds } } })
  }
  const pruneResult = await db.university.deleteMany({
    where: { id: { in: staleIds } },
  })

  // Safety net: if any row is left with a placeholder shortName (because it
  // has professors attached and so we couldn't prune it), restore it to
  // something legible — its original name as a slugged shortName, truncated.
  const orphans = await db.university.findMany({
    where: { shortName: { startsWith: '__tmp_' } },
    select: { id: true, nameEn: true },
  })
  for (const o of orphans) {
    const recoveryShort = o.nameEn
      .split(/\s+/)
      .filter((w) => w.length > 0 && !['of', 'and', 'the', 'for'].includes(w.toLowerCase()))
      .map((w) => w[0]!.toUpperCase())
      .join('')
      .slice(0, 18)
    const recoverySlug = recoveryShort.toLowerCase()
    await db.university.update({
      where: { id: o.id },
      data: { shortName: `${recoveryShort}?`, slug: `${recoverySlug}-orphan-${o.id}` },
    })
    console.warn(
      `  ⚠ kept stale uni "${o.nameEn}" (has professors); marked shortName "${recoveryShort}?" for admin review`,
    )
  }

  console.log(
    `  ✓ Universities — ${added} added, ${updated} updated, ${pruneResult.count} stale pruned, ${orphans.length} kept (need admin review)`,
  )

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
