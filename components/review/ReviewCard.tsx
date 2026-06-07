import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { HelpfulButton } from '@/components/review/HelpfulButton'
import { STRINGS } from '@/lib/strings'

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
  /** Did the currently authenticated viewer mark this one helpful? */
  userVoted?: boolean
}

const dateFormatter = new Intl.DateTimeFormat('bn-BD', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

export function ReviewCard({ review, userVoted = false }: Props) {
  // Moderation transparency — show a placeholder rather than the content
  if (review.moderationStatus === 'flagged_hidden' || review.moderationStatus === 'deleted') {
    return (
      <Card>
        <CardContent className="py-4 text-center text-sm italic text-muted-foreground">
          {STRINGS.moderation.removedNotice}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        {/* Top row — ratings summary */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <StarsInline value={review.teachingQuality} label={STRINGS.ratings.teachingQuality} />
          <StarsInline value={review.gradingFairness} label={STRINGS.ratings.gradingFairness} />
          <Badge variant={review.wouldRecommend ? 'default' : 'outline'} className="ml-auto">
            {review.wouldRecommend
              ? STRINGS.reviewDisplay.wouldRecommend
              : STRINGS.reviewDisplay.wouldNotRecommend}
          </Badge>
        </div>

        {/* Body text */}
        {review.reviewText ? (
          <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
            {review.reviewText}
          </p>
        ) : null}

        {/* Tags */}
        {review.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {review.tags.map((tag) => {
              const label = (STRINGS.tags as Record<string, string>)[tag] ?? tag
              return (
                <Badge key={tag} variant="secondary" className="text-[10px]">
                  {label}
                </Badge>
              )
            })}
          </div>
        ) : null}

        {/* Footer row — date + helpful */}
        <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
          <time dateTime={review.submittedAt.toISOString()}>
            {dateFormatter.format(review.submittedAt)}
          </time>
          <HelpfulButton
            reviewId={review.id}
            initialHelpfulCount={review.helpfulCount}
            initialVoted={userVoted}
          />
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
