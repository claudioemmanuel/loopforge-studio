import { Worker } from 'bullmq'
import { prisma } from '../prisma/client.js'
import { redisConnection, getRepoQueueName, executionQueue, enqueueExecution } from './queue.js'
import type { ExecutionJobData } from './queue.js'
import { Stage, LogLevel, EventType } from '@loopforge/shared'
import { emitStageChanged, emitTaskUpdated } from '../realtime/board.gateway.js'
import { GithubService } from '../services/github.service.js'
import { createProvider } from '../providers/provider.interface.js'
import { Provider } from '@loopforge/shared'
import type { AIMessage } from '../providers/provider.interface.js'
import { extractCodeBlocks } from '../utils/code-extractor.js'
import type { ExtractedFile } from '../utils/code-extractor.js'
import { resolveFilePaths } from '../utils/path-resolver.js'
import { RepositoryContextService } from '../services/repository-context.service.js'
import { generatePRBody } from '../utils/pr-generator.js'

const PROTECTED_BRANCHES = new Set(['main', 'master', 'develop', 'trunk'])

async function appendLog(
  taskId: string,
  sequence: number,
  level: LogLevel,
  message: string,
  metadata?: Record<string, unknown>,
) {
  await prisma.executionLog.create({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { taskId, sequence, level, message, metadata: (metadata as any) ?? undefined },
  })
}

async function updateTaskStage(userId: string, taskId: string, stage: Stage, fromStage: Stage) {
  const task = await prisma.task.update({ where: { id: taskId }, data: { stage } })
  const dto = {
    id: task.id,
    userId: task.userId,
    repositoryId: task.repositoryId,
    title: task.title,
    description: task.description,
    stage: task.stage as Stage,
    featureBranch: task.featureBranch,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }
  emitStageChanged(userId, taskId, fromStage, stage)
  emitTaskUpdated(userId, dto)
  return dto
}

async function executeTask(job: { data: ExecutionJobData }) {
  const { taskId, userId, repositoryId, planSteps } = job.data
  let seq = 0

  // Transition to EXECUTING
  const task = await prisma.task.findFirstOrThrow({
    where: { id: taskId, userId },
    include: { repository: true },
  })

  await updateTaskStage(userId, taskId, Stage.EXECUTING, Stage.READY)
  await prisma.analyticsEvent.create({
    data: { userId, taskId, repositoryId, eventType: EventType.EXECUTION_STARTED },
  })

  const repo = task.repository
  if (!repo) {
    await appendLog(taskId, ++seq, LogLevel.ERROR, 'No repository connected to this task')
    await updateTaskStage(userId, taskId, Stage.STUCK, Stage.EXECUTING)
    return
  }

  // Guard: never commit to protected branch
  const featureBranch = `loopforge/${taskId.slice(0, 8)}-${task.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 40)}`

  if (PROTECTED_BRANCHES.has(featureBranch)) {
    await appendLog(taskId, ++seq, LogLevel.ERROR, `Branch name "${featureBranch}" is protected. Aborting.`)
    await updateTaskStage(userId, taskId, Stage.STUCK, Stage.EXECUTING)
    return
  }

  try {
    // Create feature branch
    await appendLog(taskId, ++seq, LogLevel.ACTION, `Creating feature branch: ${featureBranch}`)
    await GithubService.createBranch(userId, repo.owner, repo.name, featureBranch, repo.defaultBranch)

    // Update task with branch name
    await prisma.task.update({ where: { id: taskId }, data: { featureBranch } })
    await appendLog(taskId, ++seq, LogLevel.INFO, `Branch created: ${featureBranch}`)

    // Get AI provider
    const config = await prisma.providerConfig.findFirst({ where: { userId, isDefault: true } })
    const providerEnum = (config?.provider as Provider) ?? Provider.ANTHROPIC
    const aiProvider = await createProvider(userId, providerEnum)

    // Get repository context ONCE (outside step loop)
    await appendLog(taskId, ++seq, LogLevel.INFO, 'Fetching repository context...')
    const repositoryContext = await RepositoryContextService.buildContext(
      userId,
      { owner: repo.owner, name: repo.name, defaultBranch: repo.defaultBranch },
      planSteps
    )

    // Execute each plan step via AI — collect REAL CODE outputs
    const stepOutputs: Array<{ step: typeof planSteps[number]; output: string }> = []

    for (const step of planSteps) {
      await appendLog(
        taskId,
        ++seq,
        LogLevel.ACTION,
        `Step ${step.stepNumber}: ${step.description}`,
      )

      // NEW PROMPT - generates actual code
      const messages: AIMessage[] = [
        {
          role: 'user',
          content: `You are implementing a code change for: "${task.title}"

Repository: ${repo.fullName}
Branch: ${featureBranch}

STEP ${step.stepNumber}: ${step.description}
Estimated changes: ${step.estimatedChanges}

REPOSITORY CONTEXT:
${repositoryContext}

CRITICAL INSTRUCTIONS:
Generate COMPLETE, WORKING code for this step. Your response MUST:
1. Include actual TypeScript/JavaScript code, NOT descriptions
2. Use proper syntax, imports, and types
3. Follow existing code style in the repository
4. Be production-ready

FORMAT YOUR RESPONSE EXACTLY LIKE THIS:

\`\`\`typescript
// File: path/to/file.ts
[COMPLETE FILE CONTENT HERE - FULL FILE, NOT SNIPPETS]
\`\`\`

If multiple files need changes, use multiple code blocks.
DO NOT write explanations outside code blocks.
DO NOT use placeholders like "// ... rest of code".
WRITE THE ENTIRE FILE CONTENT.`,
        },
      ]

      let stepOutput = ''
      let tokenCount = 0

      for await (const chunk of aiProvider.provider.stream(messages, {
        model: aiProvider.defaultModel,
        maxTokens: 4096,  // Increased for full files
        systemPrompt: `You are a senior fullstack developer. Generate production-ready code.`,
      })) {
        stepOutput += chunk
        tokenCount += Math.ceil(chunk.length / 4)
      }

      stepOutputs.push({ step, output: stepOutput })
      await appendLog(taskId, ++seq, LogLevel.INFO, `Step ${step.stepNumber} completed`)

      await prisma.analyticsEvent.create({
        data: {
          userId,
          taskId,
          repositoryId,
          eventType: EventType.STAGE_CHANGED,
          provider: providerEnum,
          model: aiProvider.defaultModel,
          tokensUsed: tokenCount,
        },
      })
    }

    // Extract code blocks from AI outputs
    await appendLog(taskId, ++seq, LogLevel.INFO, 'Extracting code from AI output...')
    const allExtractedFiles: ExtractedFile[] = []
    for (const { output } of stepOutputs) {
      const files = extractCodeBlocks(output)
      allExtractedFiles.push(...files)
    }

    if (allExtractedFiles.length === 0) {
      await appendLog(taskId, ++seq, LogLevel.ERROR, 'No code files extracted from AI output')
      await updateTaskStage(userId, taskId, Stage.STUCK, Stage.EXECUTING)
      await prisma.analyticsEvent.create({
        data: { userId, taskId, repositoryId, eventType: EventType.STUCK_DETECTED },
      })
      return
    }

    await appendLog(taskId, ++seq, LogLevel.INFO, `Extracted ${allExtractedFiles.length} file(s)`)

    // Resolve file paths
    const fileTree = await RepositoryContextService.getFileTree(
      userId,
      repo.owner,
      repo.name,
      repo.defaultBranch
    )
    const filesToCommit = resolveFilePaths(allExtractedFiles, fileTree)

    // Create commit with ACTUAL SOURCE CODE
    const commitFiles = Array.from(filesToCommit.entries()).map(([path, content]) => ({
      path,
      content,
    }))

    await appendLog(taskId, ++seq, LogLevel.ACTION, `Committing ${commitFiles.length} file(s) to ${featureBranch}`)
    const commitSha = await GithubService.createCommit(
      userId,
      repo.owner,
      repo.name,
      featureBranch,
      `feat: ${task.title}\n\n${planSteps.map((s, i) => `${i + 1}. ${s.description}`).join('\n')}\n\nCo-Authored-By: Loopforge Studio <noreply@loopforge.dev>`,
      commitFiles,
    )
    await prisma.commit.create({
      data: {
        taskId,
        repositoryId,
        sha: commitSha,
        branch: featureBranch,
        message: `feat: ${task.title}`,
        filesChanged: commitFiles.length,
        committedAt: new Date(),
      },
    })

    await appendLog(
      taskId,
      ++seq,
      LogLevel.COMMIT,
      `Committed ${commitFiles.length} file(s) to ${featureBranch} (${commitSha.slice(0, 8)})`,
    )

    await prisma.analyticsEvent.create({
      data: { userId, taskId, repositoryId, eventType: EventType.COMMIT_PUSHED },
    })

    // Transition to CODE_REVIEW instead of DONE
    await updateTaskStage(userId, taskId, Stage.CODE_REVIEW, Stage.EXECUTING)
    await prisma.analyticsEvent.create({
      data: { userId, taskId, repositoryId, eventType: EventType.EXECUTION_COMPLETED },
    })

    // Create Pull Request
    await appendLog(taskId, ++seq, LogLevel.ACTION, 'Creating pull request...')
    const prData = await GithubService.createPullRequest(
      userId,
      repo.owner,
      repo.name,
      {
        title: `feat: ${task.title}`,
        body: generatePRBody(task, planSteps, commitSha),
        head: featureBranch,
        base: repo.defaultBranch,
      }
    )

    // Store PR URL
    await prisma.task.update({
      where: { id: taskId },
      data: { pullRequestUrl: prData.url },
    })

    await appendLog(taskId, ++seq, LogLevel.INFO, `Pull request created: ${prData.url}`)

    await prisma.analyticsEvent.create({
      data: { userId, taskId, repositoryId, eventType: EventType.PR_CREATED },
    })

    // If autonomous mode, trigger auto-merge
    if (task.autonomousMode) {
      await handleAutonomousMerge(userId, taskId, repo, prData.number, seq)
    } else {
      await appendLog(taskId, ++seq, LogLevel.INFO, 'Awaiting manual code review')
    }
  } catch (err) {
    const message = (err as Error).message
    await appendLog(taskId, ++seq, LogLevel.ERROR, `Execution failed: ${message}`)
    await updateTaskStage(userId, taskId, Stage.STUCK, Stage.EXECUTING)
    await prisma.analyticsEvent.create({
      data: { userId, taskId, repositoryId, eventType: EventType.STUCK_DETECTED },
    })
  }
}

/**
 * Handles autonomous merge for tasks with autonomousMode enabled.
 * Polls PR status and auto-merges when CI checks pass.
 */
async function handleAutonomousMerge(
  userId: string,
  taskId: string,
  repo: { owner: string; name: string },
  prNumber: number,
  seq: number
) {
  await appendLog(taskId, seq + 1, LogLevel.INFO, 'Autonomous mode: waiting for CI checks...')

  // Poll PR status every 30 seconds (max 20 minutes = 40 attempts)
  const maxAttempts = 40

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, 30000)) // 30s delay

    try {
      const status = await GithubService.getPullRequestStatus(userId, repo.owner, repo.name, prNumber)

      if (!status.mergeable) {
        await updateTaskStage(userId, taskId, Stage.STUCK, Stage.CODE_REVIEW)
        await appendLog(taskId, seq + i + 2, LogLevel.ERROR, 'PR has merge conflicts')
        await prisma.analyticsEvent.create({
          data: { userId, taskId, repositoryId: null, eventType: EventType.PR_MERGE_FAILED },
        })
        return
      }

      if (status.checks.passing) {
        await GithubService.mergePullRequest(userId, repo.owner, repo.name, prNumber, 'squash')
        await updateTaskStage(userId, taskId, Stage.DONE, Stage.CODE_REVIEW)
        await appendLog(taskId, seq + i + 2, LogLevel.INFO, 'PR auto-merged successfully')
        await prisma.analyticsEvent.create({
          data: { userId, taskId, repositoryId: null, eventType: EventType.PR_MERGED },
        })
        return
      }
    } catch (error) {
      const message = (error as Error).message
      await appendLog(taskId, seq + i + 2, LogLevel.ERROR, `PR status check failed: ${message}`)
    }
  }

  // Timeout - leave in CODE_REVIEW
  await appendLog(taskId, seq + maxAttempts + 2, LogLevel.INFO, 'Auto-merge timeout - manual review required')
}

/**
 * Start BullMQ workers for all repo-scoped queues.
 * In production, you'd dynamically discover queues; here we start a general worker
 * that handles execution-queue and delegates per-repo serialization.
 */
export function startExecutionWorkers() {
  const worker = new Worker<ExecutionJobData>(
    'execution-queue',
    async (job) => executeTask(job),
    {
      connection: redisConnection,
      concurrency: 5,
    },
  )

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed:`, err)
  })

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.id} completed`)
  })

  return worker
}

/**
 * Recovers orphaned tasks in READY or EXECUTING stages by re-enqueueing them.
 * This handles cases where tasks were enqueued before a bug fix or the queue was cleared.
 */
export async function recoverOrphanedTasks() {
  const orphanedTasks = await prisma.task.findMany({
    where: {
      stage: { in: [Stage.READY, Stage.EXECUTING] },
    },
    include: { executionPlan: true },
  })

  for (const task of orphanedTasks) {
    // Check if job exists in queue
    const job = await executionQueue.getJob(`task-${task.id}`)
    if (!job && task.repositoryId && task.executionPlan) {
      const steps = task.executionPlan.steps as Array<{
        stepNumber: number
        description: string
        estimatedChanges: string
      }>

      // Re-enqueue
      await enqueueExecution({
        taskId: task.id,
        userId: task.userId,
        repositoryId: task.repositoryId,
        planSteps: steps,
      })

      console.log(`[Recovery] Re-enqueued orphaned task: ${task.id} (${task.title})`)
    }
  }
}
