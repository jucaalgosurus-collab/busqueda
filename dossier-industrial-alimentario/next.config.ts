// next.config.ts — Next.js config con basePath /dossier
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '/dossier',
  output: 'standalone',
  reactStrictMode: true,
  // Hide powered-by header
  poweredByHeader: false,
  typescript: {
    // Permitir skip type-check en build si NEXT_IGNORE_TS=1
    // La validación de tipos se hace por tsc + smoke en CI.
    ignoreBuildErrors: process.env.NEXT_IGNORE_TS === '1',
  },
  experimental: {
    // Optimizations for production
  },
};

export default nextConfig;
