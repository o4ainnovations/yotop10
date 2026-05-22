#!/bin/sh
set -e

echo "=== yotop10 development environment ==="

if [ -f /app/scripts/dev-check-deps.sh ]; then
  sh /app/scripts/dev-check-deps.sh
fi

echo "Syncing dependencies..."
cd /app/backend && pnpm install --no-frozen-lockfile
cd /app/frontend && pnpm install --no-frozen-lockfile

echo "Starting dev servers under PM2..."

# Clean stale Next.js build cache to prevent ENOENT/module-not-found errors
# .next/cache may be a Docker volume mount — cannot rm the parent dir
rm -rf /app/frontend/.next/BUILD_ID /app/frontend/.next/server /app/frontend/.next/static 2>/dev/null || true

pm2 start /app/ecosystem.config.dev.json
exec pm2 logs
