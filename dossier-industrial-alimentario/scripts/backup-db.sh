#!/bin/bash
# /opt/hermes-dossier/scripts/backup-db.sh
# Genera un backup comprimido de la DB hermes_dossier y limpia los >7d.
# Usado por hermes-db-backup.service (NO contiene credenciales).
set -euo pipefail

# Cargar credenciales desde env-file
ENV_FILE=/etc/hermes/hermes.env
if [ ! -f "$ENV_FILE" ]; then
  echo "[backup] FATAL: $ENV_FILE no existe" >&2
  exit 1
fi
set -a
source "$ENV_FILE"
set +a

BACKUP_DIR=/opt/hermes-dossier/backups
mkdir -p "$BACKUP_DIR"
TS=$(date -u +%FT%H%MZ)
FILE="$BACKUP_DIR/db-$TS.sql.gz"

# pg_dump con credenciales del env-file, en una sola tubería
PGPASSWORD="$SURUS_DB_PASSWORD" pg_dump \
  -h "$SURUS_DB_HOST" \
  -p "$SURUS_DB_PORT" \
  -U "$SURUS_DB_USER" \
  -d "$SURUS_DB_NAME" \
  --no-owner --no-acl \
  | gzip -9 > "$FILE"

ls -la "$FILE"
echo "[backup] OK $FILE"

# Retención: borrar > 7 días
DELETED=$(find "$BACKUP_DIR" -name "db-*.sql.gz" -mtime +7 -print -delete | wc -l)
echo "[backup] retencion: $DELETED archivos >7d purgados"
