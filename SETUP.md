# Loopforge Studio - Setup & Development Guide

## Quick Start (Recommended)

Run this single command to start everything:

```bash
pnpm dev:init
```

This command will:
1. ✅ Start Docker services (PostgreSQL, Redis, API)
2. ✅ Wait for database and Redis to be healthy
3. ✅ Run database migrations
4. ✅ Generate Prisma Client
5. ✅ Start the web development server

Then open **http://localhost:3000/** in your browser.

---

## Manual Setup (Step by Step)

If you prefer to run each step manually:

### 1. Start Docker Services

```bash
pnpm docker:up
```

This starts:
- PostgreSQL (port 5432)
- Redis (port 6379)
- API server (port 3001)

### 2. Check Health Status

```bash
pnpm --filter @loopforge/api health
```

Wait until you see:
```
✅ Database connection successful
✅ Redis connection successful
✅ All services are healthy!
```

### 3. Run Migrations & Initialization

```bash
pnpm --filter @loopforge/api db:setup
```

This will:
- Generate Prisma Client
- Run database migrations

### 4. Start Web Development Server

```bash
pnpm --filter @loopforge/web dev
```

Or use the combined command:
```bash
pnpm --filter @loopforge/web dev:init
```

---

## Available Commands

### Root Level Commands

| Command | Description |
|---------|-------------|
| `pnpm dev:init` | Complete initialization + start web server |
| `pnpm dev` | Start all services in parallel (skip health checks) |
| `pnpm docker:up` | Start Docker services |
| `pnpm docker:down` | Stop Docker services |
| `pnpm docker:logs` | View Docker logs (follow mode) |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |

### API Commands

| Command | Description |
|---------|-------------|
| `pnpm --filter @loopforge/api health` | Check database and Redis health |
| `pnpm --filter @loopforge/api db:setup` | Run migrations and generate Prisma Client |
| `pnpm --filter @loopforge/api dev` | Start API in watch mode |
| `pnpm --filter @loopforge/api db:migrate` | Create and apply new migration |
| `pnpm --filter @loopforge/api db:generate` | Generate Prisma Client only |
| `pnpm --filter @loopforge/api db:seed` | Seed database with test data |
| `pnpm --filter @loopforge/api db:reset` | Reset database (WARNING: destroys data) |

### Web Commands

| Command | Description |
|---------|-------------|
| `pnpm --filter @loopforge/web dev:init` | Health check + setup + start web |
| `pnpm --filter @loopforge/web dev` | Start web dev server only |
| `pnpm --filter @loopforge/web build` | Build for production |
| `pnpm --filter @loopforge/web preview` | Preview production build |

---

## Docker Management

### View Logs

```bash
# All services
pnpm docker:logs

# Specific service
docker compose -f docker-compose.dev.yml logs -f api
docker compose -f docker-compose.dev.yml logs -f db
docker compose -f docker-compose.dev.yml logs -f redis
```

### Restart Services

```bash
# Restart all
docker compose -f docker-compose.dev.yml restart

# Restart specific service
docker compose -f docker-compose.dev.yml restart api
```

### Clean Restart

```bash
pnpm docker:down
pnpm docker:up
```

---

## Troubleshooting

### "Database connection failed"

1. Check if PostgreSQL container is running:
   ```bash
   docker compose -f docker-compose.dev.yml ps
   ```

2. Check database logs:
   ```bash
   docker compose -f docker-compose.dev.yml logs db
   ```

3. Restart database:
   ```bash
   docker compose -f docker-compose.dev.yml restart db
   ```

### "Redis connection failed"

1. Check Redis status:
   ```bash
   docker compose -f docker-compose.dev.yml logs redis
   ```

2. Restart Redis:
   ```bash
   docker compose -f docker-compose.dev.yml restart redis
   ```

### "Column does not exist" Error

You need to run migrations:

```bash
# From root
pnpm --filter @loopforge/api db:setup

# Or inside API container
docker compose -f docker-compose.dev.yml exec api npx prisma migrate deploy
```

### API Not Starting

1. Check API logs:
   ```bash
   docker compose -f docker-compose.dev.yml logs -f api
   ```

2. Restart API:
   ```bash
   docker compose -f docker-compose.dev.yml restart api
   ```

### Web Server Proxy Errors

Make sure the API is running on port 3001:

```bash
curl http://localhost:3001/health
```

If it fails, check API container status and logs.

---

## Development Workflow

### Starting a New Session

```bash
# One command to rule them all
pnpm dev:init
```

### Stopping Everything

```bash
# Stop Docker services (keeps data)
pnpm docker:down

# Stop web server: Ctrl+C in terminal
```

### Making Schema Changes

1. Edit `apps/api/prisma/schema.prisma`
2. Create migration:
   ```bash
   pnpm --filter @loopforge/api db:migrate
   ```
3. Restart API to apply changes:
   ```bash
   docker compose -f docker-compose.dev.yml restart api
   ```

### Testing Execution Worker Changes

The execution worker runs inside the API container and watches for file changes automatically. When you edit files in `apps/api/src/workers/`, the API will reload.

---

## Production Deployment

```bash
# Build all packages
pnpm build

# Run migrations (production mode)
pnpm --filter @loopforge/api db:migrate:prod

# Start API
pnpm --filter @loopforge/api start
```

---

## Environment Variables

Create `.env` files:

### `apps/api/.env`

```env
DATABASE_URL="postgresql://loopforge:loopforge@localhost:5432/loopforge"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key"
GITHUB_CLIENT_ID="your-github-oauth-client-id"
GITHUB_CLIENT_SECRET="your-github-oauth-secret"
ENCRYPTION_KEY="32-character-encryption-key"
```

### `apps/web/.env`

```env
VITE_API_URL="http://localhost:3001"
```

---

## Health Check Details

The `pnpm --filter @loopforge/api health` command:
- Attempts connection **10 times** with **2-second delays**
- Total max wait time: **20 seconds**
- Tests both PostgreSQL and Redis connectivity
- Returns exit code 0 on success, 1 on failure

Perfect for CI/CD pipelines and automated deployments!
