// app/icon.tsx — favicon dinámico de HERMES (Next.js convention)
import { ImageResponse } from 'next/og';

export const size = { width: 64, height: 64 };
export const contentType = 'image/svg+xml';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 44,
          background: '#0a1828',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#7ad7f0',
          fontWeight: 800,
          borderRadius: 8,
        }}
      >
        H
      </div>
    ),
    { ...size }
  );
}
