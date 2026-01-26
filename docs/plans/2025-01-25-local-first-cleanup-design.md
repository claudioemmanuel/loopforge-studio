# Local-First Cleanup Design

## Overview

Remove residual cloud/billing artifacts to prepare Loopforge Studio for open-source release as a purely local-first, self-hosted platform.

**Context:** Stripe integration was previously removed, but some artifacts remain in migrations, tests, and documentation.

**Goal:** Clean, consistent codebase with no references to managed billing, cloud deployment, or multi-tenant features.

---

## Files to Delete

| File | Reason |
|------|--------|
| `.github/workflows/db-migrate.yml` | References cloud staging/production environments |
| `__tests__/byok-fallback.test.ts` | Tests managed billing scenarios that no longer exist |

---

## Documentation Updates

### CLAUDE.MD
- Line 32: Remove `stripe` from API routes list
- Lines 100-102: Remove `subscriptions` table reference
- Lines 200-202: Replace "Billing Modes" with "API Key Model: BYOK only"
- Lines 288-291: Remove `APP_ANTHROPIC_API_KEY` and `STRIPE_*` env vars

### .env.example
- Line 29: Change "For production" → "For network access"

### SECURITY.md
- Line 39: Change "Use HTTPS in production" → "Use HTTPS if exposing to network"

---

## Database Cleanup

### New Migration: `0017_cleanup_billing_tables.sql`

```sql
-- Remove unused billing tables
DROP TABLE IF EXISTS "usage_records";
DROP TABLE IF EXISTS "user_subscriptions";
DROP TABLE IF EXISTS "subscription_plans";

-- Remove unused enums
DROP TYPE IF EXISTS "billing_cycle";
DROP TYPE IF EXISTS "subscription_status";
DROP TYPE IF EXISTS "billing_mode";

-- Remove unused columns
ALTER TABLE "users" DROP COLUMN IF EXISTS "billing_mode";
ALTER TABLE "users" DROP COLUMN IF EXISTS "stripe_customer_id";
```

### Test Setup Update

Update `__tests__/setup/setup.ts` to remove billing enum references that don't exist in the current schema.

---

## Implementation Order

1. Delete workflow and test files
2. Update documentation (CLAUDE.MD, .env.example, SECURITY.md)
3. Create cleanup migration
4. Update test setup
5. Run tests and build verification

---

## Verification

- [ ] All 450+ tests pass (minus the 27 deleted byok-fallback tests)
- [ ] Production build succeeds
- [ ] Docker build succeeds
- [ ] No references to Stripe, managed billing, or cloud deployment remain

---

*Design created: 2025-01-25*
