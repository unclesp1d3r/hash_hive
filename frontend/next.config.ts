import type { NextConfig } from 'next';

const API_BASE_URL_DEFAULT = 'http://localhost:3001';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    API_BASE_URL: process.env['API_BASE_URL'] ?? API_BASE_URL_DEFAULT,
  },
  rewrites() {
    const baseUrl = process.env['API_BASE_URL'] ?? API_BASE_URL_DEFAULT;
    return [
      {
        source: '/api/:path*',
        destination: `${baseUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
