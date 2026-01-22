-- Add autonomous_mode column to tasks table
ALTER TABLE "tasks" ADD COLUMN "autonomous_mode" boolean DEFAULT false NOT NULL;
