import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../auth/middleware.js'
import { prisma } from '../prisma/client.js'
import { Stage, EventType } from '@loopforge/shared'
import { emitStageChanged, emitTaskUpdated } from '../realtime/board.gateway.js'
import { enqueueExecution } from '../workers/queue.js'
import { generatePlanSteps } from '../services/plan.service.js'

export async function registerPlanRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth)

  // GET /tasks/:id/plan
  app.get<{ Params: { id: string } }>('/tasks/:id/plan', async (request, reply) => {
    const plan = await prisma.executionPlan.findFirst({
      where: { taskId: request.params.id, task: { userId: request.userId } },
    })
    if (!plan) return reply.status(404).send({ message: 'No plan found' })

    return {
      id: plan.id,
      taskId: plan.taskId,
      steps: plan.steps,
      status: plan.status,
      rejectionFeedback: plan.rejectionFeedback,
      approvedAt: plan.approvedAt?.toISOString() ?? null,
      createdAt: plan.createdAt.toISOString(),
    }
  })

  // POST /tasks/:id/plan/approve
  app.post<{ Params: { id: string } }>('/tasks/:id/plan/approve', async (request) => {
    const task = await prisma.task.findFirstOrThrow({
      where: { id: request.params.id, userId: request.userId },
      include: { executionPlan: true },
    })

    if (!task.executionPlan) {
      // Auto-generate plan if missing
      const steps = await generatePlanSteps(task.id, request.userId)
      await prisma.executionPlan.create({
        data: { taskId: task.id, steps, status: 'APPROVED', approvedAt: new Date() },
      })
    } else {
      await prisma.executionPlan.update({
        where: { id: task.executionPlan.id },
        data: { status: 'APPROVED', approvedAt: new Date() },
      })
    }

    // Transition task to READY
    const updated = await prisma.task.update({
      where: { id: task.id },
      data: { stage: Stage.READY },
    })

    const dto = {
      id: updated.id,
      userId: updated.userId,
      repositoryId: updated.repositoryId,
      title: updated.title,
      description: updated.description,
      stage: updated.stage as Stage,
      featureBranch: updated.featureBranch,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    }

    emitStageChanged(request.userId, task.id, Stage.PLANNING, Stage.READY)
    emitTaskUpdated(request.userId, dto)

    await prisma.analyticsEvent.create({
      data: { userId: request.userId, taskId: task.id, eventType: EventType.PLAN_APPROVED },
    })

    // Enqueue execution
    if (task.repositoryId) {
      const plan = await prisma.executionPlan.findUnique({ where: { taskId: task.id } })
      if (plan) {
        await enqueueExecution({
          taskId: task.id,
          userId: request.userId,
          repositoryId: task.repositoryId,
          planSteps: plan.steps as Array<{ stepNumber: number; description: string; estimatedChanges: string }>,
        })
      }
    }

    return dto
  })

  // POST /tasks/:id/plan/reject
  app.post<{ Params: { id: string }; Body: { feedback: string } }>(
    '/tasks/:id/plan/reject',
    async (request, reply) => {
      const { feedback } = request.body
      if (!feedback?.trim()) {
        return reply.status(400).send({ message: 'feedback is required' })
      }

      const task = await prisma.task.findFirstOrThrow({
        where: { id: request.params.id, userId: request.userId },
        include: { executionPlan: true },
      })

      if (task.executionPlan) {
        await prisma.executionPlan.update({
          where: { id: task.executionPlan.id },
          data: { status: 'REJECTED', rejectionFeedback: feedback },
        })
      }

      // Add feedback as a user message for next brainstorm session
      await prisma.chatMessage.create({
        data: { taskId: task.id, role: 'USER', content: `[Plan Rejected] ${feedback}` },
      })

      const updated = await prisma.task.update({
        where: { id: task.id },
        data: { stage: Stage.BRAINSTORMING },
      })

      const dto = {
        id: updated.id,
        userId: updated.userId,
        repositoryId: updated.repositoryId,
        title: updated.title,
        description: updated.description,
        stage: updated.stage as Stage,
        featureBranch: updated.featureBranch,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      }

      emitStageChanged(request.userId, task.id, Stage.PLANNING, Stage.BRAINSTORMING)
      emitTaskUpdated(request.userId, dto)

      await prisma.analyticsEvent.create({
        data: { userId: request.userId, taskId: task.id, eventType: EventType.PLAN_REJECTED },
      })

      return dto
    },
  )
}
