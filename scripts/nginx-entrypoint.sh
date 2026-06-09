#!/usr/bin/env sh
# nginx-entrypoint.sh — Substitute env vars then start nginx

set -e

DOMAIN="${NGINX_SERVER_NAME:-yotop10.local}"
CERT_DIR="${NGINX_CERT_DIR:-/etc/letsencrypt/live/${DOMAIN}}"

echo "[Nginx] Configuring for domain: ${DOMAIN}"
echo "[Nginx] Certificate directory: ${CERT_DIR}"

# Substitute placeholders
sed -i "s/__DOMAIN_PLACEHOLDER__/${DOMAIN}/g" /etc/nginx/nginx.conf
sed -i "s|__CERT_PLACEHOLDER__|${CERT_DIR}|g" /etc/nginx/nginx.conf

echo "[Nginx] Configuration ready"

# Start nginx in foreground
exec nginx -g 'daemon off;'
