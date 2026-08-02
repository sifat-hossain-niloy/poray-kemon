import { ImageResponse } from 'next/og'
import { db } from '@/lib/db'
import { obfuscateName } from '@/lib/name-obfuscation'
import { isProfessorPublicId } from '@/lib/public-id'
import { combineProfessorStats } from '@/lib/professor-stats'
import { BrandMark, OG_COLORS, OG_SIZE, loadBrandFonts } from '@/lib/og/branding'

export const runtime = 'nodejs'
export const alt = 'Professor rating on Poray Kemon'
export const size = OG_SIZE
export const contentType = 'image/png'

interface Props {
  params: Promise<{ publicId: string }>
}

export default async function Image({ params }: Props) {
  const { publicId } = await params
  const fonts = await loadBrandFonts()
  const prof = await db.professor.findUnique({
    where: isProfessorPublicId(publicId) ? { publicId } : { slug: publicId },
    include: {
      university: { select: { shortName: true, nameEn: true } },
      department: { select: { shortName: true, nameEn: true } },
      professorCourses: {
        select: {
          reviewCount: true,
          avgTeachingQuality: true,
          avgGradingFairness: true,
          avgCourseDifficulty: true,
          avgAttendance: true,
          wouldRecommendPct: true,
          overallScore: true,
        },
      },
    },
  })

  if (!prof) return fallback(fonts)

  const combined = combineProfessorStats(
    prof.professorCourses.map((pc) => ({
      reviewCount: pc.reviewCount,
      avgTeachingQuality: pc.avgTeachingQuality ? Number(pc.avgTeachingQuality.toString()) : null,
      avgGradingFairness: pc.avgGradingFairness ? Number(pc.avgGradingFairness.toString()) : null,
      avgCourseDifficulty: pc.avgCourseDifficulty
        ? Number(pc.avgCourseDifficulty.toString())
        : null,
      avgAttendance: pc.avgAttendance ? Number(pc.avgAttendance.toString()) : null,
      wouldRecommendPct: pc.wouldRecommendPct ? Number(pc.wouldRecommendPct.toString()) : null,
      overallScore: pc.overallScore ? Number(pc.overallScore.toString()) : null,
    })),
  )

  const displayName = prof.nameBn ?? obfuscateName(prof.nameEn)
  const deptLabel = prof.department.shortName ?? prof.department.nameEn
  const rating = combined.overallScore
  const reviewCount = combined.totalReviews

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px',
        background: OG_COLORS.background,
        color: OG_COLORS.foreground,
        fontFamily: 'Hind Siliguri, sans-serif',
      }}
    >
      <BrandMark scale={0.85} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 22,
            fontWeight: 700,
            color: OG_COLORS.primary,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: OG_COLORS.primary,
            }}
          />
          <span>Professor review</span>
        </div>
        <div
          style={{
            fontSize: 80,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            maxWidth: 1000,
            color: OG_COLORS.foreground,
          }}
        >
          {displayName}
        </div>
        <div
          style={{
            fontSize: 36,
            color: OG_COLORS.muted,
            fontWeight: 500,
          }}
        >
          {`${deptLabel} · ${prof.university.shortName}`}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 24,
          borderTop: `1px solid ${OG_COLORS.border}`,
        }}
      >
        {rating !== null && reviewCount > 0 ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <div
              style={{
                fontSize: 88,
                fontWeight: 700,
                color: OG_COLORS.foreground,
                lineHeight: 1,
              }}
            >
              {rating.toFixed(1)}
            </div>
            <div style={{ fontSize: 30, color: OG_COLORS.muted }}>/ 5</div>
            <div
              style={{
                fontSize: 26,
                color: OG_COLORS.muted,
                marginLeft: 20,
              }}
            >
              {`${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}`}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 28, color: OG_COLORS.muted }}>Be the first to review</div>
        )}
        <div style={{ fontSize: 24, color: OG_COLORS.foreground, fontWeight: 700 }}>
          poraykemon.com
        </div>
      </div>
    </div>,
    { ...size, fonts },
  )
}

function fallback(fonts: Awaited<ReturnType<typeof loadBrandFonts>>): Response {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: OG_COLORS.background,
        color: OG_COLORS.foreground,
        fontSize: 64,
        fontWeight: 700,
        fontFamily: 'Hind Siliguri, sans-serif',
      }}
    >
      Poray Kemon
    </div>,
    { ...size, fonts },
  )
}
