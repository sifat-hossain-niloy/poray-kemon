// ─────────────────────────────────────────────────────────────────────────────
// Privacy-policy copy (SRS §5.1 NFR-PRIV-08).
//
// Every statement here must stay true of the code. When you change what is
// stored (prisma/schema.prisma), which cookies are set (proxy.ts, lib/auth.ts,
// lib/admin-auth.ts), or which third parties are involved (app/layout.tsx,
// docs/deployment/), update this file in the same PR.
// ─────────────────────────────────────────────────────────────────────────────

export interface PrivacySection {
  heading: string
  paragraphs?: string[]
  bullets?: string[]
}

export interface PrivacyContent {
  title: string
  summary: string
  sections: PrivacySection[]
  lastUpdated: string
}

export const PRIVACY_EN: PrivacyContent = {
  title: 'Privacy policy',
  summary:
    'You need to sign in to write a review, but your review is anonymous and cannot be traced back to you. Not by other students, not by professors, and not by us. Reading the site needs no account and sets no tracking cookies.',
  sections: [
    {
      heading: 'If you only read',
      paragraphs: [
        'Browsing universities, professors and reviews requires no account. We do not set cookies on read-only visitors, and nothing we store identifies you.',
      ],
      bullets: [
        'Language preference: if you use the language toggle, we remember your choice in a `pk_lang` cookie. It holds only `bn` or `en`.',
        'First-visit notice: when you dismiss the welcome notice, your browser remembers that in local storage. It never leaves your device.',
        'Analytics: page views and page-load performance are counted in aggregate, without cookies and without building a profile of you.',
        'Our hosting provider necessarily sees your IP address to deliver pages. We never write IP addresses into our database.',
      ],
    },
    {
      heading: 'If you sign in',
      paragraphs: [
        'Sign-in is Google only. We use it so that each account can review a professor and course once, vote once per review, and report once per review. When you sign in, we store:',
      ],
      bullets: [
        'Your Google account identifier (`sub`), an opaque number that Google assigns.',
        'The display name Google provides. It is never shown on the site.',
        'The domain part of your email (for example `du.ac.bd`), used only to check whether you can review universities that limit reviews to their own students. The part before the `@` is discarded during sign-in and never stored.',
        'When your account was created and when you last signed in.',
        'A signed session cookie that keeps you signed in for up to 30 days.',
      ],
    },
    {
      heading: 'Your reviews are anonymous by construction',
      paragraphs: [
        'Anonymity is a property of the database design, not a promise about how we behave:',
      ],
      bullets: [
        'The table that stores review content has no column that refers to any account.',
        'A separate table records only that an account has reviewed a given professor and course, so duplicates can be blocked. It holds no review content and no reference to any review.',
        'The two tables share no key, use unrelated kinds of identifiers, and the submission table stores no timestamp. Nothing lines them up.',
      ],
    },
    {
      heading: 'Votes, reports and requests',
      bullets: [
        'Helpful votes are stored with your account so you can vote once and undo it.',
        'Reports are stored without any reference to who filed them. To stop duplicate reports, a temporary entry pairing your account with the reported review is kept in our cache for up to 30 days, then expires automatically.',
        'If you request a new university, the request is linked to your account so we can limit how many pending requests one account can file.',
      ],
    },
    {
      heading: 'Who else is involved',
      paragraphs: [
        'We do not sell data, show ads, or share anything with advertisers. The services that run the site are:',
      ],
      bullets: [
        'Google: sign-in only.',
        'Our hosting provider: runs the servers, database and cache, and processes data only to run the site.',
      ],
    },
    {
      heading: 'Keeping and deleting data',
      paragraphs: [
        'Account data is kept while your account exists. You can delete your account yourself at the bottom of this page. Deleting it removes its identifier, display name, email domain, review-submission records, helpful votes and university requests. Helpful counts on the reviews you voted for go down accordingly.',
        'Reviews are not deleted with the account. Because nothing links a review to its author, we cannot find "your" reviews to delete them, and neither can anyone else. A review can be removed through the report process if it breaks the guidelines.',
        'One thing is kept, so that deleting an account can’t be used to review the same course twice. For each professor and course the account had reviewed, we keep a one-way hash, made with a secret key, of your Google identifier combined with that professor and course. It stores no account, no course, no review and no date, so it cannot be matched to any review. Its only use: if you sign in again with the same Google account, you can’t review those same professors and courses again. Other courses are open as normal.',
        'Cache entries that stop duplicate reports are not removed early. They expire on their own within 30 days and refer to an account that no longer exists.',
        'If you can no longer sign in and want your account deleted, contact the maintainers through the project’s GitHub page. We will never ask for your review content to do it.',
      ],
    },
    {
      heading: 'Changes',
      paragraphs: [
        'If we change what we collect, we will update this page and the date below before the change goes live.',
      ],
    },
  ],
  lastUpdated: 'Last updated: October 2026',
}

export const PRIVACY_BN: PrivacyContent = {
  title: 'গোপনীয়তা নীতি',
  summary:
    'রিভিউ লিখতে সাইন ইন করতে হয়, কিন্তু আপনার রিভিউ বেনামী এবং আপনার কাছে ফিরে আসার কোনো উপায় নেই। অন্য শিক্ষার্থী, শিক্ষক, এমনকি আমরাও তা পারি না। শুধু পড়ার জন্য কোনো অ্যাকাউন্ট লাগে না এবং কোনো ট্র্যাকিং কুকি বসানো হয় না।',
  sections: [
    {
      heading: 'যদি শুধু পড়েন',
      paragraphs: [
        'বিশ্ববিদ্যালয়, শিক্ষক ও রিভিউ দেখতে কোনো অ্যাকাউন্ট লাগে না। শুধু পড়তে আসা ভিজিটরদের উপর আমরা কুকি বসাই না, এবং আপনাকে শনাক্ত করে এমন কিছু সংরক্ষণ করি না।',
      ],
      bullets: [
        'ভাষা: ভাষা পরিবর্তনের বোতাম ব্যবহার করলে আপনার পছন্দ একটি `pk_lang` কুকিতে মনে রাখা হয়। এতে শুধু `bn` বা `en` থাকে।',
        'প্রথম ভিজিটের নোটিশ: নোটিশটি বন্ধ করলে আপনার ব্রাউজার তা লোকাল স্টোরেজে মনে রাখে। এটি আপনার ডিভাইসের বাইরে যায় না।',
        'অ্যানালিটিক্স: কুকি ছাড়া মোট পেজ ভিউ ও লোডিং গতি গণনা করা হয়, আপনার কোনো প্রোফাইল তৈরি করা হয় না।',
        'পেজ পৌঁছে দিতে হোস্টিং প্রোভাইডারকে আপনার IP ঠিকানা দেখতে হয়। আমরা কখনো IP ঠিকানা আমাদের ডেটাবেসে লিখি না।',
      ],
    },
    {
      heading: 'যদি সাইন ইন করেন',
      paragraphs: [
        'সাইন ইন শুধু Google দিয়ে। এর উদ্দেশ্য: প্রতিটি অ্যাকাউন্ট একটি শিক্ষক ও কোর্সে একবার রিভিউ, প্রতি রিভিউতে একবার ভোট এবং একবার রিপোর্ট করতে পারবে। সাইন ইন করলে আমরা সংরক্ষণ করি:',
      ],
      bullets: [
        'আপনার Google অ্যাকাউন্ট আইডেন্টিফায়ার (`sub`), Google-এর দেওয়া একটি অস্বচ্ছ নম্বর।',
        'Google-এর দেওয়া প্রদর্শনের নাম। সাইটে এটি কখনো দেখানো হয় না।',
        'আপনার ইমেইলের ডোমেইন অংশ (যেমন `du.ac.bd`), শুধু এটা যাচাই করতে যে যেসব বিশ্ববিদ্যালয় কেবল নিজেদের শিক্ষার্থীদের রিভিউ নেয় সেখানে আপনি রিভিউ দিতে পারবেন কিনা। `@`-এর আগের অংশ সাইন ইনের সময়ই বাদ দেওয়া হয়, কখনো সংরক্ষণ হয় না।',
        'অ্যাকাউন্ট কবে তৈরি হয়েছে এবং শেষ কবে সাইন ইন করেছেন।',
        'একটি স্বাক্ষরিত সেশন কুকি, যা আপনাকে সর্বোচ্চ ৩০ দিন সাইন ইন রাখে।',
      ],
    },
    {
      heading: 'আপনার রিভিউ গঠনগতভাবেই বেনামী',
      paragraphs: ['বেনামীয়তা ডেটাবেসের নকশার বৈশিষ্ট্য, আমাদের আচরণের প্রতিশ্রুতি নয়:'],
      bullets: [
        'রিভিউয়ের লেখা যে টেবিলে থাকে সেখানে কোনো অ্যাকাউন্টের রেফারেন্স দেওয়ার মতো কলাম নেই।',
        'আলাদা একটি টেবিলে শুধু এটুকু থাকে যে একটি অ্যাকাউন্ট একটি শিক্ষক ও কোর্সে রিভিউ দিয়েছে, যাতে ডুপ্লিকেট আটকানো যায়। সেখানে রিভিউয়ের লেখা বা কোনো রিভিউয়ের রেফারেন্স নেই।',
        'দুই টেবিলে কোনো সাধারণ কী নেই, আইডির ধরনও আলাদা, আর সাবমিশন টেবিলে কোনো সময় সংরক্ষণ হয় না। মেলানোর কোনো সূত্র নেই।',
      ],
    },
    {
      heading: 'ভোট, রিপোর্ট ও অনুরোধ',
      bullets: [
        'সহায়ক ভোট আপনার অ্যাকাউন্টের সাথে সংরক্ষিত হয়, যাতে একবার ভোট দিতে ও তুলে নিতে পারেন।',
        'রিপোর্ট কে করেছে তার কোনো রেফারেন্স ছাড়াই সংরক্ষিত হয়। ডুপ্লিকেট রিপোর্ট আটকাতে আপনার অ্যাকাউন্ট ও রিপোর্ট করা রিভিউয়ের একটি অস্থায়ী এন্ট্রি আমাদের ক্যাশে সর্বোচ্চ ৩০ দিন থাকে, তারপর নিজে থেকেই মুছে যায়।',
        'নতুন বিশ্ববিদ্যালয়ের অনুরোধ করলে তা আপনার অ্যাকাউন্টের সাথে যুক্ত থাকে, যাতে একটি অ্যাকাউন্ট কতগুলো অনুরোধ জমা রাখতে পারবে তা সীমিত করা যায়।',
      ],
    },
    {
      heading: 'আর কারা জড়িত',
      paragraphs: [
        'আমরা কোনো ডেটা বিক্রি করি না, বিজ্ঞাপন দেখাই না, বিজ্ঞাপনদাতাদের সাথে কিছু শেয়ার করি না। সাইট চালাতে যেসব সেবা ব্যবহার হয়:',
      ],
      bullets: [
        'Google: শুধু সাইন ইন।',
        'আমাদের হোস্টিং প্রোভাইডার: সার্ভার, ডেটাবেস ও ক্যাশ চালায়, এবং শুধু সাইট চালানোর জন্যই ডেটা প্রসেস করে।',
      ],
    },
    {
      heading: 'ডেটা রাখা ও মুছে ফেলা',
      paragraphs: [
        'অ্যাকাউন্ট যতদিন আছে, অ্যাকাউন্টের ডেটা ততদিন থাকে। এই পেজের নিচ থেকে আপনি নিজেই অ্যাকাউন্ট মুছে ফেলতে পারেন। অ্যাকাউন্ট মুছলে তার আইডেন্টিফায়ার, প্রদর্শনের নাম, ইমেইল ডোমেইন, রিভিউ-সাবমিশনের রেকর্ড, সহায়ক ভোট এবং বিশ্ববিদ্যালয়ের অনুরোধ মুছে যায়। আপনি যেসব রিভিউতে সহায়ক ভোট দিয়েছিলেন, সেগুলোর ভোট সংখ্যাও সেই অনুযায়ী কমে যায়।',
        'অ্যাকাউন্টের সাথে রিভিউ মোছে না। কোনো রিভিউ লেখকের সাথে যুক্ত না থাকায় "আপনার" রিভিউ খুঁজে বের করে মোছা আমাদের পক্ষে সম্ভব নয়, অন্য কারো পক্ষেও নয়। নির্দেশিকা ভাঙলে রিপোর্ট প্রক্রিয়ার মাধ্যমে রিভিউ সরানো যায়।',
        'অ্যাকাউন্ট মুছে একই কোর্সে দ্বিতীয়বার রিভিউ দেওয়া যাতে না যায়, সেজন্য একটি জিনিস রাখা হয়। অ্যাকাউন্টটি যেসব শিক্ষক ও কোর্সে রিভিউ দিয়েছিল, তার প্রতিটির জন্য আপনার Google আইডেন্টিফায়ার ও সেই শিক্ষক-কোর্স মিলিয়ে, একটি গোপন চাবি দিয়ে তৈরি একমুখী হ্যাশ রাখা হয়। এতে কোনো অ্যাকাউন্ট, কোর্স, রিভিউ বা তারিখ থাকে না, তাই কোনো রিভিউয়ের সাথে মেলানো যায় না। এর একমাত্র কাজ: একই Google অ্যাকাউন্ট দিয়ে আবার সাইন ইন করলে আগের ওই শিক্ষক ও কোর্সগুলোতে আবার রিভিউ দেওয়া যাবে না। অন্য কোর্সে স্বাভাবিকভাবেই দেওয়া যাবে।',
        'ডুপ্লিকেট রিপোর্ট আটকানোর ক্যাশ এন্ট্রিগুলো আগেভাগে মোছা হয় না। সেগুলো ৩০ দিনের মধ্যে নিজে থেকেই মুছে যায় এবং এমন একটি অ্যাকাউন্টকে নির্দেশ করে যার আর অস্তিত্ব নেই।',
        'আর সাইন ইন করতে না পারলে এবং অ্যাকাউন্ট মুছতে চাইলে প্রজেক্টের GitHub পেজের মাধ্যমে মেইনটেইনারদের সাথে যোগাযোগ করুন। এর জন্য আমরা কখনো আপনার রিভিউয়ের লেখা চাইব না।',
      ],
    },
    {
      heading: 'পরিবর্তন',
      paragraphs: [
        'আমরা কী সংগ্রহ করি তা বদলালে, পরিবর্তন চালু হওয়ার আগেই এই পেজ ও নিচের তারিখ হালনাগাদ করব।',
      ],
    },
  ],
  lastUpdated: 'সর্বশেষ আপডেট: অক্টোবর ২০২৬',
}
