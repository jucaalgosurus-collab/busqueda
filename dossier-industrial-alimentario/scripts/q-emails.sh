#!/bin/bash
export PGPASSWORD=Surus2024!
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
