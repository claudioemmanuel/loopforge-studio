/**
 * Autonomous Flow Manager
 *
 * Process Manager (Saga pattern) for orchestrating autonomous task workflows.
 * Handles the automatic progression: planning → execution → completion
 */

import type { Redis } from "ioredis";
import { EventSubscriber } from "@/lib/contexts/domain-events";
import type { DomainEvent } from "@/lib/contexts/domain-events/types";
import { TaskRepository } from "./task-repository";
import { db } from "@/lib/db";
import { tasks, users, repos, executions } from "@/lib/db/schema/tables";
import { eq, and, inArray } from "drizzle-orm";
import { queueExecution } from "@/lib/queue";
import {
  getProviderApiKey,
  getPreferredModel,
  findConfiguredProvider,
} from "@/lib/api";

/**
 * Autonomous flow manager for process orchestration
 */
export class AutonomousFlowManager {
  private subscriber: EventSubscriber;
  private taskRepository: TaskRepository;
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
    this.subscriber = EventSubscriber.getInstance(redis);
    this.taskRepository = new TaskRepository(redis);
  }

  /**
   * Start event subscriptions
   */
  async start(): Promise<void> {
    // Subscribe to Planning events
    this.subscriber.subscribe({
      eventType: "Task.PlanningCompleted",
      handler: this.handlePlanningCompleted.bind(this),
      subscriberId: "autonomous-flow-plan-to-execute",
      priority: 3, // High priority (before analytics)
    });

    // Subscribe to Execution events
    this.subscriber.subscribe({
      eventType: "Execution.ExecutionCompleted",
      handler: this.handleExecutionCompleted.bind(this),
      subscriberId: "autonomous-flow-execute-to-done",
      priority: 3, // High priority (before analytics)
    });

    // Subscribe to Execution failures
    this.subscriber.subscribe({
      eventType: "Execution.ExecutionFailed",
      handler: this.handleExecutionFailed.bind(this),
      subscriberId: "autonomous-flow-execute-failed",
      priority: 3, // High priority (before analytics)
    });

    console.log("[AutonomousFlowManager] Subscriptions registered");
  }

  /**
   * Handle Task.PlanningCompleted event
   *
   * When planning completes and autonomous mode is enabled, automatically queue execution.
   */
  private async handlePlanningCompleted(event: DomainEvent): Promise<void> {
    const { taskId } = event.data;

    console.log(
      `[AutonomousFlowManager] PlanningCompleted for task ${taskId}, checking autonomous mode`,
    );

    try {
      // Get task aggregate
      const taskAggregate = await this.taskRepository.findById(taskId);
      if (!taskAggregate) {
        console.warn(
          `[AutonomousFlowManager] Task ${taskId} not found, skipping`,
        );
        return;
      }

      const state = taskAggregate.getState();

      // Check if autonomous mode is enabled
      if (!state.configuration.autonomousMode) {
        console.log(
          `[AutonomousFlowManager] Task ${taskId} is not in autonomous mode, skipping auto-execution`,
        );
        return;
      }

      // Task should already be in ready status after planning completion
      if (state.status !== "ready") {
        console.warn(
          `[AutonomousFlowManager] Task ${taskId} is not in ready status (current: ${state.status}), skipping`,
        );
        return;
      }

      // Check for blocking dependencies
      if (state.blockedByIds.length > 0) {
        const blockerTasks = await db.query.tasks.findMany({
          where: inArray(tasks.id, state.blockedByIds),
          columns: { id: true, title: true, status: true },
        });

        const incompleteBlockers = blockerTasks.filter(
          (blocker) => blocker.status !== "done",
        );

        if (incompleteBlockers.length > 0) {
          console.log(
            `[AutonomousFlowManager] Task ${taskId} is blocked by ${incompleteBlockers.length} incomplete dependencies, skipping`,
          );
          return;
        }
      }

      // Get full task data from database (needed for queueExecution)
      const [taskData] = await db
        .select({
          id: tasks.id,
          repoId: tasks.repoId,
          userId: tasks.userId,
          planContent: tasks.planContent,
          repo: {
            cloneUrl: repos.cloneUrl,
            defaultBranch: repos.defaultBranch,
          },
          user: {
            id: users.id,
            anthropicApiKey: users.anthropicApiKey,
            openaiApiKey: users.openaiApiKey,
            geminiApiKey: users.geminiApiKey,
            preferredProvider: users.preferredProvider,
            preferredModel: users.preferredModel,
          },
        })
        .from(tasks)
        .innerJoin(repos, eq(tasks.repoId, repos.id))
        .innerJoin(users, eq(tasks.userId, users.id))
        .where(eq(tasks.id, taskId));

      if (!taskData) {
        console.error(
          `[AutonomousFlowManager] Could not fetch task data for ${taskId}`,
        );
        return;
      }

      // Check for configured provider
      const configuredProvider = findConfiguredProvider(taskData.user);
      if (!configuredProvider) {
        console.warn(
          `[AutonomousFlowManager] No provider configured for user ${taskData.userId}, cannot auto-execute`,
        );
        return;
      }

      const encryptedKey = getProviderApiKey(taskData.user, configuredProvider);
      if (!encryptedKey) {
        console.warn(
          `[AutonomousFlowManager] No API key for provider ${configuredProvider}, cannot auto-execute`,
        );
        return;
      }

      const finalProvider = configuredProvider;
      const finalModel = getPreferredModel(taskData.user, configuredProvider);

      // Generate branch name
      const branch = `loopforge/${taskId.slice(0, 8)}`;

      // ATOMIC: Claim the execution slot
      const claimResult = await db
        .update(tasks)
        .set({
          status: "executing",
          branch,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tasks.id, taskId),
            eq(tasks.status, "ready"), // Only claim if still ready
          ),
        )
        .returning({ id: tasks.id });

      // If no rows were updated, task is no longer in ready status
      if (claimResult.length === 0) {
        console.warn(
          `[AutonomousFlowManager] Task ${taskId} is no longer in ready status, skipping`,
        );
        return;
      }

      // Create execution record
      const executionId = crypto.randomUUID();
      await db.insert(executions).values({
        id: executionId,
        taskId: taskId,
        status: "queued",
        iteration: 0,
        createdAt: new Date(),
      });

      // Queue the execution job
      const job = await queueExecution({
        executionId,
        taskId: taskId,
        repoId: taskData.repoId,
        userId: taskData.userId,
        aiProvider: finalProvider,
        preferredModel: finalModel,
        planContent: taskData.planContent || "",
        branch,
        defaultBranch: taskData.repo.defaultBranch || "main",
        cloneUrl: taskData.repo.cloneUrl,
      });

      console.log(
        `[AutonomousFlowManager] Queued execution for task ${taskId}: executionId=${executionId}, jobId=${job.id}`,
      );

      // Update task aggregate to reflect execution start
      await taskAggregate.startExecution({
        executionId,
        branchName: branch,
      });
      await this.taskRepository.save(taskAggregate);
    } catch (error) {
      console.error(
        `[AutonomousFlowManager] Error auto-queueing execution for task ${taskId}:`,
        error,
      );

      // Revert status on error
      try {
        await db
          .update(tasks)
          .set({ status: "ready", branch: null, updatedAt: new Date() })
          .where(
            and(eq(tasks.id, taskId), eq(tasks.status, "executing")), // Only revert if we set it
          );
      } catch (revertError) {
        console.error(
          `[AutonomousFlowManager] Error reverting task ${taskId} status:`,
          revertError,
        );
      }

      // Don't throw - event processing should be resilient
    }
  }

  /**
   * Handle Execution.ExecutionCompleted event
   *
   * When execution completes, transition task to done (or review if PR created).
   */
  private async handleExecutionCompleted(event: DomainEvent): Promise<void> {
    const { taskId, executionId, prUrl, commitCount } = event.data;

    console.log(
      `[AutonomousFlowManager] ExecutionCompleted for task ${taskId}, transitioning to done/review`,
    );

    try {
      // Get task aggregate
      const taskAggregate = await this.taskRepository.findById(taskId);
      if (!taskAggregate) {
        console.warn(
          `[AutonomousFlowManager] Task ${taskId} not found, skipping`,
        );
        return;
      }

      const state = taskAggregate.getState();

      // Only process if task is still executing
      if (state.status !== "executing") {
        console.log(
          `[AutonomousFlowManager] Task ${taskId} is no longer executing (current: ${state.status}), skipping`,
        );
        return;
      }

      // Complete execution with result
      await taskAggregate.completeExecution({
        executionId,
        branchName: state.executionResult?.branchName || "",
        commitCount: commitCount || 0,
        prUrl: prUrl || undefined,
      });

      // Save updated aggregate
      await this.taskRepository.save(taskAggregate);

      console.log(
        `[AutonomousFlowManager] Task ${taskId} transitioned to ${taskAggregate.getStatus()}`,
      );
    } catch (error) {
      console.error(
        `[AutonomousFlowManager] Error completing task ${taskId}:`,
        error,
      );
      // Don't throw - event processing should be resilient
    }
  }

  /**
   * Handle Execution.ExecutionFailed event
   *
   * When execution fails, mark task as stuck.
   */
  private async handleExecutionFailed(event: DomainEvent): Promise<void> {
    const { taskId, executionId, error } = event.data;

    console.log(
      `[AutonomousFlowManager] ExecutionFailed for task ${taskId}, marking as stuck`,
    );

    try {
      // Get task aggregate
      const taskAggregate = await this.taskRepository.findById(taskId);
      if (!taskAggregate) {
        console.warn(
          `[AutonomousFlowManager] Task ${taskId} not found, skipping`,
        );
        return;
      }

      const state = taskAggregate.getState();

      // Only process if task is still executing
      if (state.status !== "executing") {
        console.log(
          `[AutonomousFlowManager] Task ${taskId} is no longer executing (current: ${state.status}), skipping`,
        );
        return;
      }

      // Fail execution
      await taskAggregate.failExecution({
        executionId,
        error: error || "Execution failed",
      });

      // Save updated aggregate
      await this.taskRepository.save(taskAggregate);

      console.log(`[AutonomousFlowManager] Task ${taskId} marked as stuck`);
    } catch (error) {
      console.error(
        `[AutonomousFlowManager] Error marking task ${taskId} as stuck:`,
        error,
      );
      // Don't throw - event processing should be resilient
    }
  }

  /**
   * Stop event subscriptions
   */
  async stop(): Promise<void> {
    // EventSubscriber doesn't currently support unsubscribe
    // This is a placeholder for future implementation
    console.log("[AutonomousFlowManager] Stopped");
  }
}
