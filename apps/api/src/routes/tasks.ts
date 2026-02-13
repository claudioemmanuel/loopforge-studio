import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../auth/middleware.js'
import { TaskService } from '../services/task.service.js'
import { Stage, EventType } from '@loopforge/shared'
import type { StageNodeData, StageTransition, TaskFlowData } from '@loopforge/shared'
import { prisma } from '../prisma/client.js'

export async function registerTaskRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  // GET /tasks
  app.get('/tasks', async (request) => {
    return TaskService.list(request.userId)
  })

  // POST /tasks
  app.post<{ Body: { title: string; description: string; repositoryId?: string } }>(
    '/tasks',
    async (request, reply) => {
      const { title, description, repositoryId } = request.body
      if (!title?.trim() || !description?.trim()) {
        return reply.status(400).send({ message: 'title and description are required' })
      }
      const task = await TaskService.create(request.userId, { title, description, repositoryId })
      return reply.status(201).send(task)
    },
  )

  // GET /tasks/:id
  app.get<{ Params: { id: string } }>('/tasks/:id', async (request) => {
    return TaskService.get(request.userId, request.params.id)
  })

  // PATCH /tasks/:id
  app.patch<{
    Params: { id: string }
    Body: { title?: string; description?: string; repositoryId?: string | null }
  }>('/tasks/:id', async (request) => {
    return TaskService.update(request.userId, request.params.id, request.body)
  })

  // DELETE /tasks/:id
  app.delete<{ Params: { id: string } }>('/tasks/:id', async (request, reply) => {
    await TaskService.delete(request.userId, request.params.id)
    return reply.status(204).send()
  })

  // POST /tasks/:id/stage
  app.post<{
    Params: { id: string }
    Body: { stage: Stage; feedback?: string }
    Querystring: { resetData?: string }
  }>('/tasks/:id/stage', async (request, reply) => {
    const { stage, feedback } = request.body
    const resetData = request.query.resetData === 'true'
    if (!Object.values(Stage).includes(stage)) {
      return reply.status(400).send({ message: 'Invalid stage value' })
    }
    return TaskService.transition(request.userId, request.params.id, stage, feedback, resetData)
  })

  // GET /tasks/:id/timeline
  app.get<{ Params: { id: string } }>('/tasks/:id/timeline', async (request) => {
    return TaskService.getTimeline(request.userId, request.params.id)
  })

  // GET /tasks/:id/flow — flow data for ReactFlow canvas
  app.get<{ Params: { id: string } }>('/tasks/:id/flow', async (request) => {
    const task = await prisma.task.findFirstOrThrow({
      where: { id: request.params.id, userId: request.userId },
      include: {
        repository: { select: { name: true } },
        executionPlan: { select: { status: true, steps: true } },
        _count: {
          select: {
            chatMessages: true,
            executionLogs: true,
            commits: true,
          },
        },
      },
    })

    // Get stage change events for transitions
    const stageEvents = await prisma.analyticsEvent.findMany({
      where: {
        taskId: task.id,
        eventType: EventType.STAGE_CHANGED,
        fromStage: { not: null },
        toStage: { not: null },
      },
      orderBy: { occurredAt: 'asc' },
    })

    // Build transitions
    const STAGE_ORDER = [
      Stage.TODO, Stage.BRAINSTORMING, Stage.PLANNING,
      Stage.READY, Stage.EXECUTING, Stage.CODE_REVIEW, Stage.DONE,
    ]
    const transitions: StageTransition[] = stageEvents
      .filter((e) => e.fromStage && e.toStage)
      .map((e) => {
        const fromIdx = STAGE_ORDER.indexOf(e.fromStage as Stage)
        const toIdx = STAGE_ORDER.indexOf(e.toStage as Stage)
        return {
          from: e.fromStage as Stage,
          to: e.toStage as Stage,
          timestamp: e.occurredAt.toISOString(),
          direction: (toIdx >= fromIdx || fromIdx === -1 || toIdx === -1 ? 'forward' : 'backward') as 'forward' | 'backward',
        }
      })

    // Build stage node data
    const currentStage = task.stage as Stage
    const currentStageIdx = STAGE_ORDER.indexOf(currentStage)
    const ALL_STAGES = [...STAGE_ORDER, Stage.STUCK]

    // Determine which stages have been visited
    const visitedStages = new Set<Stage>([Stage.TODO, currentStage])
    for (const t of transitions) {
      visitedStages.add(t.from)
      visitedStages.add(t.to)
    }

    const stages: StageNodeData[] = ALL_STAGES.map((stage) => {
      const stageIdx = STAGE_ORDER.indexOf(stage)
      let status: 'completed' | 'active' | 'pending' = 'pending'

      if (stage === currentStage) {
        // Only EXECUTING shows as "active" (with pulsing indicator)
        // Other current stages show as "completed" since they're waiting/done with their purpose
        status = stage === Stage.EXECUTING ? 'active' : 'completed'
      } else if (stage === Stage.STUCK) {
        status = visitedStages.has(Stage.STUCK) && currentStage !== Stage.STUCK ? 'completed' : 'pending'
      } else if (stageIdx !== -1 && stageIdx < currentStageIdx) {
        status = 'completed'
      }

      // Find when this stage was entered/completed
      const enterEvent = stageEvents.find((e) => e.toStage === stage)
      const exitEvent = stageEvents.find((e) => e.fromStage === stage)

      return {
        stage,
        status,
        enteredAt: enterEvent?.occurredAt.toISOString() ?? (stage === Stage.TODO ? task.createdAt.toISOString() : null),
        completedAt: exitEvent?.occurredAt.toISOString() ?? null,
        data: {},
      }
    })

    // Calculate plan step count
    const planSteps = Array.isArray(task.executionPlan?.steps) ? (task.executionPlan.steps as unknown[]).length : 0

    const flowData: TaskFlowData = {
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        stage: currentStage,
        featureBranch: task.featureBranch,
        repositoryId: task.repositoryId,
        repositoryName: task.repository?.name ?? null,
        autonomousMode: task.autonomousMode,
        pullRequestUrl: task.pullRequestUrl,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
      },
      stages,
      transitions,
      stats: {
        chatMessageCount: task._count.chatMessages,
        executionLogCount: task._count.executionLogs,
        commitCount: task._count.commits,
        planStepCount: planSteps,
        executionPlanStatus: (task.executionPlan?.status as import('@loopforge/shared').PlanStatus) ?? null,
        filesChanged: 0,
        linesAdded: 0,
        linesRemoved: 0,
      },
    }

    return flowData
  })
}
