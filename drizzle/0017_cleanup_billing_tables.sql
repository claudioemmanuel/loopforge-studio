-- Cleanup: Remove unused billing tables from old Stripe integration
-- These tables were created but never used after switching to BYOK-only model

-- Remove unused columns from users table FIRST (before dropping types they depend on)
ALTER TABLE "users" DROP COLUMN IF EXISTS "billing_mode";
ALTER TABLE "users" DROP COLUMN IF EXISTS "stripe_customer_id";

-- Remove unused billing tables
DROP TABLE IF EXISTS "usage_records";
DROP TABLE IF EXISTS "user_subscriptions";
DROP TABLE IF EXISTS "subscription_plans";

-- Remove unused enums (after columns that depend on them are gone)
DROP TYPE IF EXISTS "billing_cycle";
DROP TYPE IF EXISTS "subscription_status";
DROP TYPE IF EXISTS "billing_mode";
