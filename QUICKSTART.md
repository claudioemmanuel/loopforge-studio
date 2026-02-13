# 🚀 Quick Start Guide

## One-Command Start (Recommended)

```bash
./start.sh
```

Or using pnpm:

```bash
pnpm dev:init
```

This will:
1. ✅ Install dependencies
2. ✅ Start Docker (PostgreSQL, Redis, API)
3. ✅ Wait for services to be healthy
4. ✅ Run database migrations
5. ✅ Start web server on **http://localhost:3000**

---

## Manual Start (Step by Step)

### 1. Start Docker Services

```bash
pnpm docker:up
```

### 2. Check Health (Wait ~10 seconds)

```bash
pnpm --filter @loopforge/api health
```

Expected output:
```
🏥 Running health checks...

✅ Database connection successful
✅ Redis connection successful

✅ All services are healthy!
```

### 3. Run Initialization (Migrations)

```bash
pnpm --filter @loopforge/api db:setup
```

Expected output:
```
🚀 Starting setup...

✅ Generating Prisma Client completed
✅ Running database migrations completed
✅ Setup completed successfully!
```

### 4. Start Web Server

```bash
pnpm --filter @loopforge/web dev
```

Access at: **http://localhost:3000**

---

## Common Commands

### Docker Management

```bash
# Start all services
pnpm docker:up

# Stop all services
pnpm docker:down

# View logs (follow mode)
pnpm docker:logs

# Restart API only
docker compose -f docker-compose.dev.yml restart api
```

### Database Operations

```bash
# Create new migration
pnpm --filter @loopforge/api db:migrate

# Generate Prisma Client only
pnpm --filter @loopforge/api db:generate

# Reset database (⚠️  WARNING: destroys all data)
pnpm --filter @loopforge/api db:reset
```

### Development

```bash
# Start both web + API (parallel)
pnpm dev

# Start web only
pnpm --filter @loopforge/web dev

# Start API only (from Docker)
docker compose -f docker-compose.dev.yml restart api
```

---

## Troubleshooting

### "Health check failed"

Wait 10-15 seconds after `pnpm docker:up`, then retry:
```bash
pnpm --filter @loopforge/api health
```

### "Column does not exist"

Run migrations:
```bash
pnpm --filter @loopforge/api db:setup
```

Or manually inside Docker:
```bash
docker compose -f docker-compose.dev.yml exec api npx prisma migrate deploy
```

### Web server shows proxy errors

Make sure API is running:
```bash
curl http://localhost:3001/health
```

If it fails, restart API:
```bash
docker compose -f docker-compose.dev.yml restart api
```

### Port already in use

Stop existing services:
```bash
pnpm docker:down

# Or kill specific ports
lsof -ti:3000 | xargs kill -9  # Web server
lsof -ti:3001 | xargs kill -9  # API server
lsof -ti:5432 | xargs kill -9  # PostgreSQL
lsof -ti:6379 | xargs kill -9  # Redis
```

---

## What's Running?

After `pnpm dev:init`:

| Service | Port | URL |
|---------|------|-----|
| Web (Vite) | 3000 | http://localhost:3000 |
| API (Fastify) | 3001 | http://localhost:3001 |
| PostgreSQL | 5432 | localhost:5432 |
| Redis | 6379 | localhost:6379 |

---

## Testing the New Features

### 1. Create a Task

1. Go to http://localhost:3000
2. Click "+ New Task"
3. Fill in details:
   - Title: "Add health endpoint test"
   - Description: "Create a Jest test for /health"
   - Repository: (select one)
   - ☐ Autonomous Mode: OFF (for first test)
4. Click "Create Task"

### 2. Watch the Workflow

- **Brainstorming** → Discuss requirements
- **Planning** → Generate execution plan
- **Ready** → Queued for execution
- **Executing** → **NEW**: Generates real TypeScript code (not markdown!)
- **Code Review** → **NEW**: View PR, approve or auto-merge
- **Done** → Complete!

### 3. Verify Real Code Generation

Check the PR on GitHub - it should contain actual `.ts` or `.tsx` files, not `.loopforge/steps/*.md` files!

### 4. Test Autonomous Mode

Create another task with **Autonomous Mode** enabled. The PR will auto-merge when CI passes (no manual approval needed).

---

## Environment Variables

The `.env.local` file is already configured for local development:

```env
DATABASE_URL="postgresql://loopforge:loopforge@localhost:5432/loopforge"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="dev-secret"
ENCRYPTION_KEY="dev-encryption-key-32chars!!"
```

For production, create `.env` with real credentials.

---

## Next Steps

1. **Connect GitHub**: Set up GitHub OAuth in settings
2. **Connect Repository**: Link a test repository
3. **Create Tasks**: Test the real code generation!
4. **Review PRs**: See actual TypeScript code in pull requests

---

**Need more details?** See [SETUP.md](./SETUP.md) for comprehensive documentation.
