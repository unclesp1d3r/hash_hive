#!/usr/bin/env bash
# Database backup script for HashHive PostgreSQL
# Usage: ./scripts/db-backup.sh [output-dir]

set -euo pipefail

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="hashhive_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "Backing up HashHive database..."

if command -v docker &> /dev/null && docker compose ps postgres --status running &> /dev/null 2>&1; then
  # Docker Compose deployment
  docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-hashhive}" "${POSTGRES_DB:-hashhive}" \
    | gzip > "${BACKUP_DIR}/${FILENAME}"
else
  # Direct PostgreSQL connection
  pg_dump "${DATABASE_URL:?Set DATABASE_URL}" | gzip > "${BACKUP_DIR}/${FILENAME}"
fi

SIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo "Backup complete: ${BACKUP_DIR}/${FILENAME} (${SIZE})"

# Prune backups older than 30 days
find "$BACKUP_DIR" -name "hashhive_*.sql.gz" -mtime +30 -delete 2>/dev/null || true
echo "Pruned backups older than 30 days."
