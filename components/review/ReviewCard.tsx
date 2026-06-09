'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { HelpfulButton } from '@/components/review/HelpfulButton'
import { ReportButton } from '@/components/review/ReportButton'
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

interface Props {
  review: ReviewCardData
  userVoted?: boolean
}

export function ReviewCard({ review, userVoted = false }: Props) {
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

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
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
    <span className="inline-flex items-center gap-1 text-muted-foreground" title={label}>
      <span className="text-yellow-500">{'★'.repeat(value)}</span>
      <span className="text-muted-foreground/40">{'★'.repeat(5 - value)}</span>
    </span>
  )
}
