ALTER TABLE tasks ADD COLUMN status_history JSONB DEFAULT '[]'::jsonb;
