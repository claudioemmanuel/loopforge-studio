-- Ralph Loop Reliability Improvements (2026-01-29)
-- Add columns for stuck detection, recovery tracking, completion validation, and test gates

-- Add reliability tracking to executions table
ALTER TABLE "executions"
ADD COLUMN "stuck_signals" jsonb,
ADD COLUMN "recovery_attempts" jsonb,
ADD COLUMN "validation_report" jsonb;

-- Add test gate configuration to repos table
ALTER TABLE "repos"
ADD COLUMN "test_gate_policy" text DEFAULT 'warn',
ADD COLUMN "critical_test_patterns" jsonb DEFAULT '[]'::jsonb;

-- Create index for stuck signals (GIN index for JSONB queries)
CREATE INDEX IF NOT EXISTS "idx_executions_stuck_signals" ON "executions" USING GIN ("stuck_signals");

-- Add comments for documentation
COMMENT ON COLUMN "executions"."stuck_signals" IS 'JSONB array of stuck detection signals with type, severity, confidence, and evidence';
COMMENT ON COLUMN "executions"."recovery_attempts" IS 'JSONB array of recovery attempts with tier, success status, and modifications applied';
COMMENT ON COLUMN "executions"."validation_report" IS 'JSONB object containing completion validation results with score, checks, failures, and recommendations';
COMMENT ON COLUMN "repos"."test_gate_policy" IS 'Test gate enforcement policy: strict, warn, skip, or autoApprove';
COMMENT ON COLUMN "repos"."critical_test_patterns" IS 'JSONB array of test name patterns that are considered critical (e.g., ["auth", "payment", "security"])';
