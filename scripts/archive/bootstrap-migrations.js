#!/usr/bin/env node

/**
 * Bootstrap migrations table
 *
 * This script initializes the Drizzle migrations table when the database
 * already has some schema objects but the migrations table is missing.
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function bootstrap() {
  const DATABASE_URL = process.env.DATABASE_URL;

  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('✓ Connected to database');

    // Create migrations table in public schema
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at BIGINT
      );
    `);
    console.log('✓ Migrations table created');

    // Check which migrations are already recorded
    const { rows: existingMigrations } = await client.query(
      'SELECT hash FROM public.__drizzle_migrations'
    );
    const recordedHashes = new Set(existingMigrations.map(m => m.hash));

    // Read all migration files
    const migrationsDir = path.join(__dirname, '..', 'drizzle');
    const metaPath = path.join(migrationsDir, 'meta', '_journal.json');

    if (!fs.existsSync(metaPath)) {
      console.log('⚠️  No migration journal found, skipping bootstrap');
      return;
    }

    const journal = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    const migrations = journal.entries || [];

    console.log(`\nFound ${migrations.length} migrations in journal`);
    console.log(`Already recorded: ${recordedHashes.size} migrations\n`);

    // Check if critical objects exist in database
    const { rows: tables } = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('users', 'repos', 'tasks', 'executions')
    `);

    const { rows: enums } = await client.query(`
      SELECT typname
      FROM pg_type
      WHERE typname IN ('billing_cycle', 'subscription_tier')
    `);

    console.log(`Existing tables: ${tables.map(t => t.table_name).join(', ') || 'none'}`);
    console.log(`Existing enums: ${enums.map(e => e.typname).join(', ') || 'none'}\n`);

    // If we have tables/enums but no migration records, mark all migrations as applied
    if (tables.length > 0 && recordedHashes.size === 0) {
      console.log('⚠️  Database has schema but no migration records');
      console.log('Marking all migrations as applied...\n');

      for (const migration of migrations) {
        const timestamp = Date.now();
        await client.query(
          'INSERT INTO public.__drizzle_migrations (hash, created_at) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [migration.tag, timestamp]
        );
        console.log(`  ✓ Marked ${migration.tag} as applied`);
      }

      console.log('\n✅ All migrations marked as applied');
      console.log('You can now run: npm run dev');
    } else if (recordedHashes.size > 0) {
      console.log('✓ Migrations table already initialized');
    } else {
      console.log('ℹ️  No existing schema found, migrations will apply normally');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

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

bootstrap();
