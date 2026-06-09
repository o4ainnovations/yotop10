#!/usr/bin/env bash
# Generate self-signed certificates for local development
# Production: use Let's Encrypt certbot instead

set -euo pipefail

DOMAIN="${1:-yotop10.local}"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"

if [ -f "${CERT_DIR}/fullchain.pem" ]; then
  echo "[Certs] Certificate already exists for ${DOMAIN}"
  exit 0
fi

echo "[Certs] Generating self-signed certificate for ${DOMAIN}..."
mkdir -p "${CERT_DIR}"

openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout "${CERT_DIR}/privkey.pem" \
  -out "${CERT_DIR}/fullchain.pem" \
  -subj "/CN=${DOMAIN}" \
  -addext "subjectAltName=DNS:${DOMAIN},DNS:www.${DOMAIN}" 2>/dev/null

cp "${CERT_DIR}/fullchain.pem" "${CERT_DIR}/chain.pem"

echo "[Certs] Self-signed certificate generated for ${DOMAIN}"
echo "[Certs] Location: ${CERT_DIR}"
