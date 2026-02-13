import { Worker, type Job } from 'bullmq'
import { prisma } from '../prisma/client.js'
import { AgentExecutionStatus, LogLevel } from '@loopforge/shared'
import { AgentContextService } from '../services/agent-context.service.js'
import { AgentExecutionService } from '../services/agent-execution.service.js'
import {
  redisConnection,
  getAgentQueue,
  type AgentOrchestrationJobData,
  type AgentExecutionJobData,
} from './queue.js'

// ── Orchestration Worker ───────────────────────────────────────────────────────

/**
 * Worker that spawns parallel agent jobs
 */
export const orchestrationWorker = new Worker<AgentOrchestrationJobData>(
  'agent-orchestration',
  async (job: Job<AgentOrchestrationJobData>) => {
    const { taskId, stage, agentIds, contextKey } = job.data

    console.log(
      `[Orchestration] Starting orchestration for task ${taskId}, stage ${stage}`
    )

    // Create execution records for all agents
    const executionPromises = agentIds.map(async (agentId) => {
      const execution = await AgentExecutionService.create(
        taskId,
        agentId,
        stage as any,
        contextKey
      )

      // Enqueue to agent-specific queue
      const agentQueue = getAgentQueue(agentId)
      await agentQueue.add(`execute-${execution.id}`, {
        taskId,
        agentId,
        executionId: execution.id,
        stage,
        contextKey,
      })

      return execution.id
    })

    const executionIds = await Promise.all(executionPromises)

    console.log(
      `[Orchestration] Spawned ${executionIds.length} agent executions for task ${taskId}`
    )

    return { executionIds }
  },
  {
    connection: redisConnection,
    concurrency: 5, // 5 concurrent orchestrations
  }
)

orchestrationWorker.on('completed', (job) => {
  console.log(`[Orchestration] Job ${job.id} completed`)
})

orchestrationWorker.on('failed', (job, err) => {
  console.error(`[Orchestration] Job ${job?.id} failed:`, err)
})

// ── Agent Execution Worker Factory ────────────────────────────────────────────

/**
 * Create a worker for a specific agent type
 */
export function createAgentWorker(agentId: string, agentName: string): Worker {
  return new Worker<AgentExecutionJobData>(
    `agent-${agentId}`,
    async (job: Job<AgentExecutionJobData>) => {
      const { taskId, executionId, contextKey } = job.data

      console.log(`[${agentName}] Starting execution ${executionId} for task ${taskId}`)

      try {
        // Update status to RUNNING
        await AgentExecutionService.updateStatus(
          executionId,
          AgentExecutionStatus.RUNNING
        )

        // Get context
        const context = await AgentContextService.getContext(contextKey)
        if (!context) {
          throw new Error(`Context not found: ${contextKey}`)
        }

        // Get agent details
        const agent = await prisma.agent.findUnique({ where: { id: agentId } })
        if (!agent) {
          throw new Error(`Agent not found: ${agentId}`)
        }

        // Execute agent (mock implementation for now)
        // TODO: In Phase 3, implement actual AI provider integration
        await AgentExecutionService.appendLog(
          executionId,
          LogLevel.INFO,
          `Starting ${agent.displayName} analysis...`
        )

        // Simulate agent work
        await new Promise((resolve) => setTimeout(resolve, 2000))

        // Mock output based on agent type
        const mockOutput = generateMockOutput(agent.name, context)

        await AgentExecutionService.appendLog(
          executionId,
          LogLevel.INFO,
          `${agent.displayName} analysis complete`
        )

        // Record output
        await AgentExecutionService.recordOutput(executionId, mockOutput, {
          duration: 2000,
          tokensUsed: 0,
        })

        console.log(
          `[${agentName}] Completed execution ${executionId} for task ${taskId}`
        )

        return { success: true, executionId }
      } catch (error) {
        console.error(
          `[${agentName}] Failed execution ${executionId}:`,
          error
        )

        await AgentExecutionService.recordFailure(
          executionId,
          error instanceof Error ? error.message : String(error)
        )

        throw error
      }
    },
    {
      connection: redisConnection,
      concurrency: 3, // 3 concurrent executions per agent type
    }
  )
}

// ── Mock Output Generator ──────────────────────────────────────────────────────

function generateMockOutput(agentName: string, context: any): Record<string, unknown> {
  switch (agentName) {
    case 'code-reviewer':
      return {
        qualityScore: 85,
        issues: [
          {
            severity: 'medium',
            category: 'quality',
            file: 'example.ts',
            line: 42,
            message: 'Consider extracting this complex logic into a separate function',
            suggestion: 'Create a helper function for better readability',
          },
        ],
        strengths: ['Good error handling', 'Clear variable naming'],
        summary: 'Code quality is good with minor improvements suggested',
      }

    case 'test-runner':
      return {
        overallStatus: 'passed',
        coverage: {
          lines: 78.5,
          branches: 72.0,
          functions: 85.0,
          statements: 78.5,
        },
        testResults: [
          {
            suite: 'Unit Tests',
            passed: 45,
            failed: 0,
            skipped: 2,
            duration: 1234,
          },
        ],
        recommendations: ['Add tests for edge cases', 'Improve branch coverage'],
        summary: 'All tests passing with good coverage',
      }

    case 'security-auditor':
      return {
        riskLevel: 'low',
        vulnerabilities: [],
        dependencies: [],
        secrets: [],
        complianceIssues: [],
        summary: 'No security issues detected',
      }

    default:
      return {
        status: 'completed',
        message: `${agentName} analysis complete`,
      }
  }
}

// ── Worker Management ──────────────────────────────────────────────────────────

const activeWorkers: Worker[] = [orchestrationWorker]

/**
 * Initialize agent workers
 */
export async function initializeAgentWorkers() {
  // Get all active agents
  const agents = await prisma.agent.findMany({
    where: { isActive: true },
  })

  // Create worker for each agent
  for (const agent of agents) {
    const worker = createAgentWorker(agent.id, agent.name)
    activeWorkers.push(worker)
    console.log(`[Agent Worker] Initialized worker for ${agent.name}`)
  }

  console.log(`[Agent Workers] Initialized ${activeWorkers.length} workers`)
}

/**
 * Shutdown all agent workers gracefully
 */
export async function shutdownAgentWorkers() {
  console.log('[Agent Workers] Shutting down...')

  await Promise.all(activeWorkers.map((worker) => worker.close()))

  console.log('[Agent Workers] All workers shut down')
}
