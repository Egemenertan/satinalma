/** @type {import('next').NextConfig} */
const nextConfig = {
  // Server Actions are now stable in Next.js 14
  // experimental.serverActions is no longer needed
  
  // GÜVENLİK: Powered by header'ını kaldır
  poweredByHeader: false,
  
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  
  async headers() {
    // Güvenlik header'ları - Teams iframe desteği ile
    const securityHeaders = [
      {
        key: 'X-DNS-Prefetch-Control',
        value: 'on'
      },
      {
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload'
      },
      {
        key: 'X-Content-Type-Options',
        value: 'nosniff'
      },
      {
        key: 'Referrer-Policy',
        value: 'strict-origin-when-cross-origin'
      },
      {
        key: 'Permissions-Policy',
        value: 'camera=(), microphone=(), geolocation=()'
      },
      {
        key: 'X-Robots-Tag',
        value: 'noindex, nofollow, noarchive, nosnippet, noimageindex, nocache',
      },
      // Content Security Policy - Teams ve Outlook iframe desteği ile
      {
        key: 'Content-Security-Policy',
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://challenges.cloudflare.com https://appsforoffice.microsoft.com https://res.cdn.office.net https://statics.teams.cdn.office.net",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https://*.supabase.co https://*.microsoft.com",
          "font-src 'self' data:",
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://graph.microsoft.com https://login.microsoftonline.com https://*.office.com https://*.office365.com https://*.teams.microsoft.com https://*.outlook.com",
          "frame-src 'self' https://challenges.cloudflare.com https://*.office.com https://*.office365.com https://login.microsoftonline.com",
          "frame-ancestors *",
          "worker-src 'self' blob:",
        ].join('; ')
      }
    ];

    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/'
          }
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
