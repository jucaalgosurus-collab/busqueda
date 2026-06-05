#!/bin/bash
# /opt/hermes-dossier/scripts/run-agents.sh
# Ejecuta los 4 agentes (newsrooms, prensa, sectorial, boe-bop) en serie.
# Persiste SearchRun automáticamente. El sistema es idempotente (UNIQUE url).
# Costo API: 0 EUR (todo RSS + Playwright stealth sin pagar APIs externas).

set -euo pipefail

cd /opt/hermes-dossier/apps/dossier-industrial

# Todas las credenciales se cargan de /opt/hermes-dossier/.env (mode 600, gitignored).
# Retro-compatibilidad: si el fichero .env existe, sus variables tienen precedencia
# sobre cualquier export residual de este script. El script nunca debe hardcodear
# credenciales en código committed.
if [ -f /opt/hermes-dossier/.env ]; then
  set +u
  # shellcheck disable=SC1091
  source /opt/hermes-dossier/.env
  set -u
fi

# Defaults: si faltan las API keys (entorno nuevo), exportar string vacío para
# que los agentes fallen en seco con un error claro en lugar de hacer requests
# anonimas.
export DATABASE_URL="${DATABASE_URL:-}"
export HUNTER_API_KEY="${HUNTER_API_KEY:-}"
export GEMINI_API_KEY="${GEMINI_API_KEY:-}"

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

# Resumen final
echo "" | tee -a "$LOG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG"
echo "✓ SCAN COMPLETADO — $(date -u +%Y-%m-%dT%H:%M:%SZ)" | tee -a "$LOG"
echo "  Log completo: $LOG" | tee -a "$LOG"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" | tee -a "$LOG"

# Notificar a Telegram
/opt/hermes-dossier/scripts/telegram-notify.sh "HERMES scan $(date -u +%Y-%m-%dT%H:%M) ✓
Log: $LOG

Última ejecución: $(grep -E 'inScope|new' "$LOG" | tail -5 | tr '\n' ' ')" || true

# Rotar logs (>30 días)
find "$LOG_DIR" -type f -name 'scan-*.log' -mtime +30 -delete || true
