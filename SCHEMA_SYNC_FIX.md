# Schema Sync Issue - Fixed

## Problem

Schema file (`lib/db/schema/tables.ts`) defined columns that were never migrated to the database:

- `repos.auto_approve`
- `repos.test_gate_policy`
- `repos.critical_test_patterns`

This caused runtime errors: `column "auto_approve" does not exist`

## Root Cause

1. Schema was updated in TypeScript
2. Migration was never generated with `npm run db:generate`
3. Code tried to query non-existent columns
4. No validation caught the mismatch

## Fix Applied

### 1. Added Missing Columns

Created migration `0036_repos_auto_approve.sql` with:

```sql
ALTER TABLE repos ADD COLUMN auto_approve boolean NOT NULL DEFAULT false;
ALTER TABLE repos ADD COLUMN test_gate_policy text DEFAULT 'warn';
ALTER TABLE repos ADD COLUMN critical_test_patterns jsonb DEFAULT '[]';
```

### 2. Updated Tracking

- Added migration to `drizzle/meta/_journal.json`
- Added to `__drizzle_migrations` database table
- Total migrations: 36 tracked, 37 SQL files

### 3. Applied to Database

Columns now exist with proper defaults and constraints.

## Prevention Strategy

### Rule: Schema Changes Require Migrations

```bash
# ALWAYS follow this sequence:

# 1. Modify schema
vim lib/db/schema/tables.ts

# 2. Generate migration (answers prompts about renames)
npm run db:generate

# 3. Review migration
cat drizzle/NNNN_*.sql

# 4. Test locally
npm run dev  # Migrations apply automatically

# 5. Commit both schema and migration
git add lib/db/schema/tables.ts drizzle/NNNN_*.sql drizzle/meta/
git commit -m "feat: add column X to table Y"
```

### Validation Added

The `scripts/sync-migrations.js` script now runs on every `npm run dev` and:

- Detects SQL files not in journal
- Applies missing migrations
- Updates tracking automatically

## Testing

```bash
# Test schema is valid
curl http://localhost:3000/api/health
# Should return: "schemaValid": true, "missingColumns": []

# Test repos endpoint
curl http://localhost:3000/api/repos
# Should not error with "column does not exist"
```

## Future Improvements

Consider adding:

1. Pre-commit hook to detect schema changes without migrations
2. CI check that compares schema to migration files
3. Automated schema drift detection on startup

---

**Fixed:** 2026-01-31
**Migrations Added:** 0036_repos_auto_approve.sql
**Total Migrations:** 37
