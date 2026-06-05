#!/bin/bash
# /opt/hermes-dossier/scripts/daily-report.sh
# Genera el reporte diario de HERMES Dossier y lo envía a Telegram.
# Datos: leads nuevos en 24h, top empresas, eventos próximos, dec resumen.

set -euo pipefail

ENV_FILE=/opt/hermes-dossier/.env.telegram
if [ ! -f "$ENV_FILE" ]; then
  echo "[daily-report] $ENV_FILE no existe, skip"
  exit 0
fi
source "$ENV_FILE"

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
  echo "[daily-report] TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID vacío, skip"
  exit 0
fi

# PGPASSWORD se carga de /opt/hermes-dossier/.env (mode 600, gitignored).
# Mantenemos retro-compat: si la var está en .env, se respeta; si no, fallback a la URL parseada.
if [ -f /opt/hermes-dossier/.env ]; then
  set +u
  PGPASSWORD=$(grep -E '^PGPASSWORD=' /opt/hermes-dossier/.env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  if [ -z "$PGPASSWORD" ]; then
    DB_URL=$(grep -E '^DATABASE_URL=' /opt/hermes-dossier/.env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
    if [ -n "$DB_URL" ]; then
      PGPASSWORD=$(printf '%s' "$DB_URL" | sed -E 's#^postgresql://[^:]+:([^@]+)@.*#\1#')
    fi
  fi
  export PGPASSWORD
  set -u
fi
if [ -z "${PGPASSWORD:-}" ]; then
  echo "[daily-report] PGPASSWORD no disponible en .env, skip"
  exit 0
fi

# === STATS 24h ===
NEW_SOURCES=$(psql -h 127.0.0.1 -U surus -d hermes_dossier -t -A -c "SELECT COUNT(*) FROM \"Source\" WHERE \"scrapedAt\" > NOW() - INTERVAL '24 hours';")
NEW_IN_SCOPE=$(psql -h 127.0.0.1 -U surus -d hermes_dossier -t -A -c "SELECT COUNT(*) FROM \"Source\" WHERE \"scrapedAt\" > NOW() - INTERVAL '24 hours' AND \"deimplantationSignal\" = true;")
TOTAL_SOURCES=$(psql -h 127.0.0.1 -U surus -d hermes_dossier -t -A -c "SELECT COUNT(*) FROM \"Source\";")
TOTAL_IN_SCOPE=$(psql -h 127.0.0.1 -U surus -d hermes_dossier -t -A -c "SELECT COUNT(*) FROM \"Source\" WHERE \"deimplantationSignal\" = true;")
TOTAL_COMPANIES=$(psql -h 127.0.0.1 -U surus -d hermes_dossier -t -A -c "SELECT COUNT(*) FROM \"Company\";")
TOTAL_CONTACTS=$(psql -h 127.0.0.1 -U surus -d hermes_dossier -t -A -c "SELECT COUNT(*) FROM \"PlantContact\" WHERE email IS NOT NULL AND email != '';")

# === TOP 5 leads in_scope (últimas 48h) ===
TOP=$(psql -h 127.0.0.1 -U surus -d hermes_dossier -t -A -F'|' -c "
SELECT s.title, c.name
FROM \"Source\" s
LEFT JOIN \"Company\" c ON c.id = s.\"companyId\"
WHERE s.\"deimplantationSignal\" = true
  AND s.\"scrapedAt\" > NOW() - INTERVAL '48 hours'
ORDER BY s.\"scrapedAt\" DESC
LIMIT 5;
")

# === Última SearchRun por agente ===
RUNS=$(psql -h 127.0.0.1 -U surus -d hermes_dossier -t -A -F'|' -c "
SELECT \"agentName\", \"itemsFound\", \"itemsInScope\"
FROM \"SearchRun\"
WHERE \"startedAt\" > NOW() - INTERVAL '7 days'
ORDER BY \"startedAt\" DESC
LIMIT 10;
")

# === Construir mensaje ===
MSG="<b>HERMES Dossier — Reporte Diario $(date +%Y-%m-%d)</b>

<b>Últimas 24h</b>
• Sources nuevas: $NEW_SOURCES
• In-scope (desimplantación): $NEW_IN_SCOPE

<b>Base acumulada</b>
• Empresas monitorizadas: $TOTAL_COMPANIES
• Sources totales: $TOTAL_SOURCES
• In-scope: $TOTAL_IN_SCOPE
• Contactos con email: $TOTAL_CONTACTS

<b>Top 5 leads in_scope (48h)</b>
$(echo "$TOP" | while IFS='|' read -r title name; do echo "• <i>${name:-?}</i> — ${title:0:100}"; done)

<b>Últimas ejecuciones</b>
$(echo "$RUNS" | while IFS='|' read -r agent found scope; do echo "• $agent → found=$found inScope=$scope"; done)

Acceso: <a href=\"https://88-198-93-52.nip.io/dossier/\">https://88-198-93-52.nip.io/dossier/</a>"

# Truncar a 4000 chars
MSG="${MSG:0:4000}"

curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  -d "parse_mode=HTML" \
  -d "text=${MSG}" \
  --max-time 15 >/dev/null || echo "[daily-report] curl falló"

echo "[daily-report] enviado $(date -u)"
