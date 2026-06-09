import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle so the production Docker image can
  // ship without the rest of node_modules. See Dockerfile (runner stage).
  output: 'standalone',

  // Production runtime hardening
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,

  // App-wide security headers — every response gets these unless a route
  // overrides them explicitly.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
