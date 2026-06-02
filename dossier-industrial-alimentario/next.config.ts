// next.config.ts — Next.js config con basePath /dossier
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '/dossier',
  output: 'standalone',
  reactStrictMode: true,
  // Hide powered-by header
  poweredByHeader: false,
  experimental: {
    // Optimizations for production
  },
};

export default nextConfig;
