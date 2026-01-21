ALTER TYPE "public"."ai_provider" ADD VALUE 'gemini';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gemini_encrypted_api_key" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gemini_api_key_iv" text;