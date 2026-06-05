#!/bin/bash
# PGPASSWORD se carga de /opt/hermes-dossier/.env (mode 600, gitignored).
set -e
if [ -f /opt/hermes-dossier/.env ]; then
  PGPASSWORD=$(grep -E '^PGPASSWORD=' /opt/hermes-dossier/.env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  if [ -z "$PGPASSWORD" ]; then
    DB_URL=$(grep -E '^DATABASE_URL=' /opt/hermes-dossier/.env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
    if [ -n "$DB_URL" ]; then
      PGPASSWORD=$(printf '%s' "$DB_URL" | sed -E 's#^postgresql://[^:]+:([^@]+)@.*#\1#')
    fi
  fi
  export PGPASSWORD
fi
if [ -z "${PGPASSWORD:-}" ]; then
  echo "PGPASSWORD no disponible en /opt/hermes-dossier/.env" >&2
  exit 1
fi
echo "=== COLUMNAS DE PlantContact ==="
psql -h 127.0.0.1 -U surus -d hermes_dossier -t -A -c "\d \"PlantContact\"" | head -40
echo ""
echo "=== EMAILS DE CONTACTOS (todos) ==="
psql -h 127.0.0.1 -U surus -d hermes_dossier -t -A -F"|" -c "
SELECT \"fullName\", email, \"emailVerified\"
FROM \"PlantContact\"
WHERE email IS NOT NULL AND email != ''
ORDER BY \"emailVerified\" DESC, \"fullName\"
LIMIT 40;
"
echo ""
echo "=== TOTALES ==="
psql -h 127.0.0.1 -U surus -d hermes_dossier -t -A -F"|" -c "
SELECT 'Total contactos: ' || COUNT(*) FROM \"PlantContact\"
UNION ALL SELECT 'Con email: ' || COUNT(*) FROM \"PlantContact\" WHERE email IS NOT NULL AND email != ''
UNION ALL SELECT 'Verificados: ' || COUNT(*) FROM \"PlantContact\" WHERE \"emailVerified\" = true;
"
