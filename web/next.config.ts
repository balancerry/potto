import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Allow LAN testing (phone / other devices on Wi‑Fi). Prefer http://localhost:3000 for auth.
  allowedDevOrigins: ['192.168.0.110', '127.0.0.1'],
  async headers() {
    return [
      {
        // Public share links are bearer secrets and can be revoked at any moment: never cache
        // them, never leak them through Referer, never let search engines index them.
        source: '/pot/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
    ];
  },
};

export default nextConfig;
