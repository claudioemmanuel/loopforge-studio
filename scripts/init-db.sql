-- ============================================
-- Loopforge Studio Database Initialization
-- ============================================
-- This script runs automatically when PostgreSQL container
-- is created for the first time (via /docker-entrypoint-initdb.d/)
--
-- Creates:
--   1. loopforge user (application user)
--   2. loopforge database (if not exists)
--   3. Grants permissions
-- ============================================

-- Create loopforge user if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'loopforge') THEN
    CREATE ROLE loopforge WITH LOGIN PASSWORD 'loopforge';
    RAISE NOTICE 'Created role: loopforge';
  ELSE
    RAISE NOTICE 'Role already exists: loopforge';
  END IF;
END
$$;

-- Grant database creation privilege (needed for migrations)
ALTER ROLE loopforge CREATEDB;

-- Grant permissions on loopforge database
GRANT ALL PRIVILEGES ON DATABASE loopforge TO loopforge;

-- Grant schema permissions
GRANT ALL PRIVILEGES ON SCHEMA public TO loopforge;

-- Grant default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO loopforge;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO loopforge;

-- If the database already exists, grant permissions on existing objects
\c loopforge
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO loopforge;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO loopforge;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO loopforge;

-- Set owner of public schema
ALTER SCHEMA public OWNER TO loopforge;
