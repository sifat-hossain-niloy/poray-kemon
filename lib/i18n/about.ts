// ─────────────────────────────────────────────────────────────────────────────
// About-page copy.
//
// Lives in its own module so the main STRINGS bundle stays focused on UI
// chrome. Both locales mirror the same shape — the type below is the
// single source of truth.
// ─────────────────────────────────────────────────────────────────────────────

export interface AboutContent {
  title: string
  mission: { heading: string; paragraphs: string[] }
  anonymity: { heading: string; paragraphs: string[]; bullets: string[] }
  data: { heading: string; bullets: string[] }
  moderation: { heading: string; paragraphs: string[] }
  contact: { heading: string; paragraphs: string[] }
  lastUpdated: string
}

export const ABOUT_BN: AboutContent = {
  title: 'আমাদের সম্পর্কে',
  mission: {
    heading: 'আমাদের লক্ষ্য',
    paragraphs: [
      'পড়ায় কেমন একটি বেনামী প্ল্যাটফর্ম, যেখানে বাংলাদেশের বিশ্ববিদ্যালয়ের শিক্ষার্থীরা তাদের শিক্ষক ও কোর্স নিয়ে অভিজ্ঞতা শেয়ার করতে পারেন। সিদ্ধান্ত যেন WhatsApp গ্রুপের ব্যক্তিগত মতামতের উপর নির্ভর না করে, বরং প্রকৃত শিক্ষার্থী অভিজ্ঞতার উপর হয় — সেটাই আমাদের লক্ষ্য।',
      'নামটি — "পড়ায় কেমন" — শিক্ষার্থীরা একে অপরকে যে প্রশ্নটি সবসময় করে, ঠিক সেটাই।',
    ],
  },
  anonymity: {
    heading: 'বেনামীয়তার চুক্তি',
    paragraphs: [
      'আপনি Google দিয়ে সাইন ইন করে রিভিউ লিখলেও — আপনার পরিচয় কখনোই রিভিউ-এর সাথে সংরক্ষিত হয় না। ডাটাবেস ফাঁস হলেও কোন রিভিউ কে লিখেছে তা বের করার কোনো উপায় নেই।',
    ],
    bullets: [
      'রিভিউ যে টেবিলে থাকে সেখানে ব্যবহারকারী চিহ্নিত করার কোনো কলাম নেই — কাঠামোগতভাবেই অসম্ভব।',
      '"এই ব্যবহারকারী এই কোর্সে রিভিউ দিয়েছে" এই তথ্য আলাদা একটি টেবিলে থাকে — সেখানে রিভিউয়ের কোনো রেফারেন্স নেই, লেখাও নেই।',
      'দুই টেবিলে কোনো ফরেন কী যোগসূত্র নেই — সরাসরি JOIN করে মিলানো যায় না।',
      'দুই টেবিলের আইডিও ভিন্ন ধরনের (একটিতে ক্রমিক সংখ্যা, অন্যটিতে র‍্যান্ডম UUID) — তাই আইডি সাজিয়েও পাশাপাশি বসিয়ে মিলানো সম্ভব নয়।',
      'সাবমিশন টেবিলে কখন রিভিউ দেওয়া হয়েছে সেই টাইমস্ট্যাম্পও রাখা হয় না — যাতে সময় দিয়েও মিলানো না যায়।',
      'আপনার IP ঠিকানা কোথাও সংরক্ষিত হয় না।',
      'আপনার Google ইমেইল আমরা কখনো সংরক্ষণ করি না — শুধু একটি অভ্যন্তরীণ আইডেন্টিফায়ার।',
    ],
  },
  data: {
    heading: 'আমরা কী সংরক্ষণ করি',
    bullets: [
      'রিভিউ: রেটিং, ট্যাগ, এবং আপনার লেখা টেক্সট — কোনো ব্যবহারকারীর তথ্য ছাড়া।',
      'অ্যাকাউন্ট: শুধু Google-এর অভ্যন্তরীণ আইডি (`sub`) এবং প্রদর্শনের নাম। ইমেইল বা ছবি নয়।',
      'কোন কোর্সে কে রিভিউ দিয়েছে: ডুপ্লিকেট ঠেকাতে — কিন্তু রিভিউ-এর সাথে কোনো যোগসূত্র ছাড়া।',
      'সহায়ক ভোট: কোন রিভিউতে কে ভোট দিয়েছে।',
      'রিপোর্ট: কোন রিভিউ কেন রিপোর্ট হয়েছে — রিপোর্টকারীর পরিচয় ছাড়া।',
    ],
  },
  moderation: {
    heading: 'কনটেন্ট মডারেশন',
    paragraphs: [
      'রিভিউ জমা দেওয়ার সাথে সাথেই সরাসরি প্রকাশিত হয়। কিন্তু আপত্তিজনক শব্দ, বৈষম্যমূলক ভাষা বা ব্যক্তিগত অভিযোগ থাকলে স্বয়ংক্রিয়ভাবে আটকে দেওয়া হয়।',
      'যদি ৩ জন আলাদা ব্যবহারকারী একটি রিভিউ রিপোর্ট করেন, সেটি স্বয়ংক্রিয়ভাবে লুকানো হয় — অ্যাডমিন পর্যালোচনার আগ পর্যন্ত।',
      'কোনো রিভিউ লুকানো বা মুছে ফেলা হলে সেখানে স্বচ্ছতার জন্য একটি বার্তা দেখানো হয় — চুপিচুপি সরিয়ে ফেলা হয় না।',
    ],
  },
  contact: {
    heading: 'যোগাযোগ',
    paragraphs: ['বাগ, প্রস্তাবনা বা মডারেশন বিষয়ক প্রশ্নের জন্য GitHub-এ ইস্যু খুলুন।'],
  },
  lastUpdated: 'সর্বশেষ আপডেট: জুলাই ২০২৬',
}

export const ABOUT_EN: AboutContent = {
  title: 'About',
  mission: {
    heading: 'Mission',
    paragraphs: [
      'Poray Kemon is an anonymous platform where Bangladeshi university students can share their experiences with professors and courses. The goal: course selection should not depend on a handful of WhatsApp-group opinions but on real student experience, durably indexed and searchable.',
      'The name — "Poray Kemon" — is literally the question students already ask each other: "How does he/she teach?"',
    ],
  },
  anonymity: {
    heading: 'The anonymity contract',
    paragraphs: [
      'You sign in with Google to write a review, but your identity is never stored alongside what you wrote. Even if the database is fully compromised, no review can be traced back to its author.',
    ],
    bullets: [
      'The table holding review content has no user-identifying column at all — anonymity is structural, not policy-based.',
      'Whether an account has reviewed a given course lives in a separate table — it holds no review content and no reference back to any specific review.',
      'The two tables share no foreign key — a direct JOIN cannot re-pair them.',
      'They also use different kinds of identifiers (sequential on the content side, random UUIDs on the submission side), so lining them up by sorted id order does not work either.',
      'The submission table carries no per-row timestamp, so submissions cannot be matched to reviews by time.',
      'Your IP address is never stored anywhere in the system.',
      'Your Google email is never stored — only an opaque internal identifier.',
    ],
  },
  data: {
    heading: 'What we store',
    bullets: [
      'Reviews: ratings, tags, and your written text — without any user attribution.',
      "Account: only Google's internal ID (`sub`) and your display name. No email, no profile picture.",
      'Who reviewed which course: to prevent duplicates — but with no link to review content.',
      'Helpful votes: who voted on which review.',
      "Reports: which review was reported and why — without the reporter's identity.",
    ],
  },
  moderation: {
    heading: 'Content moderation',
    paragraphs: [
      'Reviews are published immediately. Content with profanity, slurs, or unsubstantiated personal accusations is auto-blocked before submission.',
      'If 3 distinct users report the same review, it is auto-hidden pending admin review.',
      'When a review is hidden or removed, a transparency notice is shown in its place — never a silent deletion.',
    ],
  },
  contact: {
    heading: 'Contact',
    paragraphs: ['For bugs, suggestions, or moderation concerns, open an issue on GitHub.'],
  },
  lastUpdated: 'Last updated: July 2026',
}
