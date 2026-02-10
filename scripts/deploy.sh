#!/usr/bin/env bash
# HashHive deployment script
# Usage: ./scripts/deploy.sh [build|up|down|migrate|status]

set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"

case "${1:-up}" in
  build)
    echo "Building production images..."
    docker compose -f "$COMPOSE_FILE" build
    ;;
  up)
    echo "Starting HashHive..."
    docker compose -f "$COMPOSE_FILE" up -d
    echo ""
    echo "Waiting for services to become healthy..."
    docker compose -f "$COMPOSE_FILE" ps
    ;;
  down)
    echo "Stopping HashHive..."
    docker compose -f "$COMPOSE_FILE" down
    ;;
  migrate)
    echo "Running database migrations..."
    docker compose -f "$COMPOSE_FILE" exec backend \
      bun packages/backend/node_modules/.bin/drizzle-kit migrate
    ;;
  status)
    docker compose -f "$COMPOSE_FILE" ps
    echo ""
    echo "Health checks:"
    curl -sf http://localhost:${BACKEND_PORT:-4000}/health 2>/dev/null \
      && echo " [Backend: OK]" \
      || echo " [Backend: UNREACHABLE]"
    curl -sf http://localhost:${FRONTEND_PORT:-80}/ 2>/dev/null \
      && echo " [Frontend: OK]" \
      || echo " [Frontend: UNREACHABLE]"
    ;;
  logs)
    docker compose -f "$COMPOSE_FILE" logs -f "${2:-}"
    ;;
  *)
    echo "Usage: $0 {build|up|down|migrate|status|logs [service]}"
    exit 1
    ;;
esac
