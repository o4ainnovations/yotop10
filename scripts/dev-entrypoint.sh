#!/bin/sh
set -e

echo "=== yotop10 development environment ==="

if [ -f /app/scripts/dev-check-deps.sh ]; then
  sh /app/scripts/dev-check-deps.sh
fi

echo "Starting dev servers under PM2..."

pm2 start /app/ecosystem.config.dev.json
exec pm2 logs
