#!/bin/sh
set -e

# Colors for logging
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_WAIT_TIMEOUT=${DB_WAIT_TIMEOUT:-60}
DB_WAIT_INTERVAL=2

log_info() {
  echo "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
  echo "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo "${RED}[ERROR]${NC} $1"
}

# Wait for database with timeout
log_info "Waiting for database (timeout: ${DB_WAIT_TIMEOUT}s)..."
elapsed=0
until pg_isready -h ${DB_HOST:-postgres} -p ${DB_PORT:-5432} -U ${DB_USER:-postgres} > /dev/null 2>&1; do
  elapsed=$((elapsed + DB_WAIT_INTERVAL))
  if [ $elapsed -ge $DB_WAIT_TIMEOUT ]; then
    log_error "Database connection timeout after ${DB_WAIT_TIMEOUT}s"
    exit 1
  fi
  log_info "Database not ready, waiting... (${elapsed}s/${DB_WAIT_TIMEOUT}s)"
  sleep $DB_WAIT_INTERVAL
done

log_success "Database is ready!"

# Sync database schema
log_info "Syncing database schema..."
if npx drizzle-kit push --force; then
  log_success "Schema sync completed successfully"
else
  log_error "Schema sync failed!"
  exit 1
fi

# Run seed script (non-fatal)
log_info "Running database seed..."
if npx tsx lib/db/seed.ts; then
  log_success "Seed completed successfully"
else
  log_warn "Seed script failed (this is non-fatal, continuing...)"
fi

log_success "Starting application..."
exec "$@"
