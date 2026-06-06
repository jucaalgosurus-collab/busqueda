'use client';
// app/admin/surus/_components/SecretMenuTrigger.tsx — Trigger discreto "Surus" en header
// Sprint HIDDEN-1 — Solo visible para Surus, no en navegación pública
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { basePath } from '@/lib/utils/base-path';

const TRIGGER_TEXT = '·';
const TARGET_PATH = '/admin/surus';

export function SecretMenuTrigger() {
  const router = useRouter();
  const [pressed, setPressed] = useState(false);

  const handleClick = () => {
    setPressed(true);
    setTimeout(() => setPressed(false), 200);
    router.push(basePath() + TARGET_PATH);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Acceso interno Surus"
      title="Acceso interno"
      style={{
        background: 'transparent',
        border: 'none',
        padding: '0 var(--space-2)',
        marginLeft: 'var(--space-2)',
        color: pressed
          ? 'var(--surus-text-soft, #475569)'
          : 'transparent',
        fontSize: 'var(--text-xs)',
        cursor: 'pointer',
        userSelect: 'none',
        transition: 'color 120ms ease',
      }}
    >
      {TRIGGER_TEXT}
    </button>
  );
}
