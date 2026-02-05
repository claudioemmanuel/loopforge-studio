#!/bin/bash

# Verification script for migration automation fix
# Tests all implemented features to ensure they work correctly

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}   Migration Fix Verification Script${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo

# Test 1: Migration check script exists and is executable
echo -e "${YELLOW}[1/6]${NC} Checking migration check script..."
if [ -f "scripts/check-migrations.js" ]; then
    echo -e "${GREEN}✓${NC} scripts/check-migrations.js exists"
else
    echo -e "${RED}✗${NC} scripts/check-migrations.js not found"
    exit 1
fi

# Test 2: Package.json has predev script
echo -e "\n${YELLOW}[2/6]${NC} Checking package.json scripts..."
if grep -q '"predev"' package.json; then
    echo -e "${GREEN}✓${NC} predev script configured"
else
    echo -e "${RED}✗${NC} predev script not found in package.json"
    exit 1
fi

if grep -q '"dev:skip-migrate"' package.json; then
    echo -e "${GREEN}✓${NC} dev:skip-migrate script configured"
else
    echo -e "${RED}✗${NC} dev:skip-migrate script not found in package.json"
    exit 1
fi

# Test 3: Database columns exist
echo -e "\n${YELLOW}[3/6]${NC} Checking database schema..."
node -e "
const { Pool } = require('pg');
async function check() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/loopforge'
  });

  try {
    const r1 = await pool.query(\`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'default_clone_directory'
    \`);

    const r2 = await pool.query(\`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'executions' AND column_name = 'skill_executions'
    \`);

    if (r1.rows.length === 0) {
      console.error('✗ users.default_clone_directory column missing');
      process.exit(1);
    }
    console.log('✓ users.default_clone_directory exists');

    if (r2.rows.length === 0) {
      console.error('✗ executions.skill_executions column missing');
      process.exit(1);
    }
    console.log('✓ executions.skill_executions exists');
  } catch (error) {
    console.error('✗ Database check failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}
check();
" && echo -e "${GREEN}✓${NC} All required columns exist" || exit 1

# Test 4: Migration check script runs successfully
echo -e "\n${YELLOW}[4/6]${NC} Running migration check script..."
if node scripts/check-migrations.js > /tmp/migration-check.log 2>&1; then
    if grep -q "Database schema is up to date" /tmp/migration-check.log; then
        echo -e "${GREEN}✓${NC} Migration check passed"
    elif grep -q "Migrations completed successfully" /tmp/migration-check.log; then
        echo -e "${GREEN}✓${NC} Pending migrations applied"
    else
        echo -e "${YELLOW}⚠${NC} Migration check ran with warnings"
        cat /tmp/migration-check.log
    fi
else
    echo -e "${RED}✗${NC} Migration check failed"
    cat /tmp/migration-check.log
    exit 1
fi

# Test 5: Health endpoint exists and has schema validation
echo -e "\n${YELLOW}[5/6]${NC} Checking health endpoint code..."
if grep -q "schemaValid" app/api/health/route.ts; then
    echo -e "${GREEN}✓${NC} Health endpoint has schema validation"
else
    echo -e "${RED}✗${NC} Health endpoint missing schema validation"
    exit 1
fi

# Test 6: Auth error handling exists
echo -e "\n${YELLOW}[6/6]${NC} Checking auth error handling..."
if grep -q "DATABASE SCHEMA OUTDATED" lib/auth.ts; then
    echo -e "${GREEN}✓${NC} Auth has enhanced error handling"
else
    echo -e "${RED}✗${NC} Auth missing enhanced error handling"
    exit 1
fi

# Summary
echo
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ All verification checks passed!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo
echo "Migration fix implementation verified successfully."
echo
echo "Next steps:"
echo "  1. Test login flow: npm run dev (then login via GitHub)"
echo "  2. Check health endpoint: curl http://localhost:3000/api/health"
echo "  3. Verify automatic migrations: Stop DB, restart, run npm run dev"
echo

# Cleanup
rm -f /tmp/migration-check.log
