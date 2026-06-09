#!/usr/bin/env bash
# ── rebuild.sh ── Rebuild and restart yotop10 production stack
# Usage: bash /opt/yotop10/scripts/rebuild.sh [--with-seed]
# SAFETY: NEVER runs `docker compose down -v` — that would wipe ALL database volumes.
#         --with-seed runs seed scripts after rebuild (dev only, skips existing data).
set -euo pipefail

APP_DIR="/opt/yotop10"
DOMAIN="yotop10.com"
COMPOSE_FILE="$APP_DIR/docker-compose.yml"
WITH_SEED=false
[[ "${1:-}" == "--with-seed" ]] && WITH_SEED=true

R='\033[0;31m' G='\033[0;32m' Y='\033[1;33m' B='\033[1;34m' W='\033[1;37m' N='\033[0m'

log()   { echo -e "[$(date -Iseconds)] $1" >&2; }
ok()    { log "  ${G}✓${N} $1"; }
warn()  { log "  ${Y}⚠${N}  $1"; }
fail()  { log "  ${R}✗${N} $1"; exit 1; }
info()  { log "  ${B}→${N} $1"; }
step()  { echo ""; log "${W}═══ $1 ═══${N}"; }

cd "$APP_DIR"

step "Pre-flight checks"
if [ ! -f "$COMPOSE_FILE" ]; then fail "docker-compose.yml not found at $COMPOSE_FILE"; fi
if [ ! -f .env ]; then fail ".env file not found — create one from .env.example"; fi
require_command() {
    if ! command -v "$1" &>/dev/null; then fail "$1 not found"; fi
}
require_command docker
require_command curl

step "Pulling latest code"
git pull origin main

step "Rebuilding and restarting Docker services"
docker compose -f "$COMPOSE_FILE" up -d --build

step "Waiting for backend health"
for i in $(seq 1 30); do
    status=$(docker inspect --format='{{.State.Health.Status}}' yotop10_backend 2>/dev/null || echo "")
    if [ "$status" = "healthy" ]; then
        ok "Backend healthy"
        break
    fi
    if [ "$i" = 30 ]; then fail "Backend not healthy after 60s"; fi
    sleep 2
done

step "Waiting for frontend health"
for i in $(seq 1 30); do
    status=$(docker inspect --format='{{.State.Health.Status}}' yotop10_frontend 2>/dev/null || echo "")
    if [ "$status" = "healthy" ]; then
        ok "Frontend healthy"
        break
    fi
    if [ "$i" = 30 ]; then fail "Frontend not healthy after 60s"; fi
    sleep 2
done

# ─── Seed data (dev only, skips existing) ─────────────────────────
if $WITH_SEED; then
  step "Running seed scripts"
  docker exec yotop10_backend node dist/scripts/seedCategories.js 2>/dev/null && ok "Categories seeded" || warn "Categories seed skipped (may already exist)"
  docker exec yotop10_backend node dist/scripts/seedPosts.js 2>/dev/null && ok "Posts seeded" || warn "Posts seed skipped (may already exist)"
fi

step "Verifying endpoints"
curl -sf -o /dev/null "http://127.0.0.1:3100/" && ok "Frontend (:3100) reachable" || warn "Frontend check failed"
curl -sf -o /dev/null "http://127.0.0.1:8100/api/health" && ok "Backend (:8100) reachable" || warn "Backend check failed"

step "Cleaning up old Docker images"
docker image prune -f 2>/dev/null && ok "Pruned unused images"

echo ""
ok "Rebuild complete — $DOMAIN is live"
