#!/bin/bash
# scripts/deploy-vps.sh — Deploy a VPS HERMES Dossier (Next.js standalone).
#
# REGLA R2: El profesor (yo) NO ejecuto esto. El usuario (JC) corre este script
# en su VPS (/opt/hermes-dossier/apps/dossier-industrial/) DESPUÉS de hacer
# `git pull` y `pnpm install`.
#
# Pasos obligatorios para que el build standalone funcione:
#   1) pnpm build (genera .next/standalone/)
#   2) cp -r app     .next/standalone/    (Server Components referencia rutas relativas)
#   3) cp -r prisma  .next/standalone/    (PrismaClient la necesita en runtime)
#   4) cp -r public  .next/standalone/    (favicon.svg y demás estáticos custom)
#   5) cp -r .next/static .next/standalone/.next/  (chunks estáticos)
#   6) prisma migrate deploy
#   7) systemctl restart hermes-dossier
#
# Los pasos 2-5 son la parte que casi todo el mundo olvida. Sin ellos, las
# rutas devuelven 404 y los assets estáticos no se sirven.

set -euo pipefail
APP=/opt/hermes-dossier/apps/dossier-industrial
cd "$APP"

echo "▶ [1/6] pnpm install"
pnpm install --frozen-lockfile

echo "▶ [2/6] pnpm build (Next 15 standalone)"
pnpm build

echo "▶ [3/6] Copy app/, prisma/, public/, .next/static → .next/standalone/"
[ -d app ]     && cp -r app     .next/standalone/
[ -d prisma ]  && cp -r prisma  .next/standalone/
[ -d public ]  && cp -r public  .next/standalone/
[ -d .next/static ] && cp -r .next/static .next/standalone/.next/

echo "▶ [4/6] prisma migrate deploy"
pnpm prisma migrate deploy

echo "▶ [5/6] Verificación rápida de assets"
test -f .next/standalone/.next/BUILD_ID && echo "  ✓ BUILD_ID presente: $(cat .next/standalone/.next/BUILD_ID)"
test -d .next/standalone/app            && echo "  ✓ app/ copiado"
test -d .next/standalone/prisma         && echo "  ✓ prisma/ copiado"
test -d .next/standalone/public         && echo "  ✓ public/ copiado ($(ls .next/standalone/public | wc -l) ficheros)"
test -d .next/standalone/.next/static   && echo "  ✓ .next/static/ copiado"

echo "▶ [6/6] systemctl restart hermes-dossier"
systemctl restart hermes-dossier
sleep 2
systemctl is-active --quiet hermes-dossier && echo "  ✓ servicio activo" || { echo "  ✗ servicio caído, ver journalctl"; exit 1; }

echo ""
echo "✓ DEPLOY COMPLETADO. URLs de smoke test:"
echo "  curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3002/dossier/api/health"
echo "  curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3002/dossier/"
echo "  curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3002/dossier/icon"
echo "  curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3002/dossier/favicon.svg"
