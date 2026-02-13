import { prisma } from '../prisma/client.js'
import { Stage, PlanStatus, EventType } from '@loopforge/shared'
import type { Task } from '@prisma/client'
import {
  emitTaskCreated,
  emitTaskDeleted,
  emitTaskUpdated,
  emitStageChanged,
} from '../realtime/board.gateway.js'
import { enqueueExecution } from '../workers/queue.js'
import { generatePlanSteps } from './plan.service.js'
import { isFeatureEnabled } from '../config/features.js'
import { AgentOrchestrationService } from './agent-orchestration.service.js'

// Valid stage transitions
const VALID_TRANSITIONS: Partial<Record<Stage, Stage[]>> = {
  [Stage.TODO]: [Stage.BRAINSTORMING],
  [Stage.BRAINSTORMING]: [Stage.PLANNING],
  [Stage.PLANNING]: [Stage.READY, Stage.BRAINSTORMING],
  [Stage.READY]: [Stage.EXECUTING],
  [Stage.EXECUTING]: [Stage.CODE_REVIEW, Stage.STUCK],
  [Stage.CODE_REVIEW]: [Stage.DONE, Stage.BRAINSTORMING],
  [Stage.STUCK]: [Stage.BRAINSTORMING],
}

function toTaskDto(task: Task) {
  return {
    id: task.id,
    userId: task.userId,
    repositoryId: task.repositoryId,
    title: task.title,
    description: task.description,
    stage: task.stage as Stage,
    featureBranch: task.featureBranch,
    autonomousMode: task.autonomousMode,
    pullRequestUrl: task.pullRequestUrl,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }
}

type TaskWithBadgeData = Task & {
  _count: { chatMessages: number }
  repository: { name: string } | null
  executionPlan: { status: string } | null
}

function toTaskDtoWithBadges(task: TaskWithBadgeData) {
  return {
    ...toTaskDto(task),
    chatMessageCount: task._count.chatMessages,
    repositoryName: task.repository?.name ?? undefined,
    executionPlanStatus: (task.executionPlan?.status ?? undefined) as import('@loopforge/shared').PlanStatus | undefined,
  }
}

async function emitAnalytics(
  userId: string,
  taskId: string,
  eventType: EventType,
  opts?: {
    repositoryId?: string | null
    fromStage?: Stage
    toStage?: Stage
    tokensUsed?: number
    provider?: string
    model?: string
  },
) {
  await prisma.analyticsEvent.create({
    data: {
      userId,
      taskId,
      repositoryId: opts?.repositoryId ?? null,
      eventType,
      fromStage: opts?.fromStage ?? null,
      toStage: opts?.toStage ?? null,
      provider: opts?.provider ?? null,
      model: opts?.model ?? null,
      tokensUsed: opts?.tokensUsed ?? null,
    },
  })
}

export const TaskService = {
  async list(userId: string) {
    const tasks = await prisma.task.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { chatMessages: true } },
        repository: { select: { name: true } },
        executionPlan: { select: { status: true } },
      },
    })
    return tasks.map(toTaskDtoWithBadges)
  },

  async get(userId: string, taskId: string) {
    const task = await prisma.task.findFirstOrThrow({
      where: { id: taskId, userId },
    })
    return toTaskDto(task)
  },

  async create(userId: string, data: { title: string; description: string; repositoryId?: string }) {
    const task = await prisma.task.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        repositoryId: data.repositoryId ?? null,
        stage: 'TODO',
      },
    })

    const dto = toTaskDto(task)
    emitTaskCreated(userId, dto)
    await emitAnalytics(userId, task.id, EventType.TASK_CREATED, {
      repositoryId: task.repositoryId,
    })

    return dto
  },

  async update(
    userId: string,
    taskId: string,
    data: { title?: string; description?: string; repositoryId?: string | null },
  ) {
    const task = await prisma.task.update({
      where: { id: taskId, userId },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.repositoryId !== undefined && { repositoryId: data.repositoryId }),
      },
    })
    const dto = toTaskDto(task)
    emitTaskUpdated(userId, dto)
    return dto
  },

  async delete(userId: string, taskId: string) {
    await prisma.task.delete({ where: { id: taskId, userId } })
    emitTaskDeleted(userId, taskId)
  },

  async transition(userId: string, taskId: string, toStage: Stage, feedback?: string, resetData = false) {
    const task = await prisma.task.findFirstOrThrow({
      where: { id: taskId, userId },
      include: { executionPlan: true },
    })

    const fromStage = task.stage as Stage
    const allowed = VALID_TRANSITIONS[fromStage] ?? []

    if (!allowed.includes(toStage)) {
      throw Object.assign(new Error(`Invalid transition: ${fromStage} → ${toStage}`), {
        statusCode: 422,
      })
    }

    // Enforce approval gate: PLANNING → READY requires approved plan
    if (fromStage === Stage.PLANNING && toStage === Stage.READY) {
      if (task.executionPlan?.status !== PlanStatus.APPROVED) {
        throw Object.assign(
          new Error('Cannot advance to READY: plan must be approved first'),
          { statusCode: 422 },
        )
      }
    }

    // Detect backward transition
    const stageOrder = [Stage.TODO, Stage.BRAINSTORMING, Stage.PLANNING, Stage.READY, Stage.EXECUTING, Stage.DONE]
    const fromIndex = stageOrder.indexOf(fromStage)
    const toIndex = stageOrder.indexOf(toStage)
    const isBackward = fromIndex > toIndex && fromIndex !== -1 && toIndex !== -1

    // Handle backward transition with full reset
    if (isBackward && resetData) {
      // Delete execution plan, logs, commits, and clear branch
      if (task.executionPlan) {
        await prisma.executionPlan.delete({ where: { id: task.executionPlan.id } })
      }
      await prisma.executionLog.deleteMany({ where: { taskId } })
      await prisma.commit.deleteMany({ where: { taskId } })
      await prisma.task.update({
        where: { id: taskId },
        data: { featureBranch: null },
      })

      // Emit rollback analytics event
      await emitAnalytics(userId, taskId, EventType.STAGE_CHANGED, {
        repositoryId: task.repositoryId,
        fromStage,
        toStage,
      })
    }

    // Handle plan rejection
    if (fromStage === Stage.PLANNING && toStage === Stage.BRAINSTORMING && task.executionPlan && !resetData) {
      await prisma.executionPlan.update({
        where: { id: task.executionPlan.id },
        data: { status: 'REJECTED', rejectionFeedback: feedback ?? null },
      })
    }

    // Auto-generate plan when moving to PLANNING (if no approved plan exists)
    if (toStage === Stage.PLANNING && (!task.executionPlan || task.executionPlan.status === PlanStatus.REJECTED)) {
      const steps = await generatePlanSteps(taskId, userId)
      if (task.executionPlan) {
        await prisma.executionPlan.update({
          where: { id: task.executionPlan.id },
          data: { steps, status: PlanStatus.PENDING_REVIEW, rejectionFeedback: null, approvedAt: null },
        })
      } else {
        await prisma.executionPlan.create({
          data: { taskId, steps, status: PlanStatus.PENDING_REVIEW },
        })
      }

      // Trigger planning agents to validate/enhance the generated plan
      if (isFeatureEnabled('AGENT_ORCHESTRATION')) {
        await AgentOrchestrationService.orchestrateStage(taskId, Stage.PLANNING)
      }
    }

    // Trigger brainstorming agents when entering BRAINSTORMING stage
    if (toStage === Stage.BRAINSTORMING && isFeatureEnabled('AGENT_ORCHESTRATION')) {
      await AgentOrchestrationService.orchestrateStage(taskId, Stage.BRAINSTORMING)
    }

    const updated = await prisma.task.update({
      where: { id: taskId },
      data: { stage: toStage },
    })

    const dto = toTaskDto(updated)
    emitStageChanged(userId, taskId, fromStage, toStage)
    emitTaskUpdated(userId, dto)

    await emitAnalytics(userId, taskId, EventType.STAGE_CHANGED, {
      repositoryId: task.repositoryId,
      fromStage,
      toStage,
    })

    // If transitioning to READY, enqueue execution
    if (toStage === Stage.READY && task.repositoryId && task.executionPlan) {
      const steps = task.executionPlan.steps as Array<{
        stepNumber: number
        description: string
        estimatedChanges: string
      }>
      await enqueueExecution({
        taskId,
        userId,
        repositoryId: task.repositoryId,
        planSteps: steps,
      })
    }

    // Trigger execution agents when transitioning to EXECUTING stage
    // These agents run in parallel with code generation:
    // - code-reviewer: Reviews generated code quality
    // - test-runner: Runs tests on generated code
    // - security-auditor: Scans for vulnerabilities
    if (toStage === Stage.EXECUTING && isFeatureEnabled('AGENT_ORCHESTRATION')) {
      // Run asynchronously to not block execution
      AgentOrchestrationService.orchestrateStage(taskId, Stage.EXECUTING).catch((err) =>
        console.error(`Failed to orchestrate EXECUTING agents for task ${taskId}:`, err)
      )
    }

    // Trigger code review agents when entering CODE_REVIEW stage
    // - accessibility-tester: WCAG compliance checks
    // - performance-analyzer: Identifies bottlenecks
    // - documentation-generator: Creates/updates docs
    if (toStage === Stage.CODE_REVIEW && isFeatureEnabled('AGENT_ORCHESTRATION')) {
      await AgentOrchestrationService.orchestrateStage(taskId, Stage.CODE_REVIEW)
    }

    return dto
  },

  async getTimeline(userId: string, taskId: string) {
    // Verify task belongs to user
    await prisma.task.findFirstOrThrow({ where: { id: taskId, userId } })

    // Fetch analytics events
    const analyticsEvents = await prisma.analyticsEvent.findMany({
      where: { taskId },
      orderBy: { occurredAt: 'asc' },
    })

    // Fetch execution logs
    const executionLogs = await prisma.executionLog.findMany({
      where: { taskId },
      orderBy: { createdAt: 'asc' },
    })

    // Fetch commits
    const commits = await prisma.commit.findMany({
      where: { taskId },
      orderBy: { committedAt: 'asc' },
    })

    // Merge and sort all events
    const timeline: Array<{
      type: 'analytics' | 'log' | 'commit'
      timestamp: string
      eventType?: string
      level?: string
      message: string
      metadata?: Record<string, unknown>
    }> = []

    // Add analytics events
    for (const event of analyticsEvents) {
      let message = ''
      const metadata: Record<string, unknown> = {}

      switch (event.eventType) {
        case EventType.TASK_CREATED:
          message = 'Task created'
          break
        case EventType.STAGE_CHANGED:
          // Skip events with null stages (these are likely AI provider events logged incorrectly)
          if (!event.fromStage || !event.toStage) {
            continue
          }
          message = `Moved from ${event.fromStage} → ${event.toStage}`
          metadata.fromStage = event.fromStage
          metadata.toStage = event.toStage
          break
        case EventType.PLAN_APPROVED:
          message = 'Execution plan approved'
          break
        case EventType.PLAN_REJECTED:
          message = 'Plan rejected'
          break
        case EventType.EXECUTION_STARTED:
          message = 'Execution started'
          break
        case EventType.EXECUTION_COMPLETED:
          message = 'Execution completed'
          break
        case EventType.STUCK_DETECTED:
          message = 'Execution failed'
          break
        case EventType.COMMIT_PUSHED:
          message = 'Commit pushed'
          break
        default:
          message = event.eventType
      }

      if (event.provider) metadata.provider = event.provider
      if (event.model) metadata.model = event.model
      if (event.tokensUsed) metadata.tokensUsed = event.tokensUsed

      timeline.push({
        type: 'analytics',
        timestamp: event.occurredAt.toISOString(),
        eventType: event.eventType,
        message,
        metadata,
      })
    }

    // Add execution logs
    for (const log of executionLogs) {
      timeline.push({
        type: 'log',
        timestamp: log.createdAt.toISOString(),
        level: log.level,
        message: log.message,
        metadata: log.metadata as Record<string, unknown> | undefined,
      })
    }

    // Add commits
    for (const commit of commits) {
      timeline.push({
        type: 'commit',
        timestamp: commit.committedAt.toISOString(),
        message: `Commit: ${commit.message}`,
        metadata: {
          sha: commit.sha,
          branch: commit.branch,
          filesChanged: commit.filesChanged,
        },
      })
    }

    // Sort by timestamp ASC (oldest first - chronological order)
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    return timeline
  },
}
