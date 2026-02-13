import { createClient } from 'redis'
import { prisma } from '../prisma/client.js'
import type { Stage, PlanStep, ChatMessage, Repository, Task } from '@loopforge/shared'

// ── Redis Client ───────────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'
const CONTEXT_TTL_SECONDS = 24 * 60 * 60 // 24 hours

let redisClient: ReturnType<typeof createClient> | null = null

async function getRedisClient() {
  if (!redisClient) {
    redisClient = createClient({ url: REDIS_URL })
    redisClient.on('error', (err: Error) => console.error('Redis Client Error:', err))
    await redisClient.connect()
  }
  return redisClient
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface RepositoryContext {
  owner: string
  name: string
  fullName: string
  defaultBranch: string
  localPath?: string
}

export interface TaskContext {
  task: {
    id: string
    title: string
    description: string
    stage: Stage
    featureBranch: string | null
  }
  repository: RepositoryContext | null
  planSteps: PlanStep[]
  chatHistory: Array<{
    role: string
    content: string
    createdAt: string
  }>
  codebaseContext: {
    recentFiles: string[]
    relevantPatterns: string[]
  }
  previousAgentOutputs: Record<string, unknown>
  currentStage: Stage
  generatedCode?: string
  metadata: Record<string, unknown>
}

// ── Service ────────────────────────────────────────────────────────────────────

export const AgentContextService = {
  /**
   * Create context in Redis for a task
   * Returns the context key
   */
  async createContext(taskId: string, data: Partial<TaskContext>): Promise<string> {
    const client = await getRedisClient()
    const contextKey = `agent:context:${taskId}`

    // Build full context
    const context: TaskContext = {
      task: data.task ?? {
        id: taskId,
        title: '',
        description: '',
        stage: 'TODO' as Stage,
        featureBranch: null,
      },
      repository: data.repository ?? null,
      planSteps: data.planSteps ?? [],
      chatHistory: data.chatHistory ?? [],
      codebaseContext: data.codebaseContext ?? {
        recentFiles: [],
        relevantPatterns: [],
      },
      previousAgentOutputs: data.previousAgentOutputs ?? {},
      currentStage: data.currentStage ?? data.task?.stage ?? ('TODO' as Stage),
      generatedCode: data.generatedCode,
      metadata: data.metadata ?? {},
    }

    // Store in Redis with TTL
    await client.set(contextKey, JSON.stringify(context), {
      EX: CONTEXT_TTL_SECONDS,
    })

    return contextKey
  },

  /**
   * Get context from Redis
   */
  async getContext(contextKey: string): Promise<TaskContext | null> {
    const client = await getRedisClient()
    const data = await client.get(contextKey)

    if (!data) {
      return null
    }

    return JSON.parse(data) as TaskContext
  },

  /**
   * Update context in Redis
   */
  async updateContext(
    contextKey: string,
    updates: Partial<TaskContext>
  ): Promise<void> {
    const client = await getRedisClient()
    const existing = await this.getContext(contextKey)

    if (!existing) {
      throw new Error(`Context not found: ${contextKey}`)
    }

    const updated: TaskContext = {
      ...existing,
      ...updates,
      // Merge nested objects
      codebaseContext: {
        ...existing.codebaseContext,
        ...(updates.codebaseContext ?? {}),
      },
      previousAgentOutputs: {
        ...existing.previousAgentOutputs,
        ...(updates.previousAgentOutputs ?? {}),
      },
      metadata: {
        ...existing.metadata,
        ...(updates.metadata ?? {}),
      },
    }

    await client.set(contextKey, JSON.stringify(updated), {
      EX: CONTEXT_TTL_SECONDS,
    })
  },

  /**
   * Append agent output to context
   */
  async appendAgentOutput(
    contextKey: string,
    agentId: string,
    output: unknown
  ): Promise<void> {
    const context = await this.getContext(contextKey)

    if (!context) {
      throw new Error(`Context not found: ${contextKey}`)
    }

    context.previousAgentOutputs[agentId] = output

    await this.updateContext(contextKey, {
      previousAgentOutputs: context.previousAgentOutputs,
    })
  },

  /**
   * Delete context from Redis
   */
  async deleteContext(contextKey: string): Promise<void> {
    const client = await getRedisClient()
    await client.del(contextKey)
  },

  /**
   * Build full task context from database
   */
  async buildTaskContext(taskId: string): Promise<TaskContext> {
    // Fetch task with relations
    const task = await prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: {
        repository: true,
        executionPlan: true,
        chatMessages: {
          orderBy: { createdAt: 'asc' },
          take: 50, // Last 50 messages
        },
      },
    })

    // Build context
    const context: TaskContext = {
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        stage: task.stage as Stage,
        featureBranch: task.featureBranch,
      },
      repository: task.repository
        ? {
            owner: task.repository.owner,
            name: task.repository.name,
            fullName: task.repository.fullName,
            defaultBranch: task.repository.defaultBranch,
          }
        : null,
      planSteps:
        (task.executionPlan?.steps as unknown as PlanStep[]) ?? [],
      chatHistory: task.chatMessages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        createdAt: msg.createdAt.toISOString(),
      })),
      codebaseContext: {
        recentFiles: [],
        relevantPatterns: [],
      },
      previousAgentOutputs: {},
      currentStage: task.stage as Stage,
      metadata: {},
    }

    return context
  },

  /**
   * Get or create context for a task
   */
  async getOrCreateContext(taskId: string): Promise<string> {
    const contextKey = `agent:context:${taskId}`
    const existing = await this.getContext(contextKey)

    if (existing) {
      return contextKey
    }

    // Build and create new context
    const context = await this.buildTaskContext(taskId)
    return this.createContext(taskId, context)
  },

  /**
   * Cleanup expired contexts (called by a scheduled job)
   */
  async cleanupExpiredContexts(): Promise<number> {
    const client = await getRedisClient()
    const pattern = 'agent:context:*'
    let deletedCount = 0

    // Scan for context keys
    for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      const ttl = await client.ttl(key)
      // If TTL is -1 (no expiry) or -2 (key doesn't exist), clean up
      if (ttl === -1 || ttl === -2) {
        await client.del(key)
        deletedCount++
      }
    }

    return deletedCount
  },

  /**
   * Close Redis connection (for cleanup)
   */
  async disconnect(): Promise<void> {
    if (redisClient) {
      await redisClient.quit()
      redisClient = null
    }
  },
}
