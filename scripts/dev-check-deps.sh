#!/bin/sh

STALE=0
MISSING=0

check_stale() {
  DIR=$1
  if [ -f "$DIR/package.json" ] && [ -d "$DIR/node_modules" ]; then
    if [ "$DIR/package.json" -nt "$DIR/node_modules" ]; then
      STALE=1
      echo ""
      echo "  WARNING: $DIR/package.json is newer than node_modules/"
      echo "  You may have added a dependency. Run: docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build"
      echo ""
    fi
  fi
}

check_config() {
  FILE=$1
  LABEL=$2
  if [ ! -f "$FILE" ]; then
    MISSING=1
    echo "  ERROR: Missing $LABEL at $FILE"
  fi
}

# Validate critical frontend build config files
check_config /app/frontend/postcss.config.mjs "PostCSS config (required for Tailwind CSS v4)"
check_config /app/frontend/next.config.ts "Next.js config"
check_config /app/frontend/tsconfig.json "TypeScript config"

check_stale /app/frontend
check_stale /app/backend

if [ "$MISSING" -eq 1 ]; then
  echo ""
  echo "  >>> CRITICAL: One or more required config files are missing. <<<"
  echo "  >>> The frontend will NOT render correctly. Rebuild the image. <<<"
  echo "  >>> Run: docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build"
  echo ""
fi
