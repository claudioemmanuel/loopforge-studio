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
MIGRATION_MAX_RETRIES=3
MIGRATION_RETRY_DELAY=5

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

# Run database migrations with retry logic
log_info "Running database migrations..."
attempt=1
while [ $attempt -le $MIGRATION_MAX_RETRIES ]; do
  if npx drizzle-kit migrate; then
    log_success "Migrations completed successfully"
    break
  else
    if [ $attempt -ge $MIGRATION_MAX_RETRIES ]; then
      log_error "Migrations failed after ${MIGRATION_MAX_RETRIES} attempts!"
      exit 1
    fi
    log_warn "Migration attempt ${attempt}/${MIGRATION_MAX_RETRIES} failed, retrying in ${MIGRATION_RETRY_DELAY}s..."
    sleep $MIGRATION_RETRY_DELAY
    attempt=$((attempt + 1))
  fi
done

# Verify schema was applied
log_info "Verifying database schema..."
if PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" psql -h ${DB_HOST:-postgres} -p ${DB_PORT:-5432} -U ${DB_USER:-postgres} -d loopforge -c "SELECT 1 FROM users LIMIT 1" > /dev/null 2>&1; then
  log_success "Schema verification passed"
else
  log_warn "Schema verification: users table not yet populated (this is expected on first run)"
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
