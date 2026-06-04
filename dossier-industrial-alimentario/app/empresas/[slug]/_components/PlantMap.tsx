// app/empresas/[slug]/_components/PlantMap.tsx — Mapa España interactivo (SVG)
// Pin coloreado por status. Sin librerías externas. Click → scroll a planta.
import type { Plant } from '@prisma/client';
import { statusColorVar, statusLabel } from '../_lib/types';

type Props = { plants: Plant[]; slug: string };

// Proyección simple equirectangular para España peninsular + Canarias (compensada)
// lon ∈ [-9.5, 4.5], lat ∈ [27.5, 44]
// viewBox 1000x680 → España aproximadamente ocupa 850x540
const VIEW_W = 1000;
const VIEW_H = 680;
const LON_MIN = -10;
const LON_MAX = 5;
const LAT_MIN = 27;
const LAT_MAX = 45;

function project(lng: number, lat: number): { x: number; y: number } {
  const x = ((lng - LON_MIN) / (LON_MAX - LON_MIN)) * VIEW_W;
  const y = VIEW_H - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * VIEW_H;
  return { x, y };
}

// Silueta simplificada de España peninsular + Baleares + Canarias (path aproximado)
const SPAIN_PATH = `
M 195 245
C 215 215, 245 200, 275 195
L 320 185
C 350 180, 380 175, 410 180
L 440 175
C 470 170, 500 180, 525 195
L 555 200
C 580 200, 605 210, 625 225
L 650 240
C 670 250, 685 265, 690 285
L 695 305
C 700 325, 695 345, 685 360
L 670 380
C 660 395, 645 405, 625 410
L 605 420
C 580 425, 555 425, 530 420
L 505 415
C 480 420, 455 425, 430 420
L 405 415
C 380 410, 355 400, 335 385
L 315 370
C 295 355, 280 335, 270 315
L 260 290
C 250 270, 230 255, 210 250
Z
`;

// Baleares (rectángulo simplificado)
const BALEARES = `M 760 320 L 800 320 L 800 345 L 760 345 Z`;

// Canarias (dos cuadrados)
const CANARIAS = `M 130 545 L 165 545 L 165 575 L 130 575 Z M 175 555 L 205 555 L 205 580 L 175 580 Z`;

export function PlantMap({ plants, slug }: Props) {
  if (plants.length === 0) {
    return null;
  }
  // Solo plantas con coordenadas válidas
  const geoPlants = plants.filter((p) => p.lat != null && p.lng != null);
  if (geoPlants.length === 0) {
    return null;
  }

  return (
    <section className="empresa-section" aria-labelledby="map-heading">
      <div className="empresa-container">
        <div className="section-head">
          <h2 className="section-head-title" id="map-heading">
            <span className="section-head-num">02</span>Mapa de plantas
          </h2>
          <span className="section-head-count">{geoPlants.length} geolocalizadas · {plants.length - geoPlants.length} sin coordenadas</span>
        </div>
        <div className="map-shell">
          <div className="map-canvas" role="img" aria-label={`Mapa de España con ${geoPlants.length} plantas`}>
            <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet" role="presentation">
              <defs>
                <pattern id="map-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(212, 165, 116, 0.05)" strokeWidth="0.5" />
                </pattern>
                <radialGradient id="map-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(212, 165, 116, 0.08)" />
                  <stop offset="100%" stopColor="rgba(212, 165, 116, 0)" />
                </radialGradient>
              </defs>
              <rect width={VIEW_W} height={VIEW_H} fill="url(#map-glow)" />
              <rect width={VIEW_W} height={VIEW_H} fill="url(#map-grid)" />
              {/* España peninsular */}
              <path d={SPAIN_PATH} fill="rgba(244, 241, 234, 0.04)" stroke="rgba(244, 241, 234, 0.18)" strokeWidth="1" />
              <path d={BALEARES} fill="rgba(244, 241, 234, 0.04)" stroke="rgba(244, 241, 234, 0.18)" strokeWidth="1" />
              <path d={CANARIAS} fill="rgba(244, 241, 234, 0.04)" stroke="rgba(244, 241, 234, 0.18)" strokeWidth="1" />

              {/* Pins */}
              {geoPlants.map((p) => {
                const { x, y } = project(p.lng!, p.lat!);
                const color = statusColorVar(p.status);
                return (
                  <g key={p.id} className="map-pin" role="button" tabIndex={0}
                     aria-label={`${p.name} (${statusLabel(p.status)})`}
                     onClick={() => {
                       const el = document.getElementById(`plant-${p.id}`);
                       el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                     }}
                  >
                    <circle className="pin-pulse" cx={x} cy={y} r="6" fill={color} />
                    <circle className="pin-dot" cx={x} cy={y} r="9" fill={color} opacity="0.25" />
                    <circle className="pin-dot" cx={x} cy={y} r="5" fill={color} />
                    <text className="pin-label" x={x + 12} y={y + 4}>{p.name}</text>
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="map-legend">
            <span className="map-legend-item"><span className="legend-dot" style={{ background: 'var(--success)' }} />Operativa</span>
            <span className="map-legend-item"><span className="legend-dot" style={{ background: 'var(--info)' }} />En inversión</span>
            <span className="map-legend-item"><span className="legend-dot" style={{ background: 'var(--danger)' }} />Cerrada / Desmantelamiento</span>
            <span className="map-legend-item"><span className="legend-dot" style={{ background: 'var(--accent)' }} />Vendida / Conversión</span>
            <span className="map-legend-item"><span className="legend-dot" style={{ background: 'var(--warn)' }} />En venta</span>
          </div>
        </div>
      </div>
    </section>
  );
}
