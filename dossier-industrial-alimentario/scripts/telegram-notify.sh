#!/bin/bash
# /opt/hermes-dossier/scripts/telegram-notify.sh
# Envía un mensaje al bot de Telegram de Juan Carlos.
# Token y chat_id configurados en /opt/hermes-dossier/.env.telegram (chmod 600)

ENV_FILE=/opt/hermes-dossier/.env.telegram
if [ ! -f "$ENV_FILE" ]; then
  echo "[telegram-notify] $ENV_FILE no existe, skip"
  exit 0
fi
source "$ENV_FILE"

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
  echo "[telegram-notify] TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID vacío, skip"
  exit 0
fi

MESSAGE="${1:-HERMES scan}"
# Limitar a 4096 chars (límite Telegram)
MESSAGE_TRIMMED="${MESSAGE:0:4000}"

curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  -d "parse_mode=HTML" \
  -d "text=${MESSAGE_TRIMMED}" \
  --max-time 15 >/dev/null || echo "[telegram-notify] curl falló"
