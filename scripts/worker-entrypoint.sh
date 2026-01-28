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
SCHEMA_WAIT_TIMEOUT=${SCHEMA_WAIT_TIMEOUT:-120}

log_info() {
  echo "${BLUE}[WORKER]${NC} $1"
}

log_success() {
  echo "${GREEN}[WORKER]${NC} $1"
}

log_warn() {
  echo "${YELLOW}[WORKER]${NC} $1"
}

log_error() {
  echo "${RED}[WORKER]${NC} $1"
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

# Wait for schema to be applied (by web container)
log_info "Waiting for database schema (timeout: ${SCHEMA_WAIT_TIMEOUT}s)..."
elapsed=0
while [ $elapsed -lt $SCHEMA_WAIT_TIMEOUT ]; do
  if PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h ${DB_HOST:-postgres} -p ${DB_PORT:-5432} -U ${DB_USER:-postgres} -d loopforge -c "SELECT 1 FROM users LIMIT 1" > /dev/null 2>&1; then
    log_success "Database schema is ready!"
    break
  fi
  elapsed=$((elapsed + DB_WAIT_INTERVAL))
  if [ $elapsed -ge $SCHEMA_WAIT_TIMEOUT ]; then
    log_warn "Schema wait timeout after ${SCHEMA_WAIT_TIMEOUT}s - proceeding anyway (schema may be applied lazily)"
    break
  fi
  log_info "Schema not ready, waiting... (${elapsed}s/${SCHEMA_WAIT_TIMEOUT}s)"
  sleep $DB_WAIT_INTERVAL
done

log_success "Starting worker..."
exec "$@"
