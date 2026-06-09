#!/bin/sh
# init-nginx.sh — Generate nginx config from template

set -e

DOMAIN="${NGINX_SERVER_NAME:-yotop10.local}"
CERT_DIR="${NGINX_CERT_DIR:-/etc/letsencrypt/live/${DOMAIN}}"

echo "[Nginx] Configuring for domain: ${DOMAIN}"

sed \
  -e "s/__DOMAIN_PLACEHOLDER__/${DOMAIN}/g" \
  -e "s|__CERT_PLACEHOLDER__|${CERT_DIR}|g" \
  /templates/nginx.conf > /etc/nginx/conf.d/default.conf

echo "[Nginx] Config generated successfully"
