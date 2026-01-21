CREATE TYPE "public"."ai_provider" AS ENUM('anthropic', 'openai');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "openai_encrypted_api_key" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "openai_api_key_iv" text;