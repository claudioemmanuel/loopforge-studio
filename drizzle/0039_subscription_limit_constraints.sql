-- Migration: Add subscription limit enforcement at database level
-- Prevents race conditions by blocking inserts that would exceed tier limits

-- Add trigger function to enforce repository limits
CREATE OR REPLACE FUNCTION check_repo_limit()
RETURNS TRIGGER AS $$
DECLARE
  user_tier TEXT;
  max_repos INT;
  current_count INT;
BEGIN
  -- Get user's subscription tier
  SELECT subscription_tier INTO user_tier
  FROM users WHERE id = NEW.user_id;

  -- Get max repos for tier
  max_repos := CASE user_tier
    WHEN 'free' THEN 1
    WHEN 'pro' THEN 20
    WHEN 'enterprise' THEN -1  -- unlimited
    ELSE 1  -- default to free
  END;

  -- Skip check for enterprise (unlimited)
  IF max_repos = -1 THEN
    RETURN NEW;
  END IF;

  -- Count current repos for user (excluding the one being inserted)
  SELECT COUNT(*) INTO current_count
  FROM repos WHERE user_id = NEW.user_id;

  -- Reject if at or over limit
  IF current_count >= max_repos THEN
    RAISE EXCEPTION 'Repository limit exceeded for % tier (% / %)',
      user_tier, current_count, max_repos
      USING ERRCODE = '23514';  -- check_violation
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on repos table
DROP TRIGGER IF EXISTS enforce_repo_limit ON repos;
CREATE TRIGGER enforce_repo_limit
  BEFORE INSERT ON repos
  FOR EACH ROW
  EXECUTE FUNCTION check_repo_limit();
