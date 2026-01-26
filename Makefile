# Loopforge Studio Makefile
# ==========================
# Convenience commands for local development

.PHONY: help start install dev build test docker-dev docker-build docker-up docker-down docker-logs clean

# Default target
help:
	@echo "Loopforge Studio - AI-Powered Development Platform"
	@echo ""
	@echo "Quick Start:"
	@echo "  make start        One-command setup (recommended)"
	@echo ""
	@echo "Development:"
	@echo "  make install      Install dependencies"
	@echo "  make dev          Start development server (requires Redis)"
	@echo "  make dev-docker   Start Redis via Docker, then dev server"
	@echo "  make build        Build for production"
	@echo "  make test         Run tests"
	@echo "  make lint         Run linter"
	@echo ""
	@echo "Database:"
	@echo "  make db-generate  Generate Drizzle migrations"
	@echo "  make db-migrate   Run migrations"
	@echo "  make db-studio    Open Drizzle Studio"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-dev   Start Redis only (for local dev)"
	@echo "  make docker-build Build all containers"
	@echo "  make docker-up    Start all containers"
	@echo "  make docker-down  Stop all containers"
	@echo "  make docker-logs  View container logs"
	@echo ""
	@echo "Utilities:"
	@echo "  make clean        Remove build artifacts"

# One-command setup
start:
	./scripts/start.sh

# Development
install:
	npm install

dev:
	npm run dev

dev-docker:
	docker compose -f docker-compose.dev.yml up -d
	npm run dev

build:
	npm run build

test:
	npm run test:run

lint:
	npm run lint

# Database
db-generate:
	npm run db:generate

db-migrate:
	npm run db:migrate

db-studio:
	npm run db:studio

# Docker
docker-dev:
	docker compose -f docker-compose.dev.yml up -d
	@echo "Redis started at localhost:6379"
	@echo "Bull Board at http://localhost:3001"

docker-build:
	docker compose build

docker-up:
	docker compose up -d
	@echo "Loopforge Studio started at http://localhost:3000"

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

docker-clean:
	docker compose down -v --rmi local

# Utilities
clean:
	rm -rf .next
	rm -rf node_modules
	rm -rf coverage
	rm -f *.db
