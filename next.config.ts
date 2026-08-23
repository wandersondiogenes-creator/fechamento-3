import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  distDir: 'dist',
  reactStrictMode: false,
  serverExternalPackages: ['pg', 'drizzle-orm'],
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
