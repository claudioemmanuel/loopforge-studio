-- Create test database if it doesn't exist
SELECT 'CREATE DATABASE loopforge_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'loopforge_test')\gexec
