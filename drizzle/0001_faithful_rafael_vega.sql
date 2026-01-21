CREATE TYPE "public"."billing_mode" AS ENUM('byok', 'managed');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "billing_mode" "billing_mode";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;