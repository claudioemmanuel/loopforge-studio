-- Add model preference columns to users table
ALTER TABLE "users" ADD COLUMN "preferred_anthropic_model" text DEFAULT 'claude-sonnet-4-20250514';
ALTER TABLE "users" ADD COLUMN "preferred_openai_model" text DEFAULT 'gpt-4o';
ALTER TABLE "users" ADD COLUMN "preferred_gemini_model" text DEFAULT 'gemini-2.5-pro';
