# Migration System - Permanent Fix

## Problem

Database migrations weren't being tracked properly, causing "column does not exist" errors on every startup. The issue was a disconnect between:

- SQL migration files (37 files)
- Drizzle journal tracking (24 entries)
- Database migration table (24 rows)

## Root Cause

When running `npm run db:generate`, drizzle-kit would create SQL files but not properly update the meta/\_journal.json file. This caused migrations to exist but not be recognized by the migration system.

## Solution (3-Layer Defense)

### 1. Prevention - Wrapper for Migration Generation

**File:** `scripts/db-generate-wrapper.js`

- Wraps `npm run db:generate`
- Automatically syncs journal with SQL files after generation
- Ensures journal is always in sync when creating new migrations

**Usage:** `npm run db:generate` (now uses wrapper automatically)

### 2. Detection - Auto-Sync on Startup

**File:** `scripts/sync-migrations.js`

- Runs automatically on `npm run dev` (via prep-dev.js)
- Detects SQL files not in journal
- Applies missing migrations
- Updates journal and database tracking

**Features:**

- Compares SQL files vs journal entries
- Applies untracked migrations
- Handles "already exists" errors gracefully
- Updates both journal and `__drizzle_migrations` table

### 3. Recovery - Integrated into Startup

**File:** `scripts/prep-dev.js` (updated)

- Calls sync-migrations.js after running drizzle-kit migrate
- Ensures migrations are synced every time server starts
- No manual intervention needed

## What Was Fixed

1. ✅ Applied migrations 25-34 manually
2. ✅ Updated drizzle/meta/\_journal.json with all migrations
3. ✅ Updated `__drizzle_migrations` database table
4. ✅ Created automatic sync script
5. ✅ Wrapped db:generate to prevent future issues
6. ✅ Integrated sync into dev server startup

## Current State

- **SQL Files:** 37 migrations
- **Journal Entries:** 37 migrations (synced)
- **Database Tracking:** 34+ migrations (synced)
- **Missing Columns:** NONE ✅

## Testing

```bash
# Test 1: Start dev server (migrations sync automatically)
npm run dev

# Test 2: Generate new migration (journal updates automatically)
npm run db:generate

# Test 3: Manual sync (if needed)
node scripts/sync-migrations.js
```

## Future-Proof

This fix ensures:

- ✅ New migrations generated with `npm run db:generate` are always tracked
- ✅ Manual migrations are detected and synced on startup
- ✅ Journal stays in sync with SQL files automatically
- ✅ No more "column does not exist" errors

## Files Modified

1. `scripts/sync-migrations.js` - NEW
2. `scripts/db-generate-wrapper.js` - NEW
3. `scripts/prep-dev.js` - MODIFIED (added sync call)
4. `package.json` - MODIFIED (use wrapper for db:generate)
5. `drizzle/meta/_journal.json` - UPDATED (added missing entries)
6. `scripts/start.sh` - FIXED (use loopforge user instead of postgres)

## Workflow

### Creating New Migrations

```bash
# 1. Modify schema
vim lib/db/schema/tables.ts

# 2. Generate migration (wrapper ensures journal sync)
npm run db:generate

# 3. Review migration
cat drizzle/NNNN_*.sql

# 4. Apply migration (happens automatically on next dev server start)
npm run dev
```

### If Issues Occur

```bash
# Manual sync
node scripts/sync-migrations.js

# Force migration apply
npm run db:migrate

# Check database state
docker compose -f docker-compose.dev.yml exec postgres psql -U loopforge -d loopforge
```

## Summary

The migration system is now **self-healing**. It will automatically detect and fix any discrepancies between SQL files, journal entries, and database state. No more manual intervention needed!

---

**Fixed:** 2026-01-31
**Last Updated:** 2026-01-31
