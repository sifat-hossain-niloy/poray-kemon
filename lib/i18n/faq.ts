// FAQ copy — bilingual. The Q/A shape doubles as the source for FAQPage
// JSON-LD, so keep answers plain-text (no markdown, no HTML).

export interface FaqQA {
  question: string
  answer: string
}

export interface FaqContent {
  title: string
  intro: string
  lastUpdated: string
  items: FaqQA[]
}

export const FAQ_EN: FaqContent = {
  title: 'Frequently asked questions',
  intro:
    'Answers to the questions students ask most often before writing or reading reviews on Poray Kemon.',
  lastUpdated: 'Last updated: July 2026',
  items: [
    {
      question: 'Is Poray Kemon really anonymous?',
      answer:
        'Yes. Reviews are stored in a table that has no user-identifying column. A separate table tracks which account has reviewed which course, but it holds no review content and shares no key with the reviews table. The two tables also use different kinds of identifiers and the submission side stores no per-row timestamp, so nothing can be re-paired by id order, foreign key, or time. Even a full database dump cannot reveal who wrote any specific review.',
    },
    {
      question: 'Do I need an account to read reviews?',
      answer:
        'No. All public pages, including every professor page and every review, are readable without signing in. No cookie is set for anonymous readers.',
    },
    {
      question: 'Why do I have to sign in with Google to write a review?',
      answer:
        'Sign-in exists only to enforce one review per person per course. It is not stored with what you write. We never store your Google email, only an opaque internal identifier tied to your Google account.',
    },
    {
      question: 'Which universities can I review?',
      answer:
        'Any accredited Bangladeshi university. If yours is not listed, request it from the review form and an admin will add it. New departments can be added the same way.',
    },
    {
      question: 'Can I edit or delete my review later?',
      answer:
        'No. Because reviews are not linked to any user, we cannot look up "your" reviews to edit them. Write it carefully. If a review is factually wrong or violates guidelines, report it and a moderator will review.',
    },
    {
      question: 'What happens if I write something harmful or false?',
      answer:
        'Reviews with profanity, slurs, or unsubstantiated personal accusations are auto-blocked at submission. If three distinct users report the same review, it is auto-hidden until an admin reviews it. Removed reviews leave a transparency notice in place, never a silent deletion.',
    },
    {
      question: 'How are the star ratings on a professor computed?',
      answer:
        'Each professor-course pair keeps a running weighted average of teaching quality, grading fairness, course difficulty, and attendance strictness, plus a "would recommend" percentage. The overall score you see on a professor card combines these across all their courses, weighted by review count.',
    },
    {
      question: 'Why are professor names sometimes displayed with symbols?',
      answer:
        'On public pages we lightly obfuscate the English name (for example, "F@h!m Ar3f!n") as a defamation-safety measure. The full Bangla name is shown when available. Search still works on the real name.',
    },
    {
      question: 'Do you share data with the university or with anyone else?',
      answer:
        'No. Poray Kemon has no institutional relationship with any university and does not share data with anyone. Reviews are public because they are meant to help other students, but the identity of authors is not exposed to anyone, including us.',
    },
    {
      question: 'Is Poray Kemon a company?',
      answer:
        'No. It is a student-built project and there is no ad revenue, no paid tier, and no monetization. The name, "পড়ায় কেমন", is literally the question students already ask each other.',
    },
  ],
}

export const FAQ_BN: FaqContent = {
  title: 'সাধারণ জিজ্ঞাসা',
  intro: 'রিভিউ লেখা বা পড়ার আগে শিক্ষার্থীরা যে প্রশ্নগুলো সবচেয়ে বেশি করেন, তার উত্তর।',
  lastUpdated: 'সর্বশেষ আপডেট: জুলাই ২০২৬',
  items: [
    {
      question: 'পড়ায় কেমন কি সত্যিই বেনামী?',
      answer:
        'হ্যাঁ। যে টেবিলে রিভিউ রাখা হয় সেখানে ব্যবহারকারী চিহ্নিত করার কোনো কলাম নেই। কোন অ্যাকাউন্ট কোন কোর্সে রিভিউ দিয়েছে সেটি আলাদা একটি টেবিলে থাকে, যেখানে রিভিউয়ের কোনো লেখা বা রেফারেন্স নেই এবং দুই টেবিলের মধ্যে কোনো ফরেন কী যোগসূত্র নেই। দুই টেবিলের আইডিও ভিন্ন ধরনের এবং সাবমিশন টেবিলে কোনো টাইমস্ট্যাম্প রাখা হয় না, ফলে সময়, আইডি সাজিয়ে, বা যোগসূত্র ধরে মিলানোর কোনো উপায় নেই।',
    },
    {
      question: 'রিভিউ পড়তে কি অ্যাকাউন্ট লাগবে?',
      answer:
        'না। সব পাবলিক পেজ (প্রতিটি শিক্ষকের পেজ এবং প্রতিটি রিভিউ) লগইন ছাড়াই পড়া যায়। যারা শুধু পড়ছেন তাদের জন্য কোনো কুকিও সেট করা হয় না।',
    },
    {
      question: 'রিভিউ লিখতে Google দিয়ে সাইন ইন কেন লাগে?',
      answer:
        'সাইন ইন শুধু একটাই উদ্দেশ্যে: একজন যেন এক কোর্সে একবারই রিভিউ দিতে পারেন। আপনার লেখার সাথে এটি সংরক্ষিত হয় না। আপনার Google ইমেইল আমরা কখনো সংরক্ষণ করি না, শুধু একটি অভ্যন্তরীণ আইডেন্টিফায়ার।',
    },
    {
      question: 'কোন বিশ্ববিদ্যালয় নিয়ে রিভিউ দেওয়া যায়?',
      answer:
        'বাংলাদেশের যেকোনো স্বীকৃত বিশ্ববিদ্যালয়। আপনার বিশ্ববিদ্যালয় তালিকায় না থাকলে রিভিউ ফর্ম থেকে অনুরোধ পাঠান, অ্যাডমিন যোগ করে দেবে। নতুন বিভাগও একইভাবে যোগ করা যায়।',
    },
    {
      question: 'আমি কি পরে আমার রিভিউ এডিট বা ডিলিট করতে পারবো?',
      answer:
        'না। যেহেতু রিভিউ কোনো ব্যবহারকারীর সাথে লিঙ্কড না, "আপনার" রিভিউ খুঁজে বের করার কোনো উপায় নেই। তাই ভেবেচিন্তে লিখুন। কোনো রিভিউ ভুল তথ্য বা গাইডলাইন লঙ্ঘন করলে রিপোর্ট করুন, মডারেটর দেখবে।',
    },
    {
      question: 'অপমানজনক বা মিথ্যা কিছু লিখলে কী হয়?',
      answer:
        'গালিগালাজ, বৈষম্যমূলক ভাষা বা ব্যক্তিগত অভিযোগ থাকলে সাবমিশনের সময়ই স্বয়ংক্রিয়ভাবে আটকে দেওয়া হয়। ৩ জন আলাদা ব্যবহারকারী একটি রিভিউ রিপোর্ট করলে সেটি স্বয়ংক্রিয়ভাবে লুকানো হয়, অ্যাডমিন পর্যালোচনার আগ পর্যন্ত। রিভিউ সরানো হলে সেখানে স্বচ্ছতার জন্য একটি বার্তা দেখানো হয়, চুপিচুপি মুছে ফেলা হয় না।',
    },
    {
      question: 'শিক্ষকের রেটিং কীভাবে হিসাব করা হয়?',
      answer:
        'প্রতিটি শিক্ষক-কোর্স জোড়ার জন্য শিক্ষার মান, গ্রেডিং ফেয়ারনেস, কোর্স ডিফিকাল্টি ও উপস্থিতি নেওয়ার কড়াকড়ির চলমান ওয়েটেড গড় রাখা হয়, সাথে "সুপারিশ করবো" শতাংশ। শিক্ষকের কার্ডে যে ওভারঅল স্কোর দেখেন সেটি তাঁর সব কোর্সের গড়, রিভিউ সংখ্যার ভিত্তিতে ওজন করে।',
    },
    {
      question: 'শিক্ষকের ইংরেজি নাম মাঝে মাঝে সংশোধিত ভাবে দেখানো হয় কেন?',
      answer:
        'পাবলিক পেজে ইংরেজি নামটি হালকা ছদ্মবেশে দেখানো হয় (যেমন "F@h!m Ar3f!n"), মানহানির আশঙ্কা কমানোর জন্য। বাংলা নাম থাকলে সেটি সরাসরি দেখানো হয়। সার্চ কিন্তু আসল নামেই কাজ করে।',
    },
    {
      question: 'তথ্য কি বিশ্ববিদ্যালয় বা অন্য কারো সাথে শেয়ার করা হয়?',
      answer:
        'না। কোনো বিশ্ববিদ্যালয়ের সাথে পড়ায় কেমন-এর কোনো প্রাতিষ্ঠানিক সম্পর্ক নেই, এবং কারো সাথে কোনো তথ্য শেয়ার করা হয় না। রিভিউ পাবলিক কারণ সেটাই অন্য শিক্ষার্থীদের সাহায্য করার উদ্দেশ্য, কিন্তু লেখকের পরিচয় কারো কাছে (আমাদের কাছেও) প্রকাশ হয় না।',
    },
    {
      question: 'পড়ায় কেমন কি কোনো কোম্পানি?',
      answer:
        'না। এটি শিক্ষার্থীদের তৈরি একটি প্রজেক্ট। কোনো বিজ্ঞাপন নেই, পেইড টিয়ার নেই, মনিটাইজেশন নেই। নামটি ("পড়ায় কেমন") শিক্ষার্থীরা একে অপরকে যে প্রশ্নটি সবসময় করে, ঠিক সেটাই।',
    },
  ],
}
