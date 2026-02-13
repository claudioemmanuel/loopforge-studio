#!/usr/bin/env tsx
/**
 * Setup script - runs migrations and generates Prisma client
 */

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import { resolve } from 'path'

const PRISMA_DIR = resolve(process.cwd(), 'prisma')
const MIGRATIONS_DIR = resolve(PRISMA_DIR, 'migrations')

function execCommand(command: string, description: string) {
  console.log(`\n🔧 ${description}...`)
  try {
    execSync(command, { stdio: 'inherit', cwd: process.cwd() })
    console.log(`✅ ${description} completed`)
    return true
  } catch (error) {
    console.error(`❌ ${description} failed`)
    return false
  }
}

async function main() {
  console.log('🚀 Starting setup...\n')

  // Check if migrations directory exists
  if (!existsSync(MIGRATIONS_DIR)) {
    console.log('📁 No migrations directory found, creating initial migration...')
  }

  // Generate Prisma Client
  const generateSuccess = execCommand(
    'npx prisma generate',
    'Generating Prisma Client'
  )

  if (!generateSuccess) {
    process.exit(1)
  }

  // Run migrations
  const migrateSuccess = execCommand(
    'npx prisma migrate deploy',
    'Running database migrations'
  )

  if (!migrateSuccess) {
    console.error('\n⚠️  Migration failed. If in development, try: pnpm db:migrate')
    process.exit(1)
  }

  console.log('\n✅ Setup completed successfully!')
  process.exit(0)
}

main()
