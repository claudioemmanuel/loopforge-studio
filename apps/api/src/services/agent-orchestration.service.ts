import { prisma } from '../prisma/client.js'
import { Stage, AgentCategory, AgentExecutionStatus } from '@loopforge/shared'
import { AgentService } from './agent.service.js'
import { AgentContextService } from './agent-context.service.js'
import { AgentExecutionService } from './agent-execution.service.js'
import type { Agent, AgentExecution } from '@prisma/client'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AggregatedResults {
  hasIssues: boolean
  qualityScore: number | null
  testCoverage: number | null
  securityIssues: {
    critical: number
    high: number
    medium: number
    low: number
  }
  recommendations: Recommendation[]
  agentOutputs: Record<string, unknown>
}

export interface Recommendation {
  agentId: string
  agentName: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: string
  message: string
  suggestion: string
  file?: string
  line?: number
}

// ── Stage-to-Category Mapping ─────────────────────────────────────────────────

const STAGE_AGENT_CATEGORIES: Record<Stage, AgentCategory[]> = {
  [Stage.TODO]: [],
  [Stage.BRAINSTORMING]: [
    AgentCategory.META_ORCHESTRATION,
    AgentCategory.BUSINESS_PRODUCT,
    AgentCategory.RESEARCH_ANALYSIS,
  ],
  [Stage.PLANNING]: [
    AgentCategory.CORE_DEVELOPMENT,
    AgentCategory.INFRASTRUCTURE,
    AgentCategory.DATA_AI,
  ],
  [Stage.READY]: [],
  [Stage.EXECUTING]: [
    AgentCategory.QUALITY_SECURITY,
    AgentCategory.LANGUAGE_SPECIALIST,
    AgentCategory.CORE_DEVELOPMENT,
  ],
  [Stage.CODE_REVIEW]: [
    AgentCategory.QUALITY_SECURITY,
    AgentCategory.DEVELOPER_EXPERIENCE,
  ],
  [Stage.DONE]: [],
  [Stage.STUCK]: [],
}

// ── Service ────────────────────────────────────────────────────────────────────

export const AgentOrchestrationService = {
  /**
   * Orchestrate agents for a specific workflow stage
   */
  async orchestrateStage(taskId: string, stage: Stage): Promise<void> {
    // Get task with repository
    const task = await prisma.task.findUniqueOrThrow({
      where: { id: taskId },
      include: { repository: true },
    })

    if (!task.repositoryId) {
      console.warn(`Task ${taskId} has no repository, skipping agent orchestration`)
      return
    }

    // Determine which agents to run
    const agents = await this.determineAgentsForStage(task.repositoryId, stage)

    if (agents.length === 0) {
      console.log(`No agents configured for stage ${stage}`)
      return
    }

    // Get or create context
    const contextKey = await AgentContextService.getOrCreateContext(taskId)

    // Execute agents in parallel
    const executions = await this.executeAgentsInParallel(taskId, agents, contextKey, stage)

    // Wait for all agents to complete
    await this.waitForAgentCompletion(executions.map((e) => e.id))

    // Aggregate results
    const results = await this.aggregateResults(executions.map((e) => e.id))

    // Apply recommendations if there are issues
    if (results.hasIssues) {
      await this.applyAgentRecommendations(taskId, results)
    }
  },

  /**
   * Determine which agents should run at a specific stage
   */
  async determineAgentsForStage(repositoryId: string, stage: Stage): Promise<Agent[]> {
    const relevantCategories = STAGE_AGENT_CATEGORIES[stage] || []

    if (relevantCategories.length === 0) {
      return []
    }

    // Get enabled agents for this project in relevant categories
    const allEnabledAgents = await AgentService.getEnabledAgentsForProject(
      repositoryId,
      stage
    )

    // Filter by category
    const agents = allEnabledAgents.filter((agent) =>
      relevantCategories.includes(agent.category)
    )

    return agents as unknown as Agent[]
  },

  /**
   * Execute multiple agents in parallel
   */
  async executeAgentsInParallel(
    taskId: string,
    agents: Agent[],
    contextKey: string,
    stage: Stage
  ): Promise<AgentExecution[]> {
    const executions: AgentExecution[] = []

    for (const agent of agents) {
      const execution = await AgentExecutionService.create(
        taskId,
        agent.id,
        stage,
        contextKey
      )
      executions.push(execution)
    }

    // TODO: In Phase 3, enqueue jobs to BullMQ for parallel execution
    // For now, create execution records
    console.log(
      `Created ${executions.length} agent execution records for task ${taskId}`
    )

    return executions
  },

  /**
   * Wait for all agent executions to complete
   */
  async waitForAgentCompletion(executionIds: string[]): Promise<void> {
    // Poll for completion
    const maxWaitTime = 300000 // 5 minutes
    const pollInterval = 2000 // 2 seconds
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      const executions = await prisma.agentExecution.findMany({
        where: { id: { in: executionIds } },
      })

      const allComplete = executions.every(
        (e) =>
          e.status === AgentExecutionStatus.COMPLETED ||
          e.status === AgentExecutionStatus.FAILED ||
          e.status === AgentExecutionStatus.CANCELLED
      )

      if (allComplete) {
        return
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval))
    }

    // Timeout - cancel remaining executions
    await prisma.agentExecution.updateMany({
      where: {
        id: { in: executionIds },
        status: { in: [AgentExecutionStatus.QUEUED, AgentExecutionStatus.RUNNING] },
      },
      data: { status: AgentExecutionStatus.CANCELLED },
    })

    throw new Error(`Agent executions timed out after ${maxWaitTime}ms`)
  },

  /**
   * Aggregate results from multiple agent executions
   */
  async aggregateResults(executionIds: string[]): Promise<AggregatedResults> {
    const executions = await prisma.agentExecution.findMany({
      where: { id: { in: executionIds } },
      include: { agent: true },
    })

    const results: AggregatedResults = {
      hasIssues: false,
      qualityScore: null,
      testCoverage: null,
      securityIssues: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      recommendations: [],
      agentOutputs: {},
    }

    for (const execution of executions) {
      if (execution.status !== AgentExecutionStatus.COMPLETED) {
        continue
      }

      const output = execution.output as Record<string, unknown> | null
      if (!output) {
        continue
      }

      // Store agent output
      results.agentOutputs[execution.agentId] = output

      // Parse agent-specific outputs
      if (execution.agent.name === 'code-reviewer') {
        results.qualityScore = (output.qualityScore as number) ?? null
        const issues = (output.issues as Array<Record<string, unknown>>) ?? []
        results.hasIssues = results.hasIssues || issues.length > 0

        for (const issue of issues) {
          results.recommendations.push({
            agentId: execution.agentId,
            agentName: execution.agent.displayName,
            severity: (issue.severity as Recommendation['severity']) ?? 'low',
            category: (issue.category as string) ?? 'unknown',
            message: (issue.message as string) ?? '',
            suggestion: (issue.suggestion as string) ?? '',
            file: issue.file as string | undefined,
            line: issue.line as number | undefined,
          })
        }
      }

      if (execution.agent.name === 'test-runner') {
        const coverage = output.coverage as Record<string, unknown> | undefined
        results.testCoverage = (coverage?.lines as number) ?? null
      }

      if (execution.agent.name === 'security-auditor') {
        const vulnerabilities =
          (output.vulnerabilities as Array<Record<string, unknown>>) ?? []
        results.hasIssues = results.hasIssues || vulnerabilities.length > 0

        for (const vuln of vulnerabilities) {
          const severity = (vuln.severity as string) ?? 'low'
          if (severity === 'critical') results.securityIssues.critical++
          else if (severity === 'high') results.securityIssues.high++
          else if (severity === 'medium') results.securityIssues.medium++
          else results.securityIssues.low++

          results.recommendations.push({
            agentId: execution.agentId,
            agentName: execution.agent.displayName,
            severity: severity as Recommendation['severity'],
            category: (vuln.category as string) ?? 'security',
            message: (vuln.description as string) ?? '',
            suggestion: (vuln.remediation as string) ?? '',
            file: vuln.file as string | undefined,
            line: vuln.line as number | undefined,
          })
        }
      }
    }

    return results
  },

  /**
   * Apply agent recommendations to the task
   */
  async applyAgentRecommendations(
    taskId: string,
    results: AggregatedResults
  ): Promise<void> {
    // Log recommendations to execution logs
    const criticalRecommendations = results.recommendations.filter(
      (r) => r.severity === 'critical'
    )
    const highRecommendations = results.recommendations.filter((r) => r.severity === 'high')

    if (criticalRecommendations.length > 0) {
      await prisma.executionLog.create({
        data: {
          taskId,
          sequence: await this.getNextLogSequence(taskId),
          level: 'ERROR',
          message: `🚨 Agents found ${criticalRecommendations.length} critical issues`,
          metadata: { recommendations: criticalRecommendations } as any,
        },
      })
    }

    if (highRecommendations.length > 0) {
      await prisma.executionLog.create({
        data: {
          taskId,
          sequence: await this.getNextLogSequence(taskId),
          level: 'ACTION',
          message: `⚠️  Agents found ${highRecommendations.length} high-priority issues`,
          metadata: { recommendations: highRecommendations } as any,
        },
      })
    }

    // TODO: In future phases, automatically apply fixes for certain types of issues
    // For now, just log them for human review
  },

  /**
   * Get next log sequence number for a task
   */
  async getNextLogSequence(taskId: string): Promise<number> {
    const lastLog = await prisma.executionLog.findFirst({
      where: { taskId },
      orderBy: { sequence: 'desc' },
    })
    return (lastLog?.sequence ?? 0) + 1
  },
}
