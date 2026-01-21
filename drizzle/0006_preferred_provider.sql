-- Add preferred_provider column to users table
ALTER TABLE "users" ADD COLUMN "preferred_provider" "ai_provider" DEFAULT 'anthropic';
