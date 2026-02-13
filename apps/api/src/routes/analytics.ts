import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../auth/middleware.js'
import { prisma } from '../prisma/client.js'
import { Stage, EventType } from '@loopforge/shared'

export async function registerAnalyticsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  // GET /analytics
  app.get<{ Querystring: { since?: string } }>('/analytics', async (request) => {
    const { since } = request.query
    const sinceDate = since ? new Date(since) : undefined

    const [allEvents, repos, tasks] = await Promise.all([
      prisma.analyticsEvent.findMany({
        where: {
          userId: request.userId,
          ...(sinceDate && { occurredAt: { gte: sinceDate } }),
        },
      }),
      prisma.repository.findMany({
        where: { userId: request.userId },
        select: { id: true, fullName: true },
      }),
      prisma.task.findMany({
        where: { userId: request.userId },
        select: { id: true, stage: true },
      }),
    ])

    const totalTasks = tasks.length
    const completedTasks = tasks.filter((t) => t.stage === Stage.DONE).length
    const stuckTasks = tasks.filter((t) => t.stage === Stage.STUCK).length
    const successRate = totalTasks > 0 ? completedTasks / totalTasks : 0

    const totalTokensUsed = allEvents.reduce((sum, e) => sum + (e.tokensUsed ?? 0), 0)

    // Per-repo breakdown
    const repoMap = new Map(repos.map((r) => [r.id, r.fullName]))
    const repoStats = new Map<string, { taskCount: number; tokensUsed: number }>()

    for (const event of allEvents) {
      if (!event.repositoryId) continue
      const existing = repoStats.get(event.repositoryId) ?? { taskCount: 0, tokensUsed: 0 }
      repoStats.set(event.repositoryId, {
        taskCount:
          event.eventType === EventType.TASK_CREATED
            ? existing.taskCount + 1
            : existing.taskCount,
        tokensUsed: existing.tokensUsed + (event.tokensUsed ?? 0),
      })
    }

    const byRepository = Array.from(repoStats.entries()).map(([id, stats]) => ({
      repositoryId: id,
      fullName: repoMap.get(id) ?? 'Unknown',
      taskCount: stats.taskCount,
      tokensUsed: stats.tokensUsed,
    }))

    // Per-provider breakdown
    const providerStats = new Map<string, { tokensUsed: number }>()
    for (const event of allEvents) {
      if (!event.provider || !event.model) continue
      const key = `${event.provider}::${event.model}`
      const existing = providerStats.get(key) ?? { tokensUsed: 0 }
      providerStats.set(key, { tokensUsed: existing.tokensUsed + (event.tokensUsed ?? 0) })
    }

    const byProvider = Array.from(providerStats.entries())
      .filter(([, s]) => s.tokensUsed > 0)
      .map(([key, stats]) => {
        const [provider, model] = key.split('::')
        return { provider: provider!, model: model!, tokensUsed: stats.tokensUsed }
      })

    return {
      totalTasks,
      completedTasks,
      stuckTasks,
      successRate,
      totalTokensUsed,
      byRepository,
      byProvider,
    }
  })
}
