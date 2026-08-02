// Bangla strings — the default locale.
// The shape here is the source of truth; the English mirror in strings-en.ts
// must match key-for-key (enforced by the `Strings` type below).

export const BN = {
  // ── Site ──────────────────────────────────────────────────────────────────
  site: {
    name: 'পড়ায় কেমন',
    tagline: 'বাংলাদেশের বিশ্ববিদ্যালয়গুলোর শিক্ষকদের নিয়ে বেনামী রেটিং ও রিভিউ',
    searchPlaceholder: 'শিক্ষকের নাম, বিভাগ বা বিশ্ববিদ্যালয় খুঁজুন...',
  },

  // ── Stats ─────────────────────────────────────────────────────────────────
  stats: {
    totalReviews: (n: number) => `${n} টি রিভিউ`,
    totalProfessors: (n: number) => `${n} জন শিক্ষক`,
    totalUniversities: (n: number) => `${n} টি বিশ্ববিদ্যালয়`,
    totalCourses: (n: number) => `${n} টি কোর্স`,
  },

  // ── Auth ──────────────────────────────────────────────────────────────────
  auth: {
    signInWithGoogle: 'Google দিয়ে সাইন ইন করুন',
    signOut: 'সাইন আউট',
    signInToReview: 'রিভিউ দিতে Google দিয়ে সাইন ইন করুন',
    signInToVote: 'ভোট দিতে Google দিয়ে সাইন ইন করুন',
    signedInAs: (name: string) => `${name} হিসেবে সাইন ইন করা আছে`,
  },

  // ── Review form ───────────────────────────────────────────────────────────
  review: {
    formTitle: 'রিভিউ লিখুন',
    submitButton: 'রিভিউ জমা দিন',
    anonymityNote: 'আপনার পরিচয় সম্পূর্ণ গোপন থাকবে।',
    selectUniversity: 'বিশ্ববিদ্যালয় বেছে নিন',
    selectDepartment: 'বিভাগ বেছে নিন',
    teacherNameLabel: 'শিক্ষকের নাম',
    courseLabel: 'কোর্স',
    courseNotFound: 'কোর্স না পেলে নিজে লিখুন →',
    courseCodePlaceholder: 'কোর্স কোড (যেমন CSE 301)',
    courseNamePlaceholder: 'কোর্সের নাম',
    teachingQualityLabel: 'ক্লাসে কতটা ভালো পড়ান?',
    gradingFairnessLabel: 'নম্বর দেওয়া কতটা ন্যায্য?',
    courseDifficultyLabel: 'কোর্সটা কতটা কঠিন?',
    attendanceLabel: 'অ্যাটেনডেন্স কতটা কড়া?',
    wouldRecommendLabel: 'আবার এই কোর্সটা এই শিক্ষকের কাছে নেবেন?',
    wouldRecommendYes: 'হ্যাঁ',
    wouldRecommendNo: 'না',
    tagsLabel: 'ট্যাগ বেছে নিন (ঐচ্ছিক)',
    reviewTextLabel: 'আপনার অভিজ্ঞতা লিখুন (ঐচ্ছিক)',
    reviewTextPlaceholder: 'এই শিক্ষকের ক্লাসে আপনার অভিজ্ঞতা শেয়ার করুন...',
    maxChars: (current: number, max: number) => `${current} / ${max} অক্ষর`,
  },

  // ── Review submission responses ───────────────────────────────────────────
  reviewResponse: {
    success: 'রিভিউ জমা হয়েছে',
    alreadyReviewed: 'আপনি এই কোর্সে ইতিমধ্যে রিভিউ দিয়েছেন।',
    profanityBlock: 'আপত্তিজনক শব্দ ব্যবহার করা যাবে না।',
    slurBlock: 'বৈষম্যমূলক ভাষা গ্রহণযোগ্য নয়।',
    accusationBlock: 'ব্যক্তিগত অভিযোগ এই প্ল্যাটফর্মে প্রযোজ্য নয়।',
    duplicateBlock: 'এই রিভিউটি আগে জমা হয়েছে।',
  },

  // ── Review display ────────────────────────────────────────────────────────
  reviewDisplay: {
    helpful: (n: number) => `${n} জন সহায়ক মনে করেছেন`,
    markHelpful: 'সহায়ক ছিল',
    report: 'রিপোর্ট করুন',
    wouldRecommend: 'আবার নেবেন',
    wouldNotRecommend: 'আবার নেবেন না',
    noReviews: 'এখনো কোনো রিভিউ নেই। প্রথম রিভিউ দিন!',
    sortByHelpful: 'সবচেয়ে সহায়ক',
    sortByRecent: 'সর্বশেষ',
    userAlreadyReviewed: 'আপনি এই কোর্সে রিভিউ দিয়েছেন',
  },

  // ── Share ─────────────────────────────────────────────────────────────────
  share: {
    label: 'শেয়ার',
    facebook: 'ফেসবুক',
    whatsapp: 'হোয়াটসঅ্যাপ',
    messenger: 'মেসেঞ্জার',
    twitter: 'X (টুইটার)',
    copyLink: 'লিংক কপি করুন',
    copied: 'কপি হয়েছে',
    shareReview: 'এই রিভিউ শেয়ার করুন',
    shareProfessor: 'এই শিক্ষককে শেয়ার করুন',
  },

  // ── Professor profile ─────────────────────────────────────────────────────
  professor: {
    writeReview: 'রিভিউ লিখুন',
    noCoursesYet: 'এখনো কোনো কোর্সের রিভিউ নেই।',
    overallScore: 'সামগ্রিক স্কোর',
    wouldRecommendPercent: (pct: number) => `${pct}% শিক্ষার্থী আবার নেবেন`,
    reviewCount: (n: number) => `${n} টি রিভিউ`,
    status: {
      active: 'কর্মরত',
      retired: 'অবসরপ্রাপ্ত',
      unverified: 'যাচাইকৃত নয়',
    },
    designation: {
      lecturer: 'প্রভাষক',
      assistant_professor: 'সহকারী অধ্যাপক',
      associate_professor: 'সহযোগী অধ্যাপক',
      professor: 'অধ্যাপক',
      adjunct: 'খণ্ডকালীন',
      other: 'অন্যান্য',
    },
  },

  // ── Rating dimensions ─────────────────────────────────────────────────────
  ratings: {
    teachingQuality: 'পড়ানোর মান',
    gradingFairness: 'নম্বরের ন্যায্যতা',
    courseDifficulty: 'কোর্সের কঠিনত্ব',
    attendance: 'উপস্থিতির বাধ্যবাধকতা',
  },

  // ── Tags ──────────────────────────────────────────────────────────────────
  tags: {
    স্লাইড_পড়েন: 'স্লাইড পড়েন',
    বোর্ডে_বোঝান: 'বোর্ডে বোঝান',
    উদাহরণ_দিয়ে_বোঝান: 'উদাহরণ দিয়ে বোঝান',
    প্রশ্ন_নেন: 'প্রশ্ন নেন',
    প্রশ্ন_নেন_না: 'প্রশ্ন নেন না',
    অফিস_আওয়ার_দেন: 'অফিস আওয়ার দেন',
    পরীক্ষা_ক্লাস_থেকে_আসে: 'পরীক্ষা ক্লাস থেকে আসে',
    পরীক্ষা_ক্লাস_থেকে_আসে_না: 'পরীক্ষা ক্লাস থেকে আসে না',
    নম্বরে_কঞ্জুস: 'নম্বরে কঞ্জুস',
    গ্রেড_ভালো_দেন: 'গ্রেড ভালো দেন',
    উপস্থিতি_কড়া: 'উপস্থিতি কড়া',
    উপস্থিতি_নমনীয়: 'উপস্থিতি নমনীয়',
    ইংরেজিতে_পড়ান: 'ইংরেজিতে পড়ান',
    বাংলায়_পড়ান: 'বাংলায় পড়ান',
    সহজলভ্য: 'সহজলভ্য',
    দূরত্ব_বজায়_রাখেন: 'দূরত্ব বজায় রাখেন',
    পক্ষপাতমূলক: 'পক্ষপাতমূলক',
    অনুপ্রেরণাদায়ক: 'অনুপ্রেরণাদায়ক',
  },

  // ── Report ────────────────────────────────────────────────────────────────
  report: {
    title: 'রিভিউ রিপোর্ট করুন',
    submitButton: 'রিপোর্ট জমা দিন',
    success: 'রিপোর্ট জমা হয়েছে। আমরা শীঘ্রই দেখব।',
    reasons: {
      personal: 'এটি আমার সম্পর্কে',
      fake: 'এটি ভুয়া রিভিউ',
      offensive: 'এটি আপত্তিজনক',
      wrong_professor: 'প্রফেসর ভুল',
      other: 'অন্যান্য',
    },
  },

  // ── Moderation ────────────────────────────────────────────────────────────
  moderation: {
    removedNotice: 'এই রিভিউটি আমাদের নীতিমালা লঙ্ঘনের কারণে সরিয়ে নেওয়া হয়েছে।',
  },

  // ── Navigation ────────────────────────────────────────────────────────────
  nav: {
    home: 'হোম',
    universities: 'বিশ্ববিদ্যালয়',
    about: 'আমাদের সম্পর্কে',
    writeReview: 'রিভিউ লিখুন',
    /** Narrow-viewport label for the navbar CTA. */
    writeReviewShort: 'রিভিউ',
    language: 'ভাষা',
    languageBangla: 'বাংলা',
    languageEnglish: 'English',
  },

  // ── Errors ────────────────────────────────────────────────────────────────
  errors: {
    notFound: 'পাতাটি খুঁজে পাওয়া যায়নি।',
    serverError: 'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।',
    unauthorized: 'এই কাজটি করতে সাইন ইন করতে হবে।',
    required: 'এই তথ্যটি আবশ্যিক।',
  },

  // ── Admin (English — internal tooling, not user-facing) ───────────────────
  admin: {
    title: 'Admin',
    login: 'Sign in',
    logout: 'Sign out',
    usernameLabel: 'Username',
    passwordLabel: 'Password',
    invalidCredentials: 'Invalid username or password',
    dashboard: 'Dashboard',
    queue: 'Moderation queue',
    reports: 'Reports',
    professors: 'Professors',
    pendingReports: 'Pending reports',
    softFlagged: 'Soft-flagged reviews',
    flaggedHidden: 'Hidden (3+ reports)',
    totalReviews: 'Total reviews',
    totalProfessors: 'Total professors',
    totalUniversities: 'Total universities',
    actionApprove: 'Approve',
    actionHide: 'Hide',
    actionDelete: 'Delete',
    actionResolveKeep: 'Keep review',
    actionResolveRemove: 'Remove review',
    confirmDelete: 'Permanently delete this review? This cannot be undone.',
    confirmHide: 'Hide this review from public view?',
    statusUpdated: 'Status updated',
  },
}

// Type derived from BN — the shape is the source of truth; the English mirror
// in strings-en.ts must match key-for-key. We do NOT use `as const` on the
// object so literal types stay wide enough for the EN mirror to assign into.
export type Strings = typeof BN
