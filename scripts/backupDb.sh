#!/usr/bin/env bash
# Respaldo cifrado de la base de datos (tablas del sitio y cuentas de acceso). Uso:
#   DATABASE_URL=… BACKUP_PASSPHRASE=… scripts/backupDb.sh [carpeta-de-salida]
# Deja <carpeta>/db-AAAA-MM-DD.dump.gpg (formato personalizado de pg_dump, cifrado con AES-256) y comprueba que el archivo se
# pueda leer de vuelta (pg_restore --list) ANTES de darlo por bueno: un respaldo que no se puede restaurar no sirve.
# Necesita pg_dump/pg_restore (versión igual o mayor que la de la base) y gpg.
set -euo pipefail

: "${DATABASE_URL:?Falta DATABASE_URL (la cadena de conexión de la base)}"
: "${BACKUP_PASSPHRASE:?Falta BACKUP_PASSPHRASE (la frase con la que se cifra; guárdala en otro lugar: sin ella no se puede restaurar)}"

OUT="${1:-backup}"
STAMP="$(date -u +%Y-%m-%d)"
mkdir -p "$OUT"
RAW="$OUT/db-$STAMP.dump"

# public = los datos del sitio; auth = las cuentas del panel (correos y contraseñas ya cifradas por Supabase).
# Sin dueños ni permisos: se restauran sobre el usuario que corra pg_restore.
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --schema=public --schema=auth --file="$RAW"

pg_restore --list "$RAW" > /dev/null   # falla si el archivo está dañado
TABLES="$(pg_restore --list "$RAW" | grep -c ' TABLE DATA ' || true)"

gpg --batch --yes --quiet --pinentry-mode loopback --symmetric --cipher-algo AES256 --passphrase "$BACKUP_PASSPHRASE" --output "$RAW.gpg" "$RAW"
rm -f "$RAW"   # nunca se deja el respaldo sin cifrar en disco

echo "Respaldo listo: $RAW.gpg ($(du -h "$RAW.gpg" | cut -f1), $TABLES tablas)"
