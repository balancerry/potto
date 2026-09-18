import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Allow LAN testing (phone / other devices on Wi‑Fi). Prefer http://localhost:3000 for auth.
  allowedDevOrigins: ['192.168.0.110', '127.0.0.1'],
};

export default nextConfig;
