#!/usr/bin/env node
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env files
const envFiles = ['.env.local', '.env'];
for (const envFile of envFiles) {
  const envPath = path.join(__dirname, '..', envFile);
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const match = line.match(/^([^=:#]+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '');
      }
    });
  }
}

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Clear migrations table
  await client.query('TRUNCATE TABLE public.__drizzle_migrations');
  console.log('✓ Cleared migrations table\n');

  // Only mark migrations up to 0022 as applied (based on actual DB state)
  const migrationsToMark = [
    '0000_tan_frank_castle',
    '0001_faithful_rafael_vega',
    '0002_stale_trish_tilby',
    '0003_adorable_zombie',
    '0004_parched_beast',
    '0005_model_preferences',
    '0006_preferred_provider',
    '0007_open_nemesis',
    '0008_autonomous_mode',
    '0009_processing_phase',
    '0010_processing_progress',
    '0011_query_optimization',
    '0012_worker_jobs',
    '0013_task_status_history',
    '0014_race_condition_constraints',
    '0015_index_optimization',
    '0016_constraint_hardening',
    '0017_cleanup_billing_tables',
    '0018_add_setup_event_types',
    '0019_add_pr_fields',
    '0020_add_repo_indexing',
    '0021_add_execution_pr_fields',
    '0022_add_billing'
  ];

  for (const tag of migrationsToMark) {
    await client.query(
      'INSERT INTO public.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
      [tag, Date.now()]
    );
    console.log('  ✓ Marked', tag);
  }

  console.log('\n✅ Migrations table reset');
  console.log('Now run: npm run db:migrate\n');

  await client.end();
})();
