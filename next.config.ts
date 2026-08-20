import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: false,
  serverExternalPackages: ['pg', 'drizzle-orm', 'xlsx', 'jspdf'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
