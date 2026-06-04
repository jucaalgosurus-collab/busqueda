// lib/utils/admin-fetch.ts — helper para fetches autenticados al panel admin
//
// Centraliza el envío del header `x-admin-secret` desde localStorage.
// Usar este helper en TODOS los componentes cliente del panel.
'use client';

import { basePath } from './base-path';

export function adminHeaders(): HeadersInit {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  if (typeof window !== 'undefined') {
    const secret = window.localStorage.getItem('admin-secret');
    if (secret) h['x-admin-secret'] = secret;
  }
  return h;
}

export async function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = path.startsWith('http') ? path : `${basePath()}${path}`;
  return fetch(url, {
    ...init,
    headers: { ...adminHeaders(), ...(init.headers as Record<string, string> | undefined) },
  });
}
