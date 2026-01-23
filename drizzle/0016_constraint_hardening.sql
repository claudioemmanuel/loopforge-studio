-- Migration: Add constraints for data integrity
-- This migration adds CHECK constraints, NOT NULL fixes, and unique indexes

-- =====================================================
-- NOT NULL FIXES
-- =====================================================

-- First update any NULL processing_progress values to 0
UPDATE tasks SET processing_progress = 0 WHERE processing_progress IS NULL;

-- Then make processing_progress NOT NULL with default
ALTER TABLE tasks ALTER COLUMN processing_progress SET NOT NULL;
ALTER TABLE tasks ALTER COLUMN processing_progress SET DEFAULT 0;

-- =====================================================
-- CHECK CONSTRAINTS
-- =====================================================

-- subscription_plans: Ensure positive pricing
ALTER TABLE subscription_plans
ADD CONSTRAINT chk_positive_pricing
CHECK (price_monthly > 0 AND price_yearly > 0);

-- usage_records: Ensure non-negative values
ALTER TABLE usage_records
ADD CONSTRAINT chk_non_negative_tokens
CHECK (input_tokens >= 0 AND output_tokens >= 0 AND cost_cents >= 0);

-- executions: Ensure non-negative iteration
ALTER TABLE executions
ADD CONSTRAINT chk_non_negative_iteration
CHECK (iteration >= 0);

-- subscription_plans: Ensure positive task limit
ALTER TABLE subscription_plans
ADD CONSTRAINT chk_positive_task_limit
CHECK (task_limit > 0);

-- subscription_plans: Ensure valid grace percent
ALTER TABLE subscription_plans
ADD CONSTRAINT chk_valid_grace_percent
CHECK (grace_percent >= 0 AND grace_percent <= 100);

-- =====================================================
-- UNIQUE CONSTRAINTS (additional integrity)
-- =====================================================

-- Prevent multiple active subscriptions per user
-- (user can have canceled subscriptions but only one active)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_user_active_subscription
ON user_subscriptions(user_id)
WHERE status = 'active';

-- Branch uniqueness within repo (prevent branch name conflicts)
-- Only applies when branch is set
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_task_branch_unique
ON tasks(repo_id, branch)
WHERE branch IS NOT NULL;

-- =====================================================
-- FK CONSTRAINT FIXES
-- =====================================================

-- Note: planId FK already exists without ON DELETE
-- We cannot easily change it without dropping and recreating
-- For now, document that orphaned subscriptions need cleanup if plan deleted
-- Future migration should handle this properly with data migration
