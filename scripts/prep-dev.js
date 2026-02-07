#!/usr/bin/env node

/**
 * Development environment preparation script
 *
 * This script runs before `npm run dev` to ensure:
 * 1. Next.js cache is cleared (.next folder removed)
 * 2. Database migrations are applied
 * 3. Database schema is in sync with codebase
 *
 * Usage: npm run dev (automatically runs via predev script)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env files
// This ensures DATABASE_URL is available for migration checks
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

// ANSI color codes for better terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function step(message) {
  log(`\n${colors.cyan}▸${colors.reset} ${message}`, 'reset');
}

function success(message) {
  log(`${colors.green}✓${colors.reset} ${message}`, 'reset');
}

function warning(message) {
  log(`${colors.yellow}⚠${colors.reset} ${message}`, 'reset');
}

function error(message) {
  log(`${colors.red}✗${colors.reset} ${message}`, 'reset');
}

function info(message) {
  log(`${colors.dim}  ${message}${colors.reset}`, 'reset');
}

function findRunningNextDevPids() {
  try {
    const output = execSync('ps -Ao pid=,command=', {
      encoding: 'utf-8',
      shell: '/bin/bash',
    });

    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const firstSpace = line.indexOf(' ');
        if (firstSpace === -1) return null;
        return {
          pid: line.slice(0, firstSpace).trim(),
          command: line.slice(firstSpace + 1).trim(),
        };
      })
      .filter((entry) => entry && /\bnext\s+dev\b/.test(entry.command))
      .map((entry) => entry.pid);
  } catch {
    return [];
  }
}

// Step 1: Clear Next.js cache
step('Preparing development environment');
const nextDir = path.join(__dirname, '..', '.next');

if (fs.existsSync(nextDir)) {
  const runningNextDevPids = findRunningNextDevPids();

  if (runningNextDevPids.length > 0) {
    warning(
      `Detected running Next.js dev process(es): ${runningNextDevPids.join(', ')}. Skipping cache clear to avoid ENOENT runtime errors.`
    );
    info('Stop existing dev server(s) before forcing a clean .next wipe.');
  } else {
    try {
      fs.rmSync(nextDir, { recursive: true, force: true });
      info('Cleared build cache');
    } catch (err) {
      // Non-fatal, continue
    }
  }
}

// Step 2: Run database migrations
info('Checking database schema...');

try {
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    warning('DATABASE_URL not set, skipping migrations');
  } else {
    // Run drizzle-kit migrate (suppress verbose output)
    execSync('npm run db:migrate 2>&1 | grep -E "(applied|error|failed)" || true', {
      cwd: path.join(__dirname, '..'),
      stdio: 'pipe',
      shell: '/bin/bash'
    });

    // Sync any untracked migrations
    try {
      const syncOutput = execSync('node scripts/sync-migrations.js 2>&1', {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf-8',
        shell: '/bin/bash'
      });

      // Only show if there were changes
      if (syncOutput.includes('untracked')) {
        const match = syncOutput.match(/Found (\d+) untracked/);
        if (match) {
          info(`Synced ${match[1]} pending migration${match[1] !== '1' ? 's' : ''}`);
        }
      }
    } catch (syncErr) {
      // sync-migrations failed — non-fatal, continue
    }

    // Validate schema drift (compare TS schema vs database, auto-fix)
    try {
      const validateOutput = execSync('npx tsx scripts/validate-schema.ts 2>&1', {
        cwd: path.join(__dirname, '..'),
        encoding: 'utf-8',
        env: { ...process.env },
        shell: '/bin/bash'
      });

      if (validateOutput.trim()) {
        console.log(validateOutput.trim());
        success('Database ready (with fixes applied)');
      } else {
        success('Database ready');
      }
    } catch (validateErr) {
      if (validateErr.stdout && validateErr.stdout.includes('Fixed')) {
        console.log(validateErr.stdout.trim());
        success('Database ready (with fixes applied)');
      } else {
        warning('Schema validation failed - some columns may be missing');
      }
    }
  }
} catch (err) {
  warning('Migration check failed - schema may be outdated');
}

// Final summary
log('');
success('Development environment ready');
log(`${colors.dim}${'─'.repeat(60)}${colors.reset}\n`);
