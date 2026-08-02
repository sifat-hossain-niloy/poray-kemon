import { ImageResponse } from 'next/og'
import { db } from '@/lib/db'
import { obfuscateName } from '@/lib/name-obfuscation'
import { isProfessorPublicId } from '@/lib/public-id'
import { combineProfessorStats } from '@/lib/professor-stats'

export const runtime = 'nodejs'
export const alt = 'Professor rating on Poray Kemon'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface Props {
  params: Promise<{ publicId: string }>
}

export default async function Image({ params }: Props) {
  const { publicId } = await params
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

  if (!prof) return defaultFallback()

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

  const displayName = obfuscateName(prof.nameEn)
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
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0b1220 100%)',
        color: '#f8fafc',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #6366f1, #22d3ee)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            fontWeight: 800,
            color: '#0b1220',
          }}
        >
          PK
        </div>
        <div style={{ fontSize: 26, fontWeight: 700 }}>Poray Kemon</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div
          style={{
            fontSize: 26,
            color: '#22d3ee',
            fontWeight: 600,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
          }}
        >
          Professor review
        </div>
        <div
          style={{
            fontSize: 76,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            maxWidth: 1000,
          }}
        >
          {displayName}
        </div>
        <div style={{ fontSize: 34, color: '#cbd5e1', fontWeight: 500 }}>
          {`${deptLabel} · ${prof.university.shortName}`}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        {rating !== null && reviewCount > 0 ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <div style={{ fontSize: 96, fontWeight: 800, color: '#facc15', lineHeight: 1 }}>
              {rating.toFixed(1)}
            </div>
            <div style={{ fontSize: 32, color: '#94a3b8' }}>/ 5</div>
            <div style={{ fontSize: 26, color: '#cbd5e1', marginLeft: 20 }}>
              {`${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}`}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 28, color: '#cbd5e1' }}>Be the first to review</div>
        )}
        <div style={{ fontSize: 24, color: '#22d3ee', fontWeight: 600 }}>poraykemon.com</div>
      </div>
    </div>,
    { ...size },
  )
}

function defaultFallback() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f172a',
        color: '#f8fafc',
        fontSize: 64,
        fontWeight: 800,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      Poray Kemon
    </div>,
    { ...size },
  )
}
