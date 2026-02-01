#!/bin/bash

# Loopforge Studio - One-Command Setup Script
# ============================================
# This script sets up and starts Loopforge Studio with all required services.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Change to project directory
cd "$PROJECT_DIR"

# Helper functions
print_header() {
    echo ""
    echo -e "${BLUE}${BOLD}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}${BOLD}  $1${NC}"
    echo -e "${BLUE}${BOLD}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_step() {
    echo -e "${CYAN}▶${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if a command exists
check_command() {
    if ! command -v "$1" &> /dev/null; then
        return 1
    fi
    return 0
}

# Wait for a service to be healthy with retries
wait_for_health() {
    local url="$1"
    local name="$2"
    local max_attempts="${3:-30}"
    local attempt=1

    echo -n -e "${CYAN}⏳${NC} Waiting for $name to be ready"

    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$url" > /dev/null 2>&1; then
            echo ""
            print_success "$name is ready!"
            return 0
        fi
        echo -n "."
        sleep 2
        ((attempt++))
    done

    echo ""
    print_error "$name failed to start after $max_attempts attempts"
    return 1
}

# Wait for PostgreSQL to be ready
wait_for_postgres() {
    local max_attempts="${1:-30}"
    local attempt=1

    echo -n -e "${CYAN}⏳${NC} Waiting for PostgreSQL to be ready"

    while [ $attempt -le $max_attempts ]; do
        if docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; then
            echo ""
            print_success "PostgreSQL is ready!"
            return 0
        fi
        echo -n "."
        sleep 2
        ((attempt++))
    done

    echo ""
    print_error "PostgreSQL failed to start after $max_attempts attempts"
    return 1
}

# Main script starts here
print_header "Loopforge Studio - One-Command Setup"

# Step 1: Check prerequisites
print_step "Checking prerequisites..."

MISSING_PREREQS=()

if ! check_command docker; then
    MISSING_PREREQS+=("docker")
fi

if ! docker compose version > /dev/null 2>&1; then
    if ! docker-compose version > /dev/null 2>&1; then
        MISSING_PREREQS+=("docker compose")
    fi
fi

if ! check_command openssl; then
    MISSING_PREREQS+=("openssl")
fi

if [ ${#MISSING_PREREQS[@]} -gt 0 ]; then
    print_error "Missing required tools: ${MISSING_PREREQS[*]}"
    echo ""
    echo "Please install the following:"
    for prereq in "${MISSING_PREREQS[@]}"; do
        echo "  - $prereq"
    done
    echo ""
    echo "Installation guides:"
    echo "  Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

print_success "All prerequisites installed"

# Check if Docker daemon is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker daemon is not running"
    echo "Please start Docker Desktop or the Docker daemon and try again."
    exit 1
fi

print_success "Docker daemon is running"

# Step 2: Handle environment configuration
print_step "Configuring environment..."

ENV_FILE="$PROJECT_DIR/.env"
ENV_EXAMPLE="$PROJECT_DIR/.env.example"

# Load existing .env if it exists
if [ -f "$ENV_FILE" ]; then
    source "$ENV_FILE" 2>/dev/null || true
fi

# Check for required GitHub OAuth credentials
NEED_GITHUB_CREDS=false

if [ -z "$GITHUB_CLIENT_ID" ] || [ "$GITHUB_CLIENT_ID" = "your_github_client_id" ]; then
    NEED_GITHUB_CREDS=true
fi

if [ -z "$GITHUB_CLIENT_SECRET" ] || [ "$GITHUB_CLIENT_SECRET" = "your_github_client_secret" ]; then
    NEED_GITHUB_CREDS=true
fi

if [ "$NEED_GITHUB_CREDS" = true ]; then
    echo ""
    print_warning "GitHub OAuth credentials not configured"
    echo ""
    echo "To get these credentials:"
    echo "  1. Go to https://github.com/settings/developers"
    echo "  2. Click 'New OAuth App'"
    echo "  3. Set Homepage URL: http://localhost:3000"
    echo "  4. Set Callback URL: http://localhost:3000/api/auth/callback/github"
    echo ""

    read -p "Enter your GitHub Client ID: " INPUT_GITHUB_CLIENT_ID
    read -p "Enter your GitHub Client Secret: " INPUT_GITHUB_CLIENT_SECRET

    if [ -z "$INPUT_GITHUB_CLIENT_ID" ] || [ -z "$INPUT_GITHUB_CLIENT_SECRET" ]; then
        print_error "GitHub credentials are required to continue"
        exit 1
    fi

    GITHUB_CLIENT_ID="$INPUT_GITHUB_CLIENT_ID"
    GITHUB_CLIENT_SECRET="$INPUT_GITHUB_CLIENT_SECRET"
fi

# Generate secrets if needed
if [ -z "$NEXTAUTH_SECRET" ]; then
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    print_info "Generated new NEXTAUTH_SECRET"
fi

if [ -z "$ENCRYPTION_KEY" ]; then
    ENCRYPTION_KEY=$(openssl rand -hex 32)
    print_info "Generated new ENCRYPTION_KEY"
fi

# Create/update .env file
cat > "$ENV_FILE" << EOF
# Loopforge Studio Environment Configuration
# ====================================
# Auto-generated by start.sh

# Database
DATABASE_URL=postgresql://loopforge:loopforge@localhost:5432/loopforge
DATABASE_URL_DOCKER=postgresql://loopforge:loopforge@postgres:5432/loopforge

# Redis
REDIS_URL=redis://localhost:6379
REDIS_URL_DOCKER=redis://redis:6379

# GitHub OAuth
GITHUB_CLIENT_ID=$GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET=$GITHUB_CLIENT_SECRET

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$NEXTAUTH_SECRET

# Encryption
ENCRYPTION_KEY=$ENCRYPTION_KEY

# Application
NODE_ENV=development
EOF

print_success "Environment configured"

# Step 3: Build and start containers
print_step "Building Docker containers..."

docker compose build --quiet
print_success "Containers built"

print_step "Starting services..."

docker compose up -d
print_success "Services starting..."

# Step 4: Wait for PostgreSQL
print_step "Waiting for database..."

if ! wait_for_postgres 30; then
    print_error "Database failed to start. Check logs with: docker compose logs db"
    exit 1
fi

# Step 5: Run migrations
print_step "Running database migrations..."

# Run migrations from host (drizzle-kit is a dev dependency not in container)
# Use DATABASE_URL pointing to the Docker PostgreSQL with loopforge user
DATABASE_URL="postgresql://loopforge:loopforge@localhost:5432/loopforge" npm run db:migrate 2>/dev/null || {
    # Fallback: try after a short delay
    sleep 5
    DATABASE_URL="postgresql://loopforge:loopforge@localhost:5432/loopforge" npm run db:migrate
}

print_success "Database migrations complete"

# Step 6: Wait for web service
print_step "Waiting for web service..."

if ! wait_for_health "http://localhost:3000/api/health" "Web service" 60; then
    print_error "Web service failed to start. Check logs with: docker compose logs web"
    exit 1
fi

# Success!
print_header "Loopforge Studio is Ready!"

echo -e "${GREEN}${BOLD}Your Loopforge Studio instance is now running!${NC}"
echo ""
echo "  URL:     http://localhost:3000"
echo "  Status:  http://localhost:3000/api/health"
echo ""
echo "Next steps:"
echo "  1. Open http://localhost:3000 in your browser"
echo "  2. Sign in with GitHub"
echo "  3. Add your AI provider API key in Settings"
echo ""
echo "Useful commands:"
echo "  docker compose logs -f     View logs"
echo "  docker compose down        Stop services"
echo "  docker compose restart     Restart services"
echo ""
print_success "Setup complete!"
