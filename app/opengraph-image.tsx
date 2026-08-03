import { ImageResponse } from 'next/og'
import { BrandMark, OG_COLORS, OG_SIZE, loadBrandFonts } from '@/lib/og/branding'

export const runtime = 'nodejs'
export const alt = 'Poray Kemon — anonymous professor reviews from Bangladesh students'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image() {
  const fonts = await loadBrandFonts()
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px',
        background: OG_COLORS.background,
        color: OG_COLORS.foreground,
        fontFamily: 'Hind Siliguri, sans-serif',
      }}
    >
      <BrandMark scale={1} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            maxWidth: 1000,
            color: OG_COLORS.foreground,
          }}
        >
          পড়ায় কেমন
        </div>
        <div
          style={{
            fontSize: 44,
            fontWeight: 500,
            color: OG_COLORS.muted,
            maxWidth: 1000,
            lineHeight: 1.2,
          }}
        >
          Anonymous professor and course reviews from Bangladeshi students.
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
        <div>BUET · DU · NSU · BRAC · IUT · every accredited BD university</div>
        <div style={{ color: OG_COLORS.foreground, fontWeight: 700 }}>poraykemon.com</div>
      </div>
    </div>,
    { ...size, fonts },
  )
}
