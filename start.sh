#!/bin/bash
set -e

echo "🚀 Loopforge Studio - Starting Development Environment"
echo "========================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm is not installed${NC}"
    echo "Install it with: npm install -g pnpm@9.0.0"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker is not running${NC}"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

echo -e "${YELLOW}📦 Step 1/5: Installing dependencies...${NC}"
pnpm install

echo ""
echo -e "${YELLOW}🐳 Step 2/5: Starting Docker services...${NC}"
docker compose -f docker-compose.dev.yml up -d

echo ""
echo -e "${YELLOW}🏥 Step 3/5: Waiting for services to be healthy...${NC}"
pnpm --filter @loopforge/api health

echo ""
echo -e "${YELLOW}🔧 Step 4/5: Running database migrations...${NC}"
pnpm --filter @loopforge/api db:setup

echo ""
echo -e "${YELLOW}🌐 Step 5/5: Starting web development server...${NC}"
echo ""
echo -e "${GREEN}✅ All services are ready!${NC}"
echo ""
echo -e "Access the application at: ${GREEN}http://localhost:3000${NC}"
echo ""
echo "Press Ctrl+C to stop the web server"
echo "To stop Docker services: ${YELLOW}pnpm docker:down${NC}"
echo ""

# Start web server
pnpm --filter @loopforge/web dev
