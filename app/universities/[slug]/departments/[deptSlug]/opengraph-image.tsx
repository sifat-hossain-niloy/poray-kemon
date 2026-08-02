import { ImageResponse } from 'next/og'
import { db } from '@/lib/db'
import { BrandMark, OG_COLORS, OG_SIZE, loadBrandFonts } from '@/lib/og/branding'

export const runtime = 'nodejs'
export const alt = 'Department professor reviews on Poray Kemon'
export const size = OG_SIZE
export const contentType = 'image/png'

interface Props {
  params: Promise<{ slug: string; deptSlug: string }>
}

export default async function Image({ params }: Props) {
  const { slug, deptSlug } = await params
  const fonts = await loadBrandFonts()
  const dept = await db.department.findFirst({
    where: { slug: deptSlug, university: { slug } },
    select: {
      nameEn: true,
      shortName: true,
      university: { select: { shortName: true, nameEn: true } },
      _count: { select: { professors: true } },
    },
  })

  if (!dept) return fallback(fonts)

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
        background: OG_COLORS.background,
        color: OG_COLORS.foreground,
        fontFamily: 'Hind Siliguri, sans-serif',
      }}
    >
      <BrandMark scale={0.85} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
          <div style={{ width: 8, height: 8, borderRadius: 999, background: OG_COLORS.primary }} />
          <span>Department</span>
        </div>
        <div
          style={{
            fontSize: 84,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            maxWidth: 1000,
            color: OG_COLORS.foreground,
          }}
        >
          {deptLabel}
        </div>
        <div style={{ fontSize: 36, color: OG_COLORS.muted, fontWeight: 500 }}>
          {`${dept.university.shortName} · ${dept.university.nameEn}`}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 24,
          borderTop: `1px solid ${OG_COLORS.border}`,
          fontSize: 26,
          color: OG_COLORS.muted,
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ color: OG_COLORS.foreground, fontWeight: 700 }}>
            {String(dept._count.professors)}
          </span>
          <span>professors listed</span>
        </div>
        <div style={{ color: OG_COLORS.foreground, fontWeight: 700 }}>poraykemon.com</div>
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
