#!/usr/bin/env node
/**
 * Database Migration Generation Wrapper
 *
 * Wraps drizzle-kit generate to ensure journal is always in sync
 * This fixes the root cause of missing journal entries
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DRIZZLE_DIR = path.join(__dirname, '..', 'drizzle');
const JOURNAL_PATH = path.join(DRIZZLE_DIR, 'meta', '_journal.json');

console.log('\n🔨 Generating migrations...\n');

// Run drizzle-kit generate
try {
  execSync('drizzle-kit generate', {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
} catch (error) {
  console.error('\n❌ Migration generation failed');
  process.exit(1);
}

console.log('\n✅ Migration files generated\n');
console.log('🔄 Syncing journal with SQL files...\n');

// Get all SQL migration files
const sqlFiles = fs.readdirSync(DRIZZLE_DIR)
  .filter(f => f.endsWith('.sql') && f.match(/^\d{4}_/))
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

// Read or create journal
let journal;
try {
  journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, 'utf8'));
} catch (error) {
  // Create new journal if it doesn't exist
  journal = {
    version: "7",
    dialect: "postgresql",
    entries: []
  };
}

const existingIndices = new Set(journal.entries.map(e => e.idx));

// Add missing entries
let added = 0;
for (const migration of sqlFiles) {
  if (!existingIndices.has(migration.idx)) {
    journal.entries.push({
      idx: migration.idx,
      version: "7",
      when: Date.now() + migration.idx, // Unique timestamp
      tag: migration.tag,
      breakpoints: true
    });
    console.log(`   ✅ Added to journal: ${migration.tag}`);
    added++;
  }
}

if (added === 0) {
  console.log('   ℹ️  Journal already in sync');
} else {
  // Sort entries by index
  journal.entries.sort((a, b) => a.idx - b.idx);

  // Write updated journal
  fs.writeFileSync(JOURNAL_PATH, JSON.stringify(journal, null, 2) + '\n');
  console.log(`\n✅ Added ${added} entries to journal`);
}

console.log('\n✅ Migration generation complete!\n');
