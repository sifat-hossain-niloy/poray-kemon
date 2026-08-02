import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Poray Kemon — anonymous professor reviews from Bangladesh students'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 45%, #0b1220 100%)',
        color: '#f8fafc',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #6366f1, #22d3ee)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            fontWeight: 800,
            color: '#0b1220',
          }}
        >
          PK
        </div>
        <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.01em' }}>Poray Kemon</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            maxWidth: 1000,
          }}
        >
          Anonymous professor reviews
        </div>
        <div
          style={{
            fontSize: 40,
            color: '#94a3b8',
            fontWeight: 500,
            maxWidth: 1000,
          }}
        >
          Real ratings from Bangladeshi university students.
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 26,
          color: '#cbd5e1',
        }}
      >
        <div>BUET · DU · NSU · BRAC · IUT · and every accredited BD university</div>
        <div style={{ color: '#22d3ee', fontWeight: 600 }}>poraykemon.com</div>
      </div>
    </div>,
    { ...size },
  )
}
