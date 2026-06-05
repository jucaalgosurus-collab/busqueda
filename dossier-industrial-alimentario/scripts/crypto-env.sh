#!/bin/bash
# scripts/crypto-env.sh — A.12 Encriptar .env del VPS con AES-256-CBC.
#
# OBJETIVO (cambió A.12, 2026-06-05): JC NO quiere rotar las keys, quiere
# que el .env esté CIFRADO. La misma key Hunter/Gemini/DB vive en
# /opt/hermes-dossier/.env, pero una copia cifrada (.env.enc) puede vivir
# en el repo o backup offline sin riesgo.
#
# FLUJO:
#   1) Cifrar: lee /opt/hermes-dossier/.env, lo cifra con AES-256-CBC +
#      PBKDF2 (100k iter, salt 16 bytes), escribe /opt/hermes-dossier/.env.enc
#   2) Descifrar: lee .env.enc + passphrase desde /root/.env.master.key,
#      escribe .env en plano (permisos 600)
#   3) Rotar passphrase: genera nuevo master.key y re-cifra .env.enc
#   4) show-info: imprime longitud de la passphrase, fingerprint SHA256
#
# UBICACIÓN DE ARCHIVOS:
#   - Plano (solo en VPS):       /opt/hermes-dossier/.env          (600 root:root)
#   - Cifrado (puedeコミtearse):  /opt/hermes-dossier/.env.enc      (644, no sensible)
#   - Master key (NUNCAコミtear): /root/.env.master.key             (600 root:root)
#
# USO (en VPS):
#   bash scripts/crypto-env.sh encrypt
#   bash scripts/crypto-env.sh decrypt
#   bash scripts/crypto-env.sh show-info
#   bash scripts/crypto-env.sh rotate-passphrase
#
# El .env plano sigue siendo lo que Next.js lee vía process.env. Esto
# es DEFENSA EN CAPAS: si alguien accede al repo público, ve .env.enc
# (ruido). Si alguien compromete el VPS, ve .env plano (600 root:root).
# La passphrase solo está en /root/.env.master.key, inaccesible sin root.

set -euo pipefail

ENV_PLAIN=/opt/hermes-dossier/.env
ENV_ENC=/opt/hermes-dossier/.env.enc
KEY_FILE=/root/.env.master.key
PBKDF2_ITER=100000
CIPHER=aes-256-cbc

# ────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────
die() { echo "ERROR: $*" >&2; exit 1; }
need_root() { [ "$(id -u)" -eq 0 ] || die "este script debe correr como root (sudo)"; }

gen_passphrase() {
  # 32 bytes random → 64 hex chars → 256 bits de entropía
  openssl rand -hex 32
}

ensure_key_file() {
  if [ ! -f "$KEY_FILE" ]; then
    echo "▶ Generando nueva master key en $KEY_FILE"
    umask 077
    gen_passphrase > "$KEY_FILE"
    chmod 600 "$KEY_FILE"
    chown root:root "$KEY_FILE"
  fi
  # Validar formato (64 hex chars)
  local len
  len=$(wc -c < "$KEY_FILE")
  [ "$len" -eq 65 ] || die "$KEY_FILE malformado (esperaba 64 hex + newline, encontré $len bytes)"
}

encrypt() {
  need_root
  [ -f "$ENV_PLAIN" ] || die "no existe $ENV_PLAIN"
  ensure_key_file
  local pass
  pass=$(cat "$KEY_FILE")
  echo "▶ Cifrando $ENV_PLAIN → $ENV_ENC (AES-256-CBC + PBKDF2 $PBKDF2_ITER iter)"
  # -pbkdf2 fuerza PBKDF2 (default en OpenSSL 3 es -pbkdf2 ya)
  # -salt genera salt aleatorio (16 bytes por default en OpenSSL 3.5)
  # -iter $PBKDF2_ iteraciones
  umask 077
  openssl enc -$CIPHER -salt -pbkdf2 -iter $PBKDF2_ITER \
    -in "$ENV_PLAIN" -out "$ENV_ENC" \
    -pass "pass:$pass"
  chmod 644 "$ENV_ENC"
  chown root:root "$ENV_ENC"
  local size
  size=$(stat -c%s "$ENV_ENC")
  echo "  ✓ $ENV_ENC escrito ($size bytes)"
  echo "  ✓ Master key en $KEY_FILE (NO COMMITEAR)"
}

decrypt() {
  need_root
  [ -f "$ENV_ENC" ] || die "no existe $ENV_ENC"
  [ -f "$KEY_FILE" ] || die "no existe $KEY_FILE — ¿se perdió la master key?"
  local pass
  pass=$(cat "$KEY_FILE")
  echo "▶ Descifrando $ENV_ENC → $ENV_PLAIN"
  umask 077
  openssl enc -d -$CIPHER -pbkdf2 -iter $PBKDF2_ITER \
    -in "$ENV_ENC" -out "$ENV_PLAIN" \
    -pass "pass:$pass"
  chmod 600 "$ENV_PLAIN"
  chown root:root "$ENV_PLAIN"
  echo "  ✓ $ENV_PLAIN restaurado (600 root:root)"
}

show_info() {
  echo "=== $ENV_PLAIN ==="
  if [ -f "$ENV_PLAIN" ]; then
    ls -la "$ENV_PLAIN"
    echo "SHA256: $(sha256sum "$ENV_PLAIN" | awk '{print $1}')"
  else
    echo "  (no existe)"
  fi
  echo "=== $ENV_ENC ==="
  if [ -f "$ENV_ENC" ]; then
    ls -la "$ENV_ENC"
    echo "SHA256: $(sha256sum "$ENV_ENC" | awk '{print $1}')"
  else
    echo "  (no existe)"
  fi
  echo "=== $KEY_FILE ==="
  if [ -f "$KEY_FILE" ]; then
    ls -la "$KEY_FILE"
    echo "  (64 hex chars, contenido oculto)"
  else
    echo "  (no existe — correr 'encrypt' para crear)"
  fi
}

rotate_passphrase() {
  need_root
  [ -f "$ENV_PLAIN" ] || die "no existe $ENV_PLAIN — descifrar primero"
  echo "▶ Backup de master key vieja"
  cp -p "$KEY_FILE" "${KEY_FILE}.bak-$(date -u +%Y%m%d-%H%M%S)"
  echo "▶ Generando nueva master key"
  umask 077
  gen_passphrase > "$KEY_FILE"
  chmod 600 "$KEY_FILE"
  chown root:root "$KEY_FILE"
  echo "▶ Re-cifrando .env con la nueva key"
  encrypt
  echo "✓ Passphrase rotada. La vieja está en ${KEY_FILE}.bak-* (bórrala si quieres)."
}

case "${1:-}" in
  encrypt) encrypt ;;
  decrypt) decrypt ;;
  show-info) show_info ;;
  rotate-passphrase) rotate_passphrase ;;
  *)
    cat <<USAGE
Uso: bash scripts/crypto-env.sh <comando>
  encrypt           cifra /opt/hermes-dossier/.env → .env.enc
  decrypt           descifra .env.enc → .env (necesita master.key)
  show-info         imprime estado de los 3 archivos
  rotate-passphrase genera nueva master key y re-cifra
USAGE
    exit 1
    ;;
esac
