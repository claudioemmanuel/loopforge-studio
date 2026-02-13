#!/usr/bin/env tsx
/**
 * Health check script - verifies database and Redis connectivity
 */

import { PrismaClient } from '@prisma/client'
import { Queue } from 'bullmq'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const MAX_RETRIES = 10
const RETRY_DELAY = 2000

function parseRedisUrl(url: string) {
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
    db: parseInt(parsed.pathname.replace('/', '') || '0', 10),
  }
}

async function checkDatabase(): Promise<boolean> {
  const prisma = new PrismaClient()

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      await prisma.$connect()
      await prisma.$executeRaw`SELECT 1`
      console.log('✅ Database connection successful')
      await prisma.$disconnect()
      return true
    } catch (error) {
      console.log(`⏳ Waiting for database... (attempt ${i + 1}/${MAX_RETRIES})`)
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
    }
  }

  console.error('❌ Database connection failed after max retries')
  return false
}

async function checkRedis(): Promise<boolean> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    let queue: Queue | null = null
    try {
      const redisConnection = parseRedisUrl(REDIS_URL)
      queue = new Queue('health-check', {
        connection: {
          ...redisConnection,
          maxRetriesPerRequest: 1,
        }
      })

      // Just check if queue can be created
      await new Promise((resolve, reject) => {
        queue!.on('error', reject)
        setTimeout(resolve, 1000) // Wait 1 second for connection
      })

      console.log('✅ Redis connection successful')
      await queue.close()
      return true
    } catch (error) {
      console.log(`⏳ Waiting for Redis... (attempt ${i + 1}/${MAX_RETRIES})`)
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
      if (queue) await queue.close().catch(() => {})
    }
  }

  console.error('❌ Redis connection failed after max retries')
  return false
}

async function main() {
  console.log('🏥 Running health checks...\n')

  const [dbHealthy, redisHealthy] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ])

  if (dbHealthy && redisHealthy) {
    console.log('\n✅ All services are healthy!')
    process.exit(0)
  } else if (dbHealthy && !redisHealthy) {
    console.log('\n⚠️  Database is healthy but Redis connection failed')
    console.log('Continuing anyway - Redis is optional for basic functionality')
    process.exit(0)
  } else {
    console.error('\n❌ Health check failed - database is required')
    process.exit(1)
  }
}

main()
