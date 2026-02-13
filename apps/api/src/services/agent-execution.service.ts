import { prisma } from '../prisma/client.js'
import { Stage, LogLevel, AgentExecutionStatus } from '@loopforge/shared'
import type { AgentExecution, AgentLog, Prisma } from '@prisma/client'
import {
  emitAgentExecutionStarted,
  emitAgentExecutionLog,
  emitAgentExecutionCompleted,
  emitAgentExecutionFailed,
} from '../realtime/agent.gateway.js'

// ── Types ──────────────────────────────────────────────────────────────────────

function toAgentExecutionDto(execution: AgentExecution) {
  return {
    id: execution.id,
    taskId: execution.taskId,
    agentId: execution.agentId,
    stage: execution.stage as Stage,
    status: execution.status as AgentExecutionStatus,
    startedAt: execution.startedAt.toISOString(),
    endedAt: execution.endedAt?.toISOString() ?? null,
    contextKey: execution.contextKey,
    output: execution.output as Record<string, unknown> | null,
    metrics: execution.metrics as Record<string, unknown> | null,
  }
}

function toAgentLogDto(log: AgentLog) {
  return {
    id: log.id,
    executionId: log.executionId,
    level: log.level as LogLevel,
    message: log.message,
    timestamp: log.timestamp.toISOString(),
    sequenceNum: log.sequenceNum,
  }
}

// ── Service ────────────────────────────────────────────────────────────────────

export const AgentExecutionService = {
  /**
   * Create a new agent execution record
   */
  async create(
    taskId: string,
    agentId: string,
    stage: Stage,
    contextKey: string
  ): Promise<AgentExecution> {
    const execution = await prisma.agentExecution.create({
      data: {
        taskId,
        agentId,
        stage,
        contextKey,
        status: AgentExecutionStatus.QUEUED,
      },
      include: {
        agent: true,
      },
    })

    // Emit WebSocket event
    emitAgentExecutionStarted(taskId, {
      taskId,
      executionId: execution.id,
      agentName: execution.agent.name,
      agentDisplayName: execution.agent.displayName,
    })

    return execution
  },

  /**
   * Get execution by ID
   */
  async getById(executionId: string) {
    const execution = await prisma.agentExecution.findUnique({
      where: { id: executionId },
    })
    return execution ? toAgentExecutionDto(execution) : null
  },

  /**
   * List executions for a task
   */
  async listByTask(taskId: string) {
    const executions = await prisma.agentExecution.findMany({
      where: { taskId },
      include: { agent: true },
      orderBy: { startedAt: 'desc' },
    })

    return executions.map((e) => ({
      ...toAgentExecutionDto(e),
      agentName: e.agent.displayName,
    }))
  },

  /**
   * Update execution status
   */
  async updateStatus(
    executionId: string,
    status: AgentExecutionStatus
  ): Promise<void> {
    const updates: Prisma.AgentExecutionUpdateInput = {
      status,
    }

    if (
      status === AgentExecutionStatus.COMPLETED ||
      status === AgentExecutionStatus.FAILED ||
      status === AgentExecutionStatus.CANCELLED
    ) {
      updates.endedAt = new Date()
    }

    await prisma.agentExecution.update({
      where: { id: executionId },
      data: updates,
    })
  },

  /**
   * Record agent output and metrics
   */
  async recordOutput(
    executionId: string,
    output: Record<string, unknown>,
    metrics: Record<string, unknown>
  ): Promise<void> {
    const execution = await prisma.agentExecution.update({
      where: { id: executionId },
      data: {
        output: output as Prisma.InputJsonValue,
        metrics: metrics as Prisma.InputJsonValue,
        status: AgentExecutionStatus.COMPLETED,
        endedAt: new Date(),
      },
      include: { agent: true },
    })

    // Emit completion event
    emitAgentExecutionCompleted(execution.taskId, {
      executionId: execution.id,
      metrics: execution.metrics as Record<string, unknown> | null,
      output: execution.output as Record<string, unknown> | null,
    })
  },

  /**
   * Record execution failure
   */
  async recordFailure(executionId: string, error: string): Promise<void> {
    const execution = await prisma.agentExecution.update({
      where: { id: executionId },
      data: {
        status: AgentExecutionStatus.FAILED,
        endedAt: new Date(),
        output: { error } as Prisma.InputJsonValue,
      },
    })

    // Emit failure event
    emitAgentExecutionFailed(execution.taskId, {
      executionId: execution.id,
      error,
    })
  },

  /**
   * Append a log entry to an execution
   */
  async appendLog(
    executionId: string,
    level: LogLevel,
    message: string
  ): Promise<void> {
    // Get next sequence number
    const lastLog = await prisma.agentLog.findFirst({
      where: { executionId },
      orderBy: { sequenceNum: 'desc' },
    })
    const sequenceNum = (lastLog?.sequenceNum ?? 0) + 1

    const log = await prisma.agentLog.create({
      data: {
        executionId,
        level,
        message,
        sequenceNum,
      },
    })

    // Emit log event
    const execution = await prisma.agentExecution.findUnique({
      where: { id: executionId },
      select: { taskId: true },
    })

    if (execution) {
      emitAgentExecutionLog(execution.taskId, {
        executionId,
        level,
        message,
        timestamp: log.timestamp.toISOString(),
      })
    }
  },

  /**
   * Get logs for an execution
   */
  async getLogs(executionId: string) {
    const logs = await prisma.agentLog.findMany({
      where: { executionId },
      orderBy: { sequenceNum: 'asc' },
    })
    return logs.map(toAgentLogDto)
  },

  /**
   * Stream logs for an execution (async generator)
   */
  async *streamLogs(executionId: string): AsyncIterable<AgentLog> {
    let lastSequenceNum = 0
    const maxWaitTime = 300000 // 5 minutes
    const pollInterval = 500 // 500ms
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      // Get new logs since last check
      const newLogs = await prisma.agentLog.findMany({
        where: {
          executionId,
          sequenceNum: { gt: lastSequenceNum },
        },
        orderBy: { sequenceNum: 'asc' },
      })

      for (const log of newLogs) {
        yield log
        lastSequenceNum = log.sequenceNum
      }

      // Check if execution is complete
      const execution = await prisma.agentExecution.findUnique({
        where: { id: executionId },
      })

      if (
        execution &&
        (execution.status === AgentExecutionStatus.COMPLETED ||
          execution.status === AgentExecutionStatus.FAILED ||
          execution.status === AgentExecutionStatus.CANCELLED)
      ) {
        break
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval))
    }
  },
}
