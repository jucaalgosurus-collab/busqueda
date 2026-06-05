// app/robots.ts — robots.txt dinámico. El dossier es interno, no se debe indexar.
import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '/dossier';
  return {
    rules: [
      {
        userAgent: '*',
        disallow: '/',
      },
    ],
    // Sin sitemap — app privada.
  };
}
