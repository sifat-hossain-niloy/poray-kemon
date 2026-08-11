'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { HelpfulButton } from '@/components/review/HelpfulButton'
import { ReportButton } from '@/components/review/ReportButton'
import { ShareButton } from '@/components/share/ShareButton'
import { LocaleLink as Link } from '@/components/i18n/LocaleLink'
import { obfuscateName } from '@/lib/name-obfuscation'
import { useLocale, useStrings } from '@/lib/i18n/client'

// Display data for one review. Note: NO user fields exist — by design.
export interface ReviewCardData {
  id: number
  teachingQuality: number
  gradingFairness: number
  courseDifficulty: number
  attendanceStrictness: number
  wouldRecommend: boolean
  reviewText: string | null
  tags: string[]
  helpfulCount: number
  submittedAt: Date
  moderationStatus: 'live' | 'soft_flagged' | 'flagged_hidden' | 'deleted'
}

// Context around a review. Everything optional so the professor page (which
// already displays uni/dept/professor in its own header) can keep passing
// bare cards, while the /reviews feed can pass the full lineage and get a
// self-contained card back.
export interface ReviewCardContext {
  professor?: { publicId: string; nameEn: string; nameBn?: string | null }
  university?: { shortName: string; slug: string }
  department?: { shortName: string | null; nameEn: string; slug: string | null }
  course?: { courseCode: string | null; courseName: string }
}

interface Props {
  review: ReviewCardData
  userVoted?: boolean
  /** Deprecated shorthand — prefer `context.professor.publicId`. Kept so
   *  existing callers on the professor page compile. */
  professorPublicId?: string
  context?: ReviewCardContext
}

export function ReviewCard({ review, userVoted = false, professorPublicId, context }: Props) {
  const strings = useStrings()
  const locale = useLocale()
  const dateFormatter = new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'bn-BD', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  if (review.moderationStatus === 'flagged_hidden' || review.moderationStatus === 'deleted') {
    return (
      <Card>
        <CardContent className="py-4 text-center text-sm italic text-muted-foreground">
          {strings.moderation.removedNotice}
        </CardContent>
      </Card>
    )
  }

  const tagLabels = strings.tags as Record<string, string>

  const effectiveProfessorPublicId = context?.professor?.publicId ?? professorPublicId ?? null
  const sharePath = effectiveProfessorPublicId
    ? `/professors/${effectiveProfessorPublicId}#r-${review.id}`
    : null

  const showLineage = context && (context.professor || context.university || context.department)

  return (
    <Card id={`r-${review.id}`} className="scroll-mt-20">
      <CardContent className="space-y-3 py-4">
        {/* ── Lineage row (only rendered when context is passed) ─────────── */}
        {showLineage ? (
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
            {context?.professor ? (
              <Link
                href={`/professors/${context.professor.publicId}`}
                className="font-semibold hover:underline"
              >
                {context.professor.nameBn ?? obfuscateName(context.professor.nameEn)}
              </Link>
            ) : null}
            <div className="flex flex-wrap items-center gap-1.5">
              {context?.university ? (
                <Link href={`/universities/${context.university.slug}`}>
                  <Badge variant="secondary" className="hover:bg-secondary/80">
                    {context.university.shortName}
                  </Badge>
                </Link>
              ) : null}
              {context?.department && context.department.slug && context.university ? (
                <Link
                  href={`/universities/${context.university.slug}/departments/${context.department.slug}`}
                >
                  <Badge variant="outline" className="hover:bg-muted">
                    {context.department.shortName ?? context.department.nameEn}
                  </Badge>
                </Link>
              ) : context?.department ? (
                <Badge variant="outline">
                  {context.department.shortName ?? context.department.nameEn}
                </Badge>
              ) : null}
              {context?.course ? (
                <span className="text-xs text-muted-foreground">
                  {context.course.courseCode
                    ? `${context.course.courseCode} · ${context.course.courseName}`
                    : context.course.courseName}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          <StarsInline value={review.teachingQuality} label={strings.ratings.teachingQuality} />
          <StarsInline value={review.gradingFairness} label={strings.ratings.gradingFairness} />
          <Badge variant={review.wouldRecommend ? 'default' : 'outline'} className="ml-auto">
            {review.wouldRecommend
              ? strings.reviewDisplay.wouldRecommend
              : strings.reviewDisplay.wouldNotRecommend}
          </Badge>
        </div>

        {review.reviewText ? (
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {review.reviewText}
          </p>
        ) : null}

        {review.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {review.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px]">
                {tagLabels[tag] ?? tag}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
          <time dateTime={review.submittedAt.toISOString()}>
            {dateFormatter.format(review.submittedAt)}
          </time>
          <div className="flex items-center gap-3">
            {sharePath ? (
              <ShareButton
                path={sharePath}
                title={strings.share.shareReview}
                text={review.reviewText ? review.reviewText.slice(0, 120) : undefined}
                ariaLabel={strings.share.shareReview}
              />
            ) : null}
            <ReportButton reviewId={review.id} />
            <HelpfulButton
              reviewId={review.id}
              initialHelpfulCount={review.helpfulCount}
              initialVoted={userVoted}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function StarsInline({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-muted-foreground">{label}:</span>
      <span aria-label={`${label} ${value} out of 5`}>
        <span className="text-yellow-500">{'★'.repeat(value)}</span>
        <span className="text-muted-foreground/40">{'★'.repeat(5 - value)}</span>
      </span>
    </span>
  )
}
