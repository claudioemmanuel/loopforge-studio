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

  console.log('Fixing missing schema elements...\n');

  // Add subscription_tier enum
  await client.query(`
    DO $$ BEGIN
      CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'enterprise');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  console.log('✓ subscription_tier enum ready');

  // Add missing columns to users table
  await client.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS subscription_tier subscription_tier DEFAULT 'free' NOT NULL
  `);
  console.log('✓ users.subscription_tier added');

  await client.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT
  `);
  console.log('✓ users.name added');

  await client.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT
  `);
  console.log('✓ users.image added');

  await client.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'en' NOT NULL
  `);
  console.log('✓ users.locale added');

  console.log('\n✅ Schema fixed! You can now run: npm run dev\n');

  await client.end();
})();
