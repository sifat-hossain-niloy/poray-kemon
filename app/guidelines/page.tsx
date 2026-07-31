import type { Metadata } from 'next'
import { LocaleLink as Link } from '@/components/i18n/LocaleLink'
import { getLocale } from '@/lib/i18n'

export const metadata: Metadata = {
  title: 'Community guidelines',
  description:
    'How Poray Kemon keeps reviews honest and respectful, what to write, what to avoid, and what we remove.',
}

export default async function GuidelinesPage() {
  const locale = await getLocale()
  const copy = locale === 'en' ? EN : BN

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-10 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">
          {copy.eyebrow}
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{copy.title}</h1>
        <p className="text-base text-muted-foreground leading-relaxed">{copy.lead}</p>
      </div>

      {copy.sections.map((section) => (
        <section key={section.title} className="mb-8">
          <h2 className="text-xl font-semibold tracking-tight mb-3">{section.title}</h2>
          <div className="space-y-3 text-sm sm:text-base text-foreground leading-relaxed">
            {section.paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            {section.list ? (
              <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
                {section.list.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ))}

      <section className="mb-8 rounded-xl border border-border bg-muted/40 p-5">
        <h2 className="text-xl font-semibold tracking-tight mb-2">{copy.reportTitle}</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">{copy.reportBody}</p>
      </section>

      <div className="mt-12 border-t border-border pt-6">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          {copy.backHome}
        </Link>
      </div>
    </main>
  )
}

interface GuidelinesCopy {
  eyebrow: string
  title: string
  lead: string
  sections: {
    title: string
    paragraphs: string[]
    list?: string[]
  }[]
  reportTitle: string
  reportBody: string
  backHome: string
}

const EN: GuidelinesCopy = {
  eyebrow: 'Community guidelines',
  title: 'Write like a student, not a stranger on the internet',
  lead: 'Poray Kemon works because the reviews are useful and fair. Here is what we expect, what we will remove, and what we cannot promise.',
  sections: [
    {
      title: 'What reviews are for',
      paragraphs: [
        'Reviews are meant to help the next batch of students decide whether to take a course with a specific professor. That means the useful signal is your experience of the class, teaching style, how grading felt, how difficult the material was, whether attendance mattered.',
      ],
      list: [
        'Focus on the course, not the person.',
        'Be specific: "explains from examples" beats "great teacher".',
        'Be fair. One bad exam is a data point, not a verdict.',
        'Skip anything that could identify you (your section, your grade, unique classroom incidents).',
      ],
    },
    {
      title: 'What we remove',
      paragraphs: [
        'We remove content that breaks the rules below, whether we notice it during moderation or you report it. We do not remove reviews just because they are negative. A low rating with a real reason is exactly the point of the site.',
      ],
      list: [
        'Profanity, slurs, or discriminatory language of any kind.',
        'Accusations of criminal behavior (harassment, corruption, favoritism as bribery). Report these to your institution. They belong in a formal process, not a review.',
        'Personal attacks: comments on appearance, religion, family, sexuality, disability.',
        'Content that identifies a specific student ("the girl in the second row who…"). This makes the platform unsafe for students to write on.',
        'Off-topic rants, ads, spam, or content clearly not written by a student who took the course.',
      ],
    },
    {
      title: "What we're not responsible for",
      paragraphs: [
        'Reviews on Poray Kemon are opinions of anonymous students. We are a platform for those opinions. We are not the ones expressing them. We do not verify individual reviews before publishing, and one review from one student is one data point, not a judgment we endorse.',
        'If a review breaks our rules, we remove it. If a professor believes a review is defamatory or false, they can email us and we will review the specific claim under our policy. But the platform existing does not mean we agree with any given post.',
      ],
    },
    {
      title: 'Your anonymity, plainly',
      paragraphs: [
        'The reviews table in our database has no user_id column and no relation back to any user record. There is a separate ledger that records the fact that you reviewed a course (to prevent duplicates), but it stores no rating, no text, and shares no id with your review row. Even we cannot join the two.',
        "We use Google sign-in only to detect duplicates; we do not store your email, and we never see it. Google itself knows you signed in, we can't defend against that, but nothing in our database can be used to link you to what you wrote.",
      ],
    },
    {
      title: 'A quick word on tone',
      paragraphs: [
        'Bangladeshi academia is small. The professor you review may one day be your recommender, a colleague, or the person on the other side of a job interview. Write things you would still stand by if the anonymity were removed, not because it can be, but because that is the standard of a real critique.',
      ],
    },
  ],
  reportTitle: 'See something off?',
  reportBody:
    'Every review has a Report button. Use it, that is how content that breaks these rules reaches us. We read every report and either resolve or remove; if you tell us how it broke the rules, we act faster.',
  backHome: '← Back to home',
}

const BN: GuidelinesCopy = {
  eyebrow: 'কমিউনিটি নির্দেশিকা',
  title: 'শিক্ষার্থীর মতো লিখুন, অচেনা কারো মতো নয়',
  lead: 'পড়ায় কেমন কাজ করে কারণ রিভিউগুলো ন্যায্য ও কাজে লাগার মতো। আমরা কী প্রত্যাশা করি, কী সরিয়ে দিই, আর কী নিশ্চিত করতে পারি না, সব একজায়গায়।',
  sections: [
    {
      title: 'রিভিউ কী কাজে আসে',
      paragraphs: [
        'রিভিউয়ের কাজ পরবর্তী ব্যাচকে সাহায্য করা, একজন নির্দিষ্ট শিক্ষকের সাথে কোনো কোর্স নেবে কি না সেটা বুঝতে। তাই কাজের তথ্য হলো ক্লাসের অভিজ্ঞতা, পড়ানোর ধরন, নম্বর দেওয়ার অনুভূতি, বিষয়ের কঠিনতা, উপস্থিতির গুরুত্ব।',
      ],
      list: [
        'ব্যক্তির কথা নয়, কোর্সের কথা লিখুন।',
        'নির্দিষ্ট হন, "উদাহরণ দিয়ে বোঝান" > "খুব ভালো শিক্ষক"।',
        'ন্যায্য হন, একটি খারাপ পরীক্ষা একটি তথ্য, চূড়ান্ত রায় নয়।',
        'নিজেকে চিহ্নিত করে এমন কিছু বাদ দিন (সেকশন, নিজের গ্রেড, শ্রেণিকক্ষের বিশেষ ঘটনা)।',
      ],
    },
    {
      title: 'আমরা কী সরাই',
      paragraphs: [
        'নিচের নিয়ম ভাঙা কনটেন্ট আমরা সরাই, মডারেশনে চোখে পড়ুক বা আপনি রিপোর্ট করুন। নেতিবাচক হলে সরানো হয় না, সঠিক কারণ সহ নিম্ন রেটিংই তো সাইটটির উদ্দেশ্য।',
      ],
      list: [
        'গালি, বৈষম্যমূলক ভাষা বা কোনো ধরনের অপমানসূচক শব্দ।',
        'অপরাধমূলক অভিযোগ (হয়রানি, দুর্নীতি, ঘুষ হিসেবে পক্ষপাত)। এগুলো প্রতিষ্ঠানের আনুষ্ঠানিক প্রক্রিয়ায় জানান, রিভিউয়ে নয়।',
        'ব্যক্তিগত আক্রমণ: চেহারা, ধর্ম, পরিবার, যৌনতা, শারীরিক অক্ষমতা নিয়ে মন্তব্য।',
        'নির্দিষ্ট শিক্ষার্থীকে চিহ্নিত করা কনটেন্ট ("দ্বিতীয় সারির মেয়েটা যিনি…"), এতে অন্যদের লেখা অনিরাপদ হয়ে ওঠে।',
        'অপ্রাসঙ্গিক ক্ষোভ, বিজ্ঞাপন, স্প্যাম, বা এমন কনটেন্ট যা স্পষ্টত কোর্স-নেওয়া শিক্ষার্থীর নয়।',
      ],
    },
    {
      title: 'যেসব বিষয়ের দায় আমাদের নয়',
      paragraphs: [
        'পড়ায় কেমনে রিভিউগুলো বেনামী শিক্ষার্থীদের মতামত। আমরা সেই মতামতের প্ল্যাটফর্ম, মতামত আমাদের নয়। প্রকাশের আগে প্রতিটি রিভিউ যাচাই করা হয় না; একজন শিক্ষার্থীর একটি রিভিউ একটি তথ্য, আমাদের অনুমোদিত রায় নয়।',
        'কোনো রিভিউ যদি নিয়ম ভাঙে, আমরা সরাই। কোনো শিক্ষক যদি মনে করেন কোনো রিভিউ মিথ্যা বা মানহানিকর, ইমেইলে জানালে নির্দিষ্ট দাবি আমাদের নীতি অনুযায়ী দেখা হবে। প্ল্যাটফর্মে পোস্ট থাকা মানে আমরা সেটার সাথে সহমত, এমন নয়।',
      ],
    },
    {
      title: 'বেনামিত্ব, সরাসরি কথা',
      paragraphs: [
        'আমাদের ডেটাবেসের reviews টেবিলে কোনো user_id কলাম নেই, ইউজার রেকর্ডের সাথে কোনো সম্পর্কও নেই। আপনি একটি কোর্স রিভিউ করেছেন, এটা আলাদা লেজারে রাখা হয় (ডুপ্লিকেট ঠেকাতে), কিন্তু সেখানে রেটিং, টেক্সট বা রিভিউয়ের সাথে মেলানোর মতো কোনো আইডি নেই। আমরা নিজেরাও দুটোকে জোড়া লাগাতে পারি না।',
        'Google সাইন-ইন ব্যবহার করি শুধু ডুপ্লিকেট চেনার জন্য; ইমেইল সংরক্ষণ করি না, দেখতেও পাই না। আপনি সাইন-ইন করেছেন, এটা Google-এর কাছে থাকে, সেটার বিরুদ্ধে আমরা কিছু করতে পারি না। কিন্তু আমাদের ডেটাবেসে আপনার লেখা রিভিউয়ের সাথে আপনাকে জোড়ার মতো কোনো তথ্য নেই।',
      ],
    },
    {
      title: 'সুরের প্রসঙ্গে',
      paragraphs: [
        'বাংলাদেশি একাডেমিয়া ছোট। যে শিক্ষককে আজ রিভিউ দিচ্ছেন তিনি হয়তো একদিন আপনার রেফারেন্স, সহকর্মী, বা চাকরির ইন্টারভিউয়ের অন্যপাশে থাকবেন। এমনভাবে লিখুন যা বেনামিত্ব সরিয়ে দিলেও আপনি সমর্থন করতে পারবেন, কারণ ওটাই আসল সমালোচনার মান।',
      ],
    },
  ],
  reportTitle: 'কিছু চোখে খটকা লাগছে?',
  reportBody:
    'প্রতিটি রিভিউয়ের নিচে একটি Report বাটন আছে। ব্যবহার করুন, নিয়মভঙ্গী কনটেন্ট আমাদের কাছে এভাবেই পৌঁছায়। প্রতিটি রিপোর্ট পড়া হয়; কোন নিয়ম ভেঙেছে জানালে আরও দ্রুত ব্যবস্থা নেওয়া যায়।',
  backHome: '← হোমে ফিরে যান',
}
