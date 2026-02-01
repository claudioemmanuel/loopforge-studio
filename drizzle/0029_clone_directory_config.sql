-- Migration: Add default_clone_directory column to users table
-- Date: 2026-01-29

ALTER TABLE "users" ADD COLUMN "default_clone_directory" text;
