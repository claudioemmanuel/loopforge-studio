# Remove repo-limit DB trigger

Deployments upgrading to this version must manually drop the trigger
that was installed by `scripts/apply-limit-constraint.ts`:

```sql
DROP TRIGGER IF EXISTS enforce_repo_limit ON repos;
DROP FUNCTION IF EXISTS check_repo_limit();
```

This is a one-time manual step — it is not a Drizzle migration because
the trigger was applied via a raw SQL script.

## Context

The repo limit trigger enforced subscription tier-based repository limits
at the database level. This has been removed as part of the open-source
migration, which eliminates all subscription/billing functionality.

## Instructions

Connect to your PostgreSQL database and run the SQL commands above:

```bash
psql $DATABASE_URL -c "DROP TRIGGER IF EXISTS enforce_repo_limit ON repos;"
psql $DATABASE_URL -c "DROP FUNCTION IF EXISTS check_repo_limit();"
```

Or connect interactively and run the commands:

```bash
psql $DATABASE_URL
```

```sql
DROP TRIGGER IF EXISTS enforce_repo_limit ON repos;
DROP FUNCTION IF EXISTS check_repo_limit();
\q
```
