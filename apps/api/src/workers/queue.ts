import { Queue, Worker, type Job } from 'bullmq'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

// Parse Redis URL for IORedis connection options
function parseRedisUrl(url: string) {
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
    db: parseInt(parsed.pathname.replace('/', '') || '0', 10),
  }
}

const redisConnection = parseRedisUrl(REDIS_URL)

// ── Execution queue ────────────────────────────────────────────────────────────

export interface ExecutionJobData {
  taskId: string
  userId: string
  repositoryId: string
  planSteps: Array<{ stepNumber: number; description: string; estimatedChanges: string }>
}

export const executionQueue = new Queue<ExecutionJobData>('execution-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  },
})

/**
 * Returns a per-repo named queue to serialize execution for a single repository.
 * BullMQ named queues with concurrency=1 ensure no two tasks run on the same repo simultaneously.
 */
export function getRepoQueueName(repositoryId: string): string {
  return `execution-repo-${repositoryId}`
}

/**
 * Creates a repo-scoped queue for serialized execution.
 */
export function getRepoQueue(repositoryId: string): Queue<ExecutionJobData> {
  return new Queue<ExecutionJobData>(getRepoQueueName(repositoryId), {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    },
  })
}

/**
 * Enqueues an execution job for a task.
 * Adds directly to executionQueue so the worker picks it up.
 */
export async function enqueueExecution(data: ExecutionJobData): Promise<Job<ExecutionJobData>> {
  return executionQueue.add(`execute-task-${data.taskId}`, data, {
    jobId: `task-${data.taskId}`,
  })
}

// ── Agent orchestration queues ─────────────────────────────────────────────────

export interface AgentOrchestrationJobData {
  taskId: string
  stage: string
  agentIds: string[]
  contextKey: string
}

export interface AgentExecutionJobData {
  taskId: string
  agentId: string
  executionId: string
  stage: string
  contextKey: string
}

/**
 * Main orchestration queue that spawns parallel agent jobs
 */
export const agentOrchestrationQueue = new Queue<AgentOrchestrationJobData>(
  'agent-orchestration',
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 25 },
    },
  }
)

/**
 * Per-agent execution queues for parallel execution
 * Cached to avoid creating multiple queue instances
 */
const agentExecutionQueues = new Map<string, Queue<AgentExecutionJobData>>()

export function getAgentQueue(agentId: string): Queue<AgentExecutionJobData> {
  if (!agentExecutionQueues.has(agentId)) {
    const queue = new Queue<AgentExecutionJobData>(`agent-${agentId}`, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 25 },
      },
    })
    agentExecutionQueues.set(agentId, queue)
  }
  return agentExecutionQueues.get(agentId)!
}

/**
 * Enqueue agent orchestration for a stage
 */
export async function enqueueAgentOrchestration(
  data: AgentOrchestrationJobData
): Promise<Job<AgentOrchestrationJobData>> {
  return agentOrchestrationQueue.add(
    `orchestrate-${data.taskId}-${data.stage}`,
    data,
    {
      jobId: `orchestrate-${data.taskId}-${data.stage}`,
    }
  )
}

/**
 * Enqueue individual agent execution
 */
export async function enqueueAgentExecution(
  agentId: string,
  data: AgentExecutionJobData
): Promise<Job<AgentExecutionJobData>> {
  const queue = getAgentQueue(agentId)
  return queue.add(`execute-${data.executionId}`, data, {
    jobId: `execute-${data.executionId}`,
  })
}

export { redisConnection, Worker }
