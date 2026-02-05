#!/usr/bin/env node
/**
 * Migration Sync Script
 *
 * Automatically detects and applies unapplied SQL migrations
 * Ensures drizzle meta journal stays in sync with actual migration files
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DRIZZLE_DIR = path.join(__dirname, '..', 'drizzle');
const JOURNAL_PATH = path.join(DRIZZLE_DIR, 'meta', '_journal.json');

async function syncMigrations() {
  // Get all SQL migration files
  const sqlFiles = fs.readdirSync(DRIZZLE_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()
    .map(f => {
      const match = f.match(/^(\d+)_(.+)\.sql$/);
      if (!match) return null;
      return {
        idx: parseInt(match[1]),
        tag: f.replace('.sql', ''),
        filename: f
      };
    })
    .filter(Boolean);

  // Read journal
  const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, 'utf8'));
  const journalEntries = new Map(journal.entries.map(e => [e.idx, e]));

  // Find missing entries
  const missing = sqlFiles.filter(m => !journalEntries.has(m.idx));

  if (missing.length === 0) {
    // Silent success - no output needed
    return;
  }

  console.log(`\n⚠️  Found ${missing.length} untracked migration${missing.length > 1 ? 's' : ''}`);

  // Connect to database
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {

    for (const migration of missing) {
      const sqlPath = path.join(DRIZZLE_DIR, migration.filename);
      const sql = fs.readFileSync(sqlPath, 'utf8');

      try {
        await pool.query(sql);

        // Add to journal
        journal.entries.push({
          idx: migration.idx,
          version: "7",
          when: Date.now(),
          tag: migration.tag,
          breakpoints: true
        });

        // Track in __drizzle_migrations
        const hash = require('crypto')
          .createHash('sha256')
          .update(migration.tag)
          .digest('hex');

        await pool.query(
          'INSERT INTO __drizzle_migrations (id, hash, created_at) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
          [migration.idx + 1, hash, Date.now()]
        );

      } catch (error) {
        if (error.message.includes('already exists') || error.code === '42710') {
          // Still add to journal even if SQL already applied
          journal.entries.push({
            idx: migration.idx,
            version: "7",
            when: Date.now(),
            tag: migration.tag,
            breakpoints: true
          });
        } else {
          console.error(`   ❌ Error: ${error.message}`);
        }
      }
    }

    // Sort journal entries
    journal.entries.sort((a, b) => a.idx - b.idx);

    // Write updated journal
    fs.writeFileSync(JOURNAL_PATH, JSON.stringify(journal, null, 2) + '\n');
    console.log(`✅ Synced ${missing.length} migration${missing.length > 1 ? 's' : ''}\n`);

  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  syncMigrations().catch(error => {
    console.error('\n❌ Migration sync failed:', error);
    process.exit(1);
  });
}

module.exports = { syncMigrations };
