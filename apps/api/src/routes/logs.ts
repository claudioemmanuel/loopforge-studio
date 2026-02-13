import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../auth/middleware.js'
import { prisma } from '../prisma/client.js'
import { Stage } from '@loopforge/shared'

export async function registerLogRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  // GET /tasks/:id/logs
  app.get<{ Params: { id: string } }>('/tasks/:id/logs', async (request) => {
    const logs = await prisma.executionLog.findMany({
      where: { taskId: request.params.id, task: { userId: request.userId } },
      orderBy: { sequence: 'asc' },
    })
    return logs.map((l) => ({
      id: l.id,
      taskId: l.taskId,
      sequence: l.sequence,
      level: l.level,
      message: l.message,
      metadata: l.metadata,
      createdAt: l.createdAt.toISOString(),
    }))
  })

  // GET /tasks/:id/logs/stream — SSE live log streaming
  app.get<{ Params: { id: string } }>('/tasks/:id/logs/stream', async (request, reply) => {
    const { id: taskId } = request.params

    const task = await prisma.task.findFirst({
      where: { id: taskId, userId: request.userId },
    })
    if (!task) return reply.status(404).send({ message: 'Task not found' })

    reply
      .header('Content-Type', 'text/event-stream')
      .header('Cache-Control', 'no-cache')
      .header('Connection', 'keep-alive')
      .header('X-Accel-Buffering', 'no')

    let lastSequence = -1
    let isRunning = task.stage === Stage.EXECUTING

    // Poll for new log entries while task is executing
    const poll = async () => {
      const newLogs = await prisma.executionLog.findMany({
        where: {
          taskId,
          sequence: { gt: lastSequence },
        },
        orderBy: { sequence: 'asc' },
        take: 50,
      })

      for (const log of newLogs) {
        lastSequence = log.sequence
        reply.raw.write(
          `data: ${JSON.stringify({
            sequence: log.sequence,
            level: log.level,
            message: log.message,
            createdAt: log.createdAt.toISOString(),
          })}\n\n`,
        )
      }

      // Check if task is still executing
      const current = await prisma.task.findUnique({
        where: { id: taskId },
        select: { stage: true },
      })

      if (current?.stage !== Stage.EXECUTING) {
        reply.raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
        reply.raw.end()
        return
      }

      if (isRunning) {
        setTimeout(poll, 500) // Poll every 500ms — well within 2s requirement
      }
    }

    // Handle client disconnect
    request.raw.on('close', () => {
      isRunning = false
    })

    await poll()
  })
}
