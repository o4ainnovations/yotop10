#!/bin/sh

check_stale() {
  DIR=$1
  if [ -f "$DIR/package.json" ] && [ -d "$DIR/node_modules" ]; then
    if [ "$DIR/package.json" -nt "$DIR/node_modules" ]; then
      echo ""
      echo "  WARNING: $DIR/package.json is newer than node_modules/"
      echo "  You may have added a dependency. Run: docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build"
      echo ""
    fi
  fi
}

check_stale /app/frontend
check_stale /app/backend
