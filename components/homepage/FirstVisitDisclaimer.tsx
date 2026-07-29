'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'pk_disclaimer_ack_v1'

interface Copy {
  title: string
  intro: string
  points: { heading: string; body: string }[]
  guidelinesLink: string
  guidelinesHint: string
  acknowledge: string
}

const EN: Copy = {
  title: 'Before you read (or write) anything',
  intro:
    'Poray Kemon exists to help students help each other. A few things worth knowing before you start.',
  points: [
    {
      heading: "Your identity isn't attached to any review.",
      body: "Reviews live in a separate table from the record that you reviewed a course. Even we can't tell who wrote what — it's not a policy, it's the database schema.",
    },
    {
      heading: "We don't verify individual reviews.",
      body: 'Ratings are opinions from anonymous students. Treat any single review as one data point, not a verdict.',
    },
    {
      heading: "We're not responsible for what people write.",
      body: 'We remove content that breaks our guidelines when we see it or when you report it — but until then, reviews reflect their authors, not us.',
    },
    {
      heading: 'Be respectful.',
      body: 'Criticize teaching, not people. No slurs, no accusations of criminality, no personal attacks. Keep it about the course.',
    },
  ],
  guidelinesLink: 'Read the full guidelines',
  guidelinesHint: 'Two-minute read. Worth it if you plan to write.',
  acknowledge: 'Got it — continue',
}

const BN: Copy = {
  title: 'পড়া বা লেখার আগে দেখে নিন',
  intro:
    'পড়ায় কেমন শিক্ষার্থীদের একে অপরকে সাহায্য করার জন্য। শুরু করার আগে কিছু কথা জেনে রাখা ভালো।',
  points: [
    {
      heading: 'রিভিউয়ের সাথে আপনার পরিচয় জোড়া থাকে না।',
      body: 'রিভিউ আর "কে কোন কোর্স রিভিউ করেছে" — এই দুই তথ্য আলাদা টেবিলে রাখা হয়। আমরা নিজেরাও মিলিয়ে দেখতে পারি না। এটা নীতি নয়, ডেটাবেস স্কিমা।',
    },
    {
      heading: 'প্রতিটি রিভিউ যাচাই করা হয় না।',
      body: 'রেটিং শিক্ষার্থীদের নিজস্ব মতামত। একটি রিভিউকে চূড়ান্ত রায় নয়, বরং একটি তথ্য হিসেবে দেখুন।',
    },
    {
      heading: 'রিভিউয়ের বিষয়বস্তুর জন্য আমরা দায়ী নই।',
      body: 'নিয়ম ভাঙা কনটেন্ট চোখে পড়লে বা রিপোর্ট এলে আমরা সরিয়ে দিই — কিন্তু ততক্ষণ পর্যন্ত রিভিউ লেখকের মতামত, আমাদের নয়।',
    },
    {
      heading: 'শ্রদ্ধাশীল থাকুন।',
      body: 'শিক্ষাদানের সমালোচনা করুন, ব্যক্তির নয়। গালি, অপরাধমূলক অভিযোগ বা ব্যক্তিগত আক্রমণ নয়। কোর্সের কথায় থাকুন।',
    },
  ],
  guidelinesLink: 'পূর্ণাঙ্গ নির্দেশিকা পড়ুন',
  guidelinesHint: 'দুই মিনিটের পড়া। লিখতে চাইলে দেখে নেওয়া ভালো।',
  acknowledge: 'বুঝেছি — চালিয়ে যাই',
}

export function FirstVisitDisclaimer({ locale }: { locale: 'en' | 'bn' }) {
  const [visible, setVisible] = useState(false)
  const copy = locale === 'en' ? EN : BN

  useEffect(() => {
    // SSR-safe: state starts false, effect reads localStorage after mount.
    // The setState-in-effect lint rule is intentional here — we can't read
    // localStorage during render (it doesn't exist on the server).
    let acked = false
    try {
      acked = window.localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      acked = false
    }
    if (!acked) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(true)
    }
  }, [])

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // ignore
    }
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pk-disclaimer-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-background border border-border shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 sm:p-7 space-y-5">
          <div className="space-y-2">
            <h2 id="pk-disclaimer-title" className="text-xl sm:text-2xl font-bold tracking-tight">
              {copy.title}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{copy.intro}</p>
          </div>

          <ul className="space-y-3">
            {copy.points.map((p) => (
              <li key={p.heading} className="rounded-lg border border-border bg-card p-3">
                <p className="text-sm font-semibold text-foreground">{p.heading}</p>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{p.body}</p>
              </li>
            ))}
          </ul>

          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            <Link
              href="/guidelines"
              className="font-medium text-primary hover:underline"
              onClick={dismiss}
            >
              {copy.guidelinesLink} →
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">{copy.guidelinesHint}</p>
          </div>

          <div className="flex justify-end">
            <Button onClick={dismiss} size="sm">
              {copy.acknowledge}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
