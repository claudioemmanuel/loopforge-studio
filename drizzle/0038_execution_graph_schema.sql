-- Migration: Add execution graph support for DAG visualization
-- Created: 2026-02-01

-- Add executionGraph JSONB column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS execution_graph JSONB;

-- Add agentType field to execution_events for agent classification
ALTER TABLE execution_events ADD COLUMN IF NOT EXISTS agent_type VARCHAR(20);

-- Add index for faster graph queries
CREATE INDEX IF NOT EXISTS idx_tasks_execution_graph ON tasks USING gin (execution_graph);

-- Add index for filtering events by agent type
CREATE INDEX IF NOT EXISTS idx_execution_events_agent_type ON execution_events (agent_type);

-- Add comment describing the structure
COMMENT ON COLUMN tasks.execution_graph IS 'DAG visualization data: { nodes: [], edges: [], metadata: {} }';
COMMENT ON COLUMN execution_events.agent_type IS 'Agent classification: test | backend | frontend | general';
