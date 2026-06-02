// lib/utils/base-path.ts
// Helper para Next.js basePath configurado en next.config.ts
export const basePath = (): string => {
  return process.env.NEXT_PUBLIC_BASE_PATH || '/dossier';
};
