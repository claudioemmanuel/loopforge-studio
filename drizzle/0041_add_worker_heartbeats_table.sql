-- Migration: Add worker_heartbeats table
-- Date: 2026-02-01
-- Purpose: Track worker health and uptime with dedicated heartbeat records

-- Create worker_heartbeats table
CREATE TABLE IF NOT EXISTS "worker_heartbeats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "worker_id" text DEFAULT 'worker-1' NOT NULL,
  "timestamp" timestamp DEFAULT now() NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS "idx_worker_heartbeats_timestamp" ON "worker_heartbeats" ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS "idx_worker_heartbeats_worker_id" ON "worker_heartbeats" ("worker_id");
