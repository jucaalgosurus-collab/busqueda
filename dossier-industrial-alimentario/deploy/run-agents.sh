# /opt/hermes-dossier/scripts/run-agents.sh
# Ejecuta los agentes de HERMES Dossier en serie. Idempotente (UNIQUE url).
# Costo API: Hunter 25 verif/mes free + DeepSeek ~5€/mes. 0€ APIs RSS.
# Añadido 2026-06-04: 3 agentes del Sprint B (borme, auctions, regulatorio).

set -uo pipefail

cd /opt/hermes-dossier/apps/dossier-industrial
# Secrets loaded from /etc/hermes-dossier.env (chmod 600, root only)
set -a
source /etc/hermes-dossier.env
set +a

LOG_DIR=/var/log/hermes-scan
mkdir -p "$LOG_DIR"
TS=$(date -u +%Y%m%d-%H%M%S)
LOG="$LOG_DIR/scan-$TS.log"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG"
echo "HERMES Dossier — SCAN $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG"

# 1. Newsrooms corporativas
echo "" | tee -a "$LOG"
echo "▶ AGENT 1: newsrooms-corporativas" | tee -a "$LOG"
timeout 480 ./node_modules/.bin/tsx lib/agents/runner.ts 2>&1 | grep -E '(inScope|new|errors|progress|✓)' | tail -10 | tee -a "$LOG" || echo "  ✗ newsrooms falló" | tee -a "$LOG"

# 2. Prensa nacional+regional
echo "" | tee -a "$LOG"
echo "▶ AGENT 2-3: prensa-general-regional" | tee -a "$LOG"
timeout 360 ./node_modules/.bin/tsx lib/agents/prensa-runner.ts 2>&1 | tail -20 | tee -a "$LOG" || echo "  ✗ prensa falló" | tee -a "$LOG"

# 3. BOE/BOP/sindicatos
echo "" | tee -a "$LOG"
echo "▶ AGENT 4: boe-bop-sindicatos" | tee -a "$LOG"
timeout 360 ./node_modules/.bin/tsx lib/agents/boe-bop-runner.ts 2>&1 | tail -20 | tee -a "$LOG" || echo "  ✗ boe-bop falló" | tee -a "$LOG"

# 4. Sprint B.1 BORME — cambios domicilio social + desimplantaciones
echo "" | tee -a "$LOG"
echo "▶ AGENT B.1: borme (cambios domicilio + concursos NO concursales)" | tee -a "$LOG"
timeout 360 ./node_modules/.bin/tsx lib/agents/borme-runner.ts 2>&1 | tail -20 | tee -a "$LOG" || echo "  ✗ borme falló" | tee -a "$LOG"

# 5. Sprint B.9 Auctions — Escrapalia/Surplex/Troostwijk/etc. (señal fuerte de desimplantación)
echo "" | tee -a "$LOG"
echo "▶ AGENT B.9: auctions (13 portales de subastas, cadencia semanal)" | tee -a "$LOG"
timeout 480 ./node_modules/.bin/tsx lib/agents/auctions-runner.ts 2>&1 | tail -20 | tee -a "$LOG" || echo "  ✗ auctions falló" | tee -a "$LOG"

# 6. Sprint B.2 Regulatorio — Alertas AESAN alimentarias
echo "" | tee -a "$LOG"
echo "▶ AGENT B.2: regulatorio (AESAN alertas alimentarias, cadencia 2d)" | tee -a "$LOG"
timeout 240 ./node_modules/.bin/tsx lib/agents/regulatorio-runner.ts 2>&1 | tail -20 | tee -a "$LOG" || echo "  ✗ regulatorio falló" | tee -a "$LOG"

# 6b. Sprint B.3 Renuncias masivas consejeros — reusa Source BORME de B.1
echo "" | tee -a "$LOG"
echo "▶ AGENT B.3: renuncias (≥3 ceses consejeros en 90d, cadencia 1d)" | tee -a "$LOG"
timeout 240 ./node_modules/.bin/tsx lib/agents/renuncias-runner.ts 2>&1 | tail -20 | tee -a "$LOG" || echo "  ✗ renuncias falló" | tee -a "$LOG"

# 6c. Sprint B.4 Ejecuciones singulares (no concursos) — tensión financiera pre-concursal
echo "" | tee -a "$LOG"
echo "▶ AGENT B.4: ejecuciones singulares (1+ ejec + 1+ embargo en 90d, sin concursos, cadencia 1d)" | tee -a "$LOG"
timeout 240 ./node_modules/.bin/tsx lib/agents/ejecuciones-runner.ts 2>&1 | tail -20 | tee -a "$LOG" || echo "  ✗ ejecuciones falló" | tee -a "$LOG"

# 6d. Sprint B.5 Seguros crédito — CESCE/CyC/Coface/Allianz Trade barómetros sectoriales
echo "" | tee -a "$LOG"
echo "▶ AGENT B.5: seguros crédito (downgrades sectoriales ES, cadencia 7d)" | tee -a "$LOG"
timeout 240 ./node_modules/.bin/tsx lib/agents/seguros-runner.ts 2>&1 | tail -20 | tee -a "$LOG" || echo "  ✗ seguros falló" | tee -a "$LOG"

# 6e. Sprint B.6 Ayudas públicas — CDTI/IDAE/ICEX (dataset estático, cadencia 14d)
echo ""
echo "▶ AGENT B.6: ayudas públicas CDTI/IDAE/ICEX (dataset estático, cadencia 14d)" | tee -a "$LOG"
timeout 120 ./node_modules/.bin/tsx lib/agents/ayudas-runner.ts 2>&1 | tail -20 | tee -a "$LOG" || echo "  ✗ ayudas falló" | tee -a "$LOG"

# 7. Verificar emails pendientes con Hunter.io (SIEMPRE corre al final)
echo "" | tee -a "$LOG"
echo "▶ HUNTER VERIFY: emails pendientes" | tee -a "$LOG"
timeout 600 ./node_modules/.bin/tsx scripts/verify-emails-hunter.ts 2>&1 | tail -20 | tee -a "$LOG" || echo "  ✗ hunter-verify falló" | tee -a "$LOG"

# Resumen final
echo "" | tee -a "$LOG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG"
echo "✓ SCAN COMPLETADO — $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG"
echo "  Log completo: $LOG" | tee -a "$LOG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG"

# Notificar a Telegram
/opt/hermes-dossier/scripts/telegram-notify.sh "HERMES scan $(date -u +%Y-%m-%dT%H:%M) ✓
Log: $LOG

$(grep -E '(Valid|Invalid|Risky|Unknown|hunter-verify done|✓|inScope|found=)' "$LOG" | tail -10 | tr '\n' ' ')" || true

# Rotar logs (>30 días)
find "$LOG_DIR" -type f -name 'scan-*.log' -mtime +30 -delete || true
