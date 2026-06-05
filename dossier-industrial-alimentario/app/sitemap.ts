// app/sitemap.ts — sitemap mínimo. App privada: solo se indexa el root 404/redirect.
import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '/dossier';
  return [
    {
      url: `${base}/`,
      lastModified: new Date(),
      changeFrequency: 'never',
      priority: 0,
    },
  ];
}
