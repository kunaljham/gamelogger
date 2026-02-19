#!/bin/bash
#
# Seed Data Script for GameLogger
# ================================
# Thin wrapper around POST /api/admin/seed.
# Deletes existing data for the user, then seeds 25 opponents and 33 matches.
# Idempotent — safe to run multiple times.
#
# Prerequisites:
#   - jq installed: brew install jq
#
# Usage:
#   ./seed-data.sh                         # Seed local dev user
#   ./seed-data.sh --demo                  # Seed demo user locally
#   ./seed-data.sh --env prod --demo       # Seed demo user in production
#
# Environments:
#   local (default)  → http://localhost:8080
#   staging          → https://staging-api.gamelogger.app
#   prod             → https://api.gamelogger.app
#
# The ADMIN_SECRET for staging/prod must be set as an env var.
# For local dev it defaults to "local-dev-secret" (matching backend/.env).

set -euo pipefail

# Defaults
ENV="local"
EMAIL="seed-user@example.com"

# Parse flags
while [[ $# -gt 0 ]]; do
  case "$1" in
    --env)
      ENV="${2:-}"
      if [ -z "$ENV" ]; then
        echo "ERROR: --env requires a value (local, staging, prod)"
        exit 1
      fi
      shift 2
      ;;
    --demo)
      EMAIL="demo@gamelogger.app"
      shift
      ;;
    *)
      echo "Unknown flag: $1"
      echo "Usage: ./seed-data.sh [--env local|staging|prod] [--demo]"
      exit 1
      ;;
  esac
done

# Set BASE_URL and ADMIN_SECRET based on environment
case "$ENV" in
  local)
    BASE_URL="${SEED_BASE_URL:-http://localhost:8080}"
    ADMIN_SECRET="${ADMIN_SECRET:-local-dev-secret}"
    ;;
  staging)
    BASE_URL="https://staging-api.gamelogger.app"
    if [ -z "${ADMIN_SECRET:-}" ]; then
      echo "ERROR: ADMIN_SECRET env var is required for staging"
      echo "  export ADMIN_SECRET=<your-staging-secret>"
      exit 1
    fi
    ;;
  prod)
    BASE_URL="https://api.gamelogger.app"
    if [ -z "${ADMIN_SECRET:-}" ]; then
      echo "ERROR: ADMIN_SECRET env var is required for production"
      echo "  export ADMIN_SECRET=<your-production-secret>"
      exit 1
    fi
    ;;
  *)
    echo "ERROR: Unknown environment '$ENV'. Use: local, staging, prod"
    exit 1
    ;;
esac

echo ""
echo "Seeding GameLogger..."
echo "  Environment: $ENV"
echo "  Email:       $EMAIL"
echo "  URL:         $BASE_URL"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/admin/seed" \
  -H "Content-Type: application/json" \
  -H "X-Admin-Secret: $ADMIN_SECRET" \
  -d "{\"email\": \"$EMAIL\"}")

# Split response body and status code
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
  echo "Success!"
  echo "$BODY" | jq .
else
  echo "ERROR (HTTP $HTTP_CODE):"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
  exit 1
fi
echo ""
