import type { Strings } from './strings-bn'

// English mirror of the Bangla strings. The `Strings` type from strings-bn
// is the source of truth — adding a key to BN without adding it here will
// fail TypeScript here, not at runtime.

export const EN: Strings = {
  // ── Site ──────────────────────────────────────────────────────────────────
  site: {
    name: 'Poray Kemon',
    tagline: "Anonymous ratings and reviews of Bangladesh's university professors and courses",
    searchPlaceholder: 'Search by professor name, department, or university...',
  },

  // ── Stats ─────────────────────────────────────────────────────────────────
  stats: {
    totalReviews: (n: number) => `${n.toLocaleString('en-US')} reviews`,
    totalProfessors: (n: number) => `${n.toLocaleString('en-US')} professors`,
    totalUniversities: (n: number) => `${n.toLocaleString('en-US')} universities`,
    totalCourses: (n: number) => `${n.toLocaleString('en-US')} courses`,
  },

  // ── Auth ──────────────────────────────────────────────────────────────────
  auth: {
    signInWithGoogle: 'Sign in with Google',
    signOut: 'Sign out',
    signInToReview: 'Sign in with Google to write a review',
    signInToVote: 'Sign in with Google to vote',
    signedInAs: (name: string) => `Signed in as ${name}`,
  },

  // ── Review form ───────────────────────────────────────────────────────────
  review: {
    formTitle: 'Write a review',
    submitButton: 'Submit review',
    anonymityNote: 'Your identity stays completely anonymous.',
    selectUniversity: 'Pick a university',
    selectDepartment: 'Pick a department',
    teacherNameLabel: "Professor's name",
    courseLabel: 'Course',
    courseNotFound: "Can't find the course? Add it →",
    courseCodePlaceholder: 'Course code (e.g. CSE 301)',
    courseNamePlaceholder: 'Course name',
    teachingQualityLabel: 'How well do they teach?',
    gradingFairnessLabel: 'How fair is the grading?',
    courseDifficultyLabel: 'How difficult is the course?',
    attendanceLabel: 'How strict on attendance?',
    wouldRecommendLabel: 'Would you take this course with this professor again?',
    wouldRecommendYes: 'Yes',
    wouldRecommendNo: 'No',
    tagsLabel: 'Pick tags (optional)',
    reviewTextLabel: 'Share your experience (optional)',
    reviewTextPlaceholder: 'Share your experience in this class...',
    maxChars: (current: number, max: number) => `${current} / ${max} characters`,
  },

  // ── Review submission responses ───────────────────────────────────────────
  reviewResponse: {
    success: 'Review submitted',
    alreadyReviewed: "You've already reviewed this course.",
    profanityBlock: 'Profanity is not allowed.',
    slurBlock: 'Discriminatory language is not allowed.',
    accusationBlock: 'Personal accusations are not allowed on this platform.',
    duplicateBlock: 'This review has already been submitted.',
  },

  // ── Review display ────────────────────────────────────────────────────────
  reviewDisplay: {
    helpful: (n: number) => `${n.toLocaleString('en-US')} found this helpful`,
    markHelpful: 'Helpful',
    report: 'Report',
    wouldRecommend: 'Would take again',
    wouldNotRecommend: 'Would not take again',
    noReviews: 'No reviews yet. Be the first!',
    sortByHelpful: 'Most helpful',
    sortByRecent: 'Most recent',
    userAlreadyReviewed: "You've reviewed this course",
  },

  // ── Professor profile ─────────────────────────────────────────────────────
  professor: {
    writeReview: 'Write a review',
    noCoursesYet: 'No courses reviewed yet.',
    overallScore: 'Overall score',
    wouldRecommendPercent: (pct: number) => `${pct}% would take again`,
    reviewCount: (n: number) => `${n.toLocaleString('en-US')} reviews`,
    status: {
      active: 'Active',
      retired: 'Retired',
      unverified: 'Unverified',
    },
    designation: {
      lecturer: 'Lecturer',
      assistant_professor: 'Assistant Professor',
      associate_professor: 'Associate Professor',
      professor: 'Professor',
      adjunct: 'Adjunct',
      other: 'Other',
    },
  },

  // ── Rating dimensions ─────────────────────────────────────────────────────
  ratings: {
    teachingQuality: 'Teaching quality',
    gradingFairness: 'Grading fairness',
    courseDifficulty: 'Course difficulty',
    attendance: 'Attendance strictness',
  },

  // ── Tags ──────────────────────────────────────────────────────────────────
  // Tag KEYS are Bangla (the data model) — we render labels in English here.
  tags: {
    স্লাইড_পড়েন: 'Just reads slides',
    বোর্ডে_বোঝান: 'Explains on the board',
    উদাহরণ_দিয়ে_বোঝান: 'Teaches with examples',
    প্রশ্ন_নেন: 'Encourages questions',
    প্রশ্ন_নেন_না: 'Discourages questions',
    অফিস_আওয়ার_দেন: 'Available outside class',
    পরীক্ষা_ক্লাস_থেকে_আসে: 'Exams match lectures',
    পরীক্ষা_ক্লাস_থেকে_আসে_না: "Exams don't match lectures",
    নম্বরে_কঞ্জুস: 'Stingy with marks',
    গ্রেড_ভালো_দেন: 'Generous grader',
    উপস্থিতি_কড়া: 'Strict attendance',
    উপস্থিতি_নমনীয়: 'Flexible attendance',
    ইংরেজিতে_পড়ান: 'Teaches in English',
    বাংলায়_পড়ান: 'Teaches in Bangla',
    সহজলভ্য: 'Approachable',
    দূরত্ব_বজায়_রাখেন: 'Distant',
    পক্ষপাতমূলক: 'Plays favorites',
    অনুপ্রেরণাদায়ক: 'Inspiring teacher',
  },

  // ── Report ────────────────────────────────────────────────────────────────
  report: {
    title: 'Report this review',
    submitButton: 'Submit report',
    success: "Report submitted. We'll review it shortly.",
    reasons: {
      personal: "It's about me personally",
      fake: 'Fake / spam review',
      offensive: 'Offensive content',
      wrong_professor: 'Wrong professor',
      other: 'Other',
    },
  },

  // ── Moderation ────────────────────────────────────────────────────────────
  moderation: {
    removedNotice: 'This review was removed for violating our guidelines.',
  },

  // ── Navigation ────────────────────────────────────────────────────────────
  nav: {
    home: 'Home',
    universities: 'Universities',
    about: 'About',
    writeReview: 'Write a review',
    language: 'Language',
    languageBangla: 'বাংলা',
    languageEnglish: 'English',
  },

  // ── Errors ────────────────────────────────────────────────────────────────
  errors: {
    notFound: 'Page not found.',
    serverError: 'Something went wrong. Please try again.',
    unauthorized: 'You need to sign in to do that.',
    required: 'This field is required.',
  },

  // ── Admin (English in both locales — internal tooling) ────────────────────
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
