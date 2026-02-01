-- Migration 0035: Subscription Limit Enforcement
-- Function to check repo limit based on subscription tier

CREATE OR REPLACE FUNCTION check_repo_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  max_allowed INTEGER;
  user_tier TEXT;
BEGIN
  -- Get user's subscription tier
  SELECT subscription_tier INTO user_tier
  FROM users
  WHERE id = NEW.user_id;

  -- Count current repos for user
  SELECT COUNT(*) INTO current_count
  FROM repos
  WHERE user_id = NEW.user_id;

  -- Determine limit based on tier
  max_allowed := CASE user_tier
    WHEN 'pro' THEN 20
    WHEN 'enterprise' THEN 999999
    ELSE 3  -- free tier
  END;

  -- Enforce limit
  IF current_count >= max_allowed THEN
    RAISE EXCEPTION 'Repository limit exceeded for % tier (max: %)', user_tier, max_allowed;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER enforce_repo_limit
  BEFORE INSERT ON repos
  FOR EACH ROW
  EXECUTE FUNCTION check_repo_limit();
