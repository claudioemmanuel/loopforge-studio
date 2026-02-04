-- Domain Events table for DDD architecture
CREATE TABLE "domain_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_type" text NOT NULL,
  "aggregate_id" text NOT NULL,
  "aggregate_type" text NOT NULL,
  "occurred_at" timestamp DEFAULT now() NOT NULL,
  "persisted_at" timestamp DEFAULT now() NOT NULL,
  "data" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "version" integer DEFAULT 1 NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX "idx_domain_events_event_type" ON "domain_events" ("event_type");
CREATE INDEX "idx_domain_events_aggregate" ON "domain_events" ("aggregate_type", "aggregate_id");
CREATE INDEX "idx_domain_events_occurred_at" ON "domain_events" ("occurred_at" DESC);
