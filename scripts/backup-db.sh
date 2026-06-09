#!/usr/bin/env bash
# ── backup-db.sh ── Backup MongoDB data before destructive operations
# Usage: bash /opt/yotop10/scripts/backup-db.sh [output-dir]

set -euo pipefail

BACKUP_DIR="${1:-./backups/$(date -u +%Y-%m-%d_%H-%M-%S)}"
MONGO_CONTAINER="yotop10_mongodb"
MONGO_USER="yotop10_admin"

if ! docker ps -q --filter "name=$MONGO_CONTAINER" | grep -q .; then
  echo "[Backup] MongoDB container '$MONGO_CONTAINER' is not running."
  exit 1
fi

MONGO_PASS=$(cat /opt/yotop10/secrets/mongo_password.txt 2>/dev/null || echo "")

if [ -z "$MONGO_PASS" ]; then
  echo "[Backup] Could not read MongoDB password from secrets file."
  exit 1
fi

mkdir -p "$BACKUP_DIR"
echo "[Backup] Dumping MongoDB to $BACKUP_DIR ..."

docker exec "$MONGO_CONTAINER" \
  mongodump --username "$MONGO_USER" --password "$MONGO_PASS" \
  --authenticationDatabase admin --db yotop10 \
  --archive > "$BACKUP_DIR/yotop10.archive"

echo "[Backup] Done — $(ls -lh "$BACKUP_DIR/yotop10.archive" | awk '{print $5}') saved."
echo "[Backup] Restore with: docker exec $MONGO_CONTAINER mongorestore --archive < $BACKUP_DIR/yotop10.archive"
