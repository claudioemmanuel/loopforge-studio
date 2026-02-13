import type { FastifyInstance } from 'fastify'
import { prisma } from '../prisma/client.js'
import { executionQueue } from '../workers/queue.js'

export async function registerStatusRoutes(app: FastifyInstance) {
  app.get('/status', async (_request, reply) => {
    const result: Record<string, unknown> = {
      api: { status: 'ok' },
    }

    // Database check
    try {
      const dbStart = Date.now()
      await prisma.$queryRaw`SELECT 1`
      result.database = { status: 'ok', latencyMs: Date.now() - dbStart }
    } catch (err) {
      result.database = { status: 'error', latencyMs: -1, error: String(err) }
    }

    // Redis check — use the IORedis client BullMQ already holds
    try {
      const redisStart = Date.now()
      const client = await executionQueue.client
      await client.ping()
      result.redis = { status: 'ok', latencyMs: Date.now() - redisStart }
    } catch (err) {
      result.redis = { status: 'error', latencyMs: -1, error: String(err) }
    }

    // Worker queue check
    try {
      const counts = await executionQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed')
      const { waiting = 0, active = 0, completed = 0, failed = 0, delayed = 0 } = counts
      result.worker = {
        status: active > 0 ? 'ok' : 'idle',
        queue: { waiting, active, completed, failed, delayed },
      }
    } catch (err) {
      result.worker = {
        status: 'error',
        queue: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
        error: String(err),
      }
    }

    return reply.send(result)
  })
}
