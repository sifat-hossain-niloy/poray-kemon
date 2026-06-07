'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { STRINGS } from '@/lib/strings'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Department {
  id: number
  nameEn: string
  shortName: string | null
}

interface University {
  id: number
  nameEn: string
  shortName: string
  departments: Department[]
}

interface PreselectedProfessor {
  id: number
  nameEn: string
  universityId: number
  departmentId: number
}

interface Props {
  universities: University[]
  preselectedProfessor: PreselectedProfessor | null
  displayName: string
}

// Tags pulled from STRINGS.tags — single source of truth
const TAG_LABELS = STRINGS.tags
type TagKey = keyof typeof TAG_LABELS

const RATING_LABELS: {
  key: 'teaching_quality' | 'grading_fairness' | 'course_difficulty' | 'attendance_strictness'
  label: string
}[] = [
  { key: 'teaching_quality', label: STRINGS.review.teachingQualityLabel },
  { key: 'grading_fairness', label: STRINGS.review.gradingFairnessLabel },
  { key: 'course_difficulty', label: STRINGS.review.courseDifficultyLabel },
  { key: 'attendance_strictness', label: STRINGS.review.attendanceLabel },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function ReviewForm({ universities, preselectedProfessor, displayName }: Props) {
  const router = useRouter()

  // Professor / course
  const [universityId, setUniversityId] = useState<number | ''>(
    preselectedProfessor?.universityId ?? '',
  )
  const [departmentId, setDepartmentId] = useState<number | ''>(
    preselectedProfessor?.departmentId ?? '',
  )
  const [professorNameEn, setProfessorNameEn] = useState<string>(preselectedProfessor?.nameEn ?? '')
  const [professorId] = useState<number | null>(preselectedProfessor?.id ?? null)
  const [courseCode, setCourseCode] = useState('')
  const [courseName, setCourseName] = useState('')

  // Ratings
  const [teachingQuality, setTeachingQuality] = useState(0)
  const [gradingFairness, setGradingFairness] = useState(0)
  const [courseDifficulty, setCourseDifficulty] = useState(0)
  const [attendanceStrictness, setAttendanceStrictness] = useState(0)
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null)

  // Text + tags
  const [tags, setTags] = useState<TagKey[]>([])
  const [reviewText, setReviewText] = useState('')

  // Honeypot — hidden field; bots fill it, humans don't
  const [honeypot, setHoneypot] = useState('')

  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedUniversity = useMemo(
    () => universities.find((u) => u.id === universityId) ?? null,
    [universities, universityId],
  )

  const ratingState: Record<string, [number, (v: number) => void]> = {
    teaching_quality: [teachingQuality, setTeachingQuality],
    grading_fairness: [gradingFairness, setGradingFairness],
    course_difficulty: [courseDifficulty, setCourseDifficulty],
    attendance_strictness: [attendanceStrictness, setAttendanceStrictness],
  }

  function toggleTag(key: TagKey) {
    setTags((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  function validate(): string | null {
    if (!professorId) {
      if (!universityId) return 'বিশ্ববিদ্যালয় বেছে নিন'
      if (!departmentId) return 'বিভাগ বেছে নিন'
      if (!professorNameEn.trim()) return 'শিক্ষকের নাম দিন'
    }
    if (!courseName.trim()) return 'কোর্সের নাম দিন'
    if (!teachingQuality) return 'পড়ানোর মান রেট করুন'
    if (!gradingFairness) return 'নম্বরের ন্যায্যতা রেট করুন'
    if (!courseDifficulty) return 'কোর্সের কঠিনত্ব রেট করুন'
    if (!attendanceStrictness) return 'উপস্থিতির বাধ্যবাধকতা রেট করুন'
    if (wouldRecommend === null) return 'আবার নেবেন কিনা জানান'
    const text = reviewText.trim()
    if (text && text.length < 20) return 'রিভিউ কমপক্ষে ২০ অক্ষরের হতে হবে (বা খালি রাখুন)'
    return null
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        ...(professorId
          ? { professor_id: professorId }
          : {
              university_id: universityId || undefined,
              department_id: departmentId || undefined,
              professor_name_en: professorNameEn.trim(),
            }),
        course_code: courseCode.trim() || undefined,
        course_name: courseName.trim(),
        teaching_quality: teachingQuality,
        grading_fairness: gradingFairness,
        course_difficulty: courseDifficulty,
        attendance_strictness: attendanceStrictness,
        would_recommend: wouldRecommend,
        review_text: reviewText.trim() || undefined,
        tags,
        honeypot_field: honeypot,
      }

      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const body = (await res.json().catch(() => ({}))) as {
        error?: string
        professor_slug?: string
      }

      if (!res.ok) {
        setError(body.error ?? 'সাবমিশন ব্যর্থ হয়েছে')
        setSubmitting(false)
        return
      }

      // Success → bounce to the professor profile so they see their review counted
      if (body.professor_slug) {
        router.push(`/professors/${body.professor_slug}`)
      } else {
        router.push('/')
      }
      router.refresh()
    } catch (err) {
      console.error(err)
      setError(STRINGS.errors.serverError)
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* ── Identity (display only) ───────────────────────────────────────── */}
      <Card>
        <CardContent className="flex items-center justify-between gap-2 py-3 text-sm">
          <span className="text-muted-foreground">{STRINGS.auth.signedInAs(displayName)}</span>
          <Badge variant="secondary">{STRINGS.review.anonymityNote}</Badge>
        </CardContent>
      </Card>

      {/* ── Professor + course ────────────────────────────────────────────── */}
      <Section title="শিক্ষক ও কোর্স">
        {preselectedProfessor ? (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            শিক্ষক: <span className="font-semibold">{preselectedProfessor.nameEn}</span>
          </div>
        ) : (
          <>
            <Field label={`${STRINGS.review.selectUniversity} *`}>
              <select
                value={universityId}
                onChange={(e) => {
                  const v = e.target.value
                  setUniversityId(v ? Number(v) : '')
                  setDepartmentId('')
                }}
                className={selectClass}
                required
              >
                <option value="">— বেছে নিন —</option>
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.shortName} — {u.nameEn}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={`${STRINGS.review.selectDepartment} *`}>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : '')}
                disabled={!selectedUniversity}
                className={selectClass}
                required
              >
                <option value="">— বেছে নিন —</option>
                {selectedUniversity?.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.shortName ?? d.nameEn}
                  </option>
                ))}
              </select>
            </Field>

            <Field label={`${STRINGS.review.teacherNameLabel} *`}>
              <input
                type="text"
                value={professorNameEn}
                onChange={(e) => setProfessorNameEn(e.target.value)}
                placeholder="Dr. Mohammad Rahman"
                className={inputClass}
                required
              />
            </Field>
          </>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr]">
          <Field label={STRINGS.review.courseCodePlaceholder}>
            <input
              type="text"
              value={courseCode}
              onChange={(e) => setCourseCode(e.target.value)}
              placeholder="CSE 301"
              className={inputClass}
            />
          </Field>
          <Field label={`${STRINGS.review.courseNamePlaceholder} *`}>
            <input
              type="text"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              placeholder="Data Structures"
              className={inputClass}
              required
            />
          </Field>
        </div>
      </Section>

      {/* ── Ratings ───────────────────────────────────────────────────────── */}
      <Section title="রেটিং">
        <div className="space-y-4">
          {RATING_LABELS.map(({ key, label }) => {
            const [value, setter] = ratingState[key]!
            return <RatingRow key={key} label={`${label} *`} value={value} onChange={setter} />
          })}
        </div>

        <Field label={`${STRINGS.review.wouldRecommendLabel} *`}>
          <div className="flex gap-2">
            <RecommendButton
              active={wouldRecommend === true}
              onClick={() => setWouldRecommend(true)}
            >
              {STRINGS.review.wouldRecommendYes}
            </RecommendButton>
            <RecommendButton
              active={wouldRecommend === false}
              onClick={() => setWouldRecommend(false)}
            >
              {STRINGS.review.wouldRecommendNo}
            </RecommendButton>
          </div>
        </Field>
      </Section>

      {/* ── Tags ──────────────────────────────────────────────────────────── */}
      <Section title={STRINGS.review.tagsLabel}>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TAG_LABELS) as TagKey[]).map((key) => {
            const active = tags.includes(key)
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleTag(key)}
                className={
                  'rounded-full border px-3 py-1 text-sm transition-colors ' +
                  (active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:bg-muted')
                }
              >
                {TAG_LABELS[key]}
              </button>
            )
          })}
        </div>
      </Section>

      {/* ── Optional text ─────────────────────────────────────────────────── */}
      <Section title={STRINGS.review.reviewTextLabel}>
        <textarea
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          maxLength={500}
          rows={5}
          placeholder={STRINGS.review.reviewTextPlaceholder}
          className={inputClass + ' resize-none'}
        />
        <div className="mt-1 text-right text-xs text-muted-foreground">
          {STRINGS.review.maxChars(reviewText.length, 500)}
        </div>
      </Section>

      {/* ── Honeypot (hidden) ─────────────────────────────────────────────── */}
      <input
        type="text"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        name="email_confirm"
      />

      {/* ── Error + submit ────────────────────────────────────────────────── */}
      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <Button type="submit" size="lg" disabled={submitting} className="w-full">
        {submitting ? '...জমা দিচ্ছি' : STRINGS.review.submitButton}
      </Button>
    </form>
  )
}

// ── Small subcomponents ───────────────────────────────────────────────────────

const inputClass =
  'w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-50'

const selectClass = inputClass + ' cursor-pointer'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        {children}
      </CardContent>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            className="text-2xl leading-none transition-colors"
          >
            <span className={n <= value ? 'text-yellow-500' : 'text-muted-foreground/40'}>★</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function RecommendButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors ' +
        (active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-card text-foreground hover:bg-muted')
      }
    >
      {children}
    </button>
  )
}
