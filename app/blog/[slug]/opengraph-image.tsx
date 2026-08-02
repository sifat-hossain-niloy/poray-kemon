import { ImageResponse } from 'next/og'
import { getPost } from '@/lib/blog/posts'
import { BrandMark, OG_COLORS, OG_SIZE, loadBrandFonts } from '@/lib/og/branding'

export const runtime = 'nodejs'
export const alt = 'Poray Kemon blog post'
export const size = OG_SIZE
export const contentType = 'image/png'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function Image({ params }: Props) {
  const { slug } = await params
  const fonts = await loadBrandFonts()
  const post = getPost(slug)
  const title = post?.title ?? 'Poray Kemon Blog'

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
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
          <span>Blog</span>
        </div>
        <div
          style={{
            fontSize: title.length > 60 ? 60 : 72,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            maxWidth: 1080,
            color: OG_COLORS.foreground,
          }}
        >
          {title}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 24,
          borderTop: `1px solid ${OG_COLORS.border}`,
          fontSize: 24,
          color: OG_COLORS.muted,
        }}
      >
        <div>poraykemon.com/blog</div>
        <div style={{ color: OG_COLORS.foreground, fontWeight: 700 }}>Poray Kemon</div>
      </div>
    </div>,
    { ...size, fonts },
  )
}
