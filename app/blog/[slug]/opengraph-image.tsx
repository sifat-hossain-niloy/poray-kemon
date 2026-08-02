import { ImageResponse } from 'next/og'
import { getPost } from '@/lib/blog/posts'

export const runtime = 'nodejs'
export const alt = 'Poray Kemon blog post'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

interface Props {
  params: Promise<{ slug: string }>
}

export default async function Image({ params }: Props) {
  const { slug } = await params
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
        <div style={{ fontSize: 26, fontWeight: 700 }}>Poray Kemon Blog</div>
      </div>

      <div
        style={{
          fontSize: title.length > 60 ? 56 : 68,
          fontWeight: 800,
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          maxWidth: 1080,
        }}
      >
        {title}
      </div>

      <div style={{ fontSize: 24, color: '#22d3ee', fontWeight: 600 }}>poraykemon.com/blog</div>
    </div>,
    { ...size },
  )
}
