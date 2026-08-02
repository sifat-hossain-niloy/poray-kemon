import { ImageResponse } from 'next/og'
import { db } from '@/lib/db'

export const runtime = 'nodejs'
export const alt = 'Department professor reviews on Poray Kemon'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface Props {
  params: Promise<{ slug: string; deptSlug: string }>
}

export default async function Image({ params }: Props) {
  const { slug, deptSlug } = await params
  const dept = await db.department.findFirst({
    where: { slug: deptSlug, university: { slug } },
    select: {
      nameEn: true,
      shortName: true,
      university: { select: { shortName: true, nameEn: true } },
      _count: { select: { professors: true } },
    },
  })

  if (!dept) {
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

  const deptLabel = dept.shortName ?? dept.nameEn

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
          Department
        </div>
        <div
          style={{
            fontSize: 80,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            maxWidth: 1000,
          }}
        >
          {deptLabel}
        </div>
        <div style={{ fontSize: 36, color: '#cbd5e1', fontWeight: 500 }}>
          {`${dept.university.shortName} · ${dept.university.nameEn}`}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          fontSize: 26,
          color: '#cbd5e1',
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ color: '#facc15', fontWeight: 700 }}>
            {String(dept._count.professors)}
          </span>
          <span>professors listed</span>
        </div>
        <div style={{ color: '#22d3ee', fontWeight: 600 }}>poraykemon.com</div>
      </div>
    </div>,
    { ...size },
  )
}
