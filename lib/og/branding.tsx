// Shared helpers for every opengraph-image / twitter-image route.
// The site is a light theme with a near-black primary — the tile with
// the Bengali letter "প" on a dark rounded square, then "Poray Kemon"
// as the wordmark. Keep OG images visually identical so previews feel
// like an extension of the site, not a separate asset.

export const OG_COLORS = {
  background: '#ffffff',
  foreground: '#0a0a0a',
  primary: '#171717',
  primaryForeground: '#fafafa',
  muted: '#737373',
  border: '#e5e5e5',
  accent: '#facc15',
} as const

export const OG_SIZE = { width: 1200, height: 630 } as const

// Fetch Hind Siliguri via Fontsource on jsDelivr — hosts the raw .woff
// files directly, no CSS unwrapping and no woff2 dance. Both Bengali and
// Latin subsets are loaded so the "প" tile and Latin text both render.
// Satori merges glyph coverage across font entries that share a family
// name, so both subsets register under 'Hind Siliguri'.
const FONT_BASE = 'https://cdn.jsdelivr.net/npm/@fontsource/hind-siliguri@5.0.0/files'

export async function loadBrandFonts() {
  const [latinBold, bengaliBold, latinMed, bengaliMed] = await Promise.all([
    fetchFont(`${FONT_BASE}/hind-siliguri-latin-700-normal.woff`),
    fetchFont(`${FONT_BASE}/hind-siliguri-bengali-700-normal.woff`),
    fetchFont(`${FONT_BASE}/hind-siliguri-latin-500-normal.woff`),
    fetchFont(`${FONT_BASE}/hind-siliguri-bengali-500-normal.woff`),
  ])
  return [
    { name: 'Hind Siliguri', data: latinBold, weight: 700 as const, style: 'normal' as const },
    { name: 'Hind Siliguri', data: bengaliBold, weight: 700 as const, style: 'normal' as const },
    { name: 'Hind Siliguri', data: latinMed, weight: 500 as const, style: 'normal' as const },
    { name: 'Hind Siliguri', data: bengaliMed, weight: 500 as const, style: 'normal' as const },
  ]
}

async function fetchFont(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Font fetch failed: ${url} ${res.status}`)
  return res.arrayBuffer()
}

// The wordmark block used across every OG image. Keeping this in one place
// so a logo tweak in the site auto-propagates to every share preview.
export function BrandMark({ scale = 1 }: { scale?: number }) {
  const tileSize = 64 * scale
  const fontSize = 40 * scale
  const nameSize = 36 * scale
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 * scale }}>
      <div
        style={{
          width: tileSize,
          height: tileSize,
          borderRadius: 14 * scale,
          background: OG_COLORS.primary,
          color: OG_COLORS.primaryForeground,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        প
      </div>
      <div
        style={{
          fontSize: nameSize,
          fontWeight: 700,
          color: OG_COLORS.foreground,
          letterSpacing: '-0.01em',
        }}
      >
        Poray Kemon
      </div>
    </div>
  )
}
