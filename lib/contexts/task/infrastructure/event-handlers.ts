/**
 * Task Event Handlers
 *
 * Handles cross-context events that affect the Task context.
 * Subscribes to events from other bounded contexts and reacts accordingly.
 */

import type { Redis } from "ioredis";
import { EventSubscriber } from "@/lib/contexts/domain-events";
import type { DomainEvent } from "@/lib/contexts/domain-events/types";
import { TaskRepository } from "./task-repository";
import { db } from "@/lib/db";
import { tasks } from "@/lib/db/schema/tables";
import { eq, arrayContains } from "drizzle-orm";

/**
 * Task event handlers for cross-context coordination
 */
export class TaskEventHandlers {
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
    // Subscribe to Repository events
    this.subscriber.subscribe({
      eventType: "Repository.CloneCompleted",
      handler: this.handleCloneCompleted.bind(this),
      subscriberId: "task-repo-unblock",
      priority: 5, // Higher priority than analytics (10)
    });

    console.log("[TaskEventHandlers] Subscriptions registered");
  }

  /**
   * Handle Repository.CloneCompleted event
   *
   * When a repository is cloned, unblock any tasks that were waiting for it.
   */
  private async handleCloneCompleted(event: DomainEvent): Promise<void> {
    const { repoId } = event.data;

    console.log(
      `[TaskEventHandlers] CloneCompleted for repo ${repoId}, checking for blocked tasks`,
    );

    try {
      // Find tasks for this repository that might be blocked
      const blockedTasks = await db
        .select({
          id: tasks.id,
          status: tasks.status,
          blockedByIds: tasks.blockedByIds,
        })
        .from(tasks)
        .where(eq(tasks.repoId, repoId));

      console.log(
        `[TaskEventHandlers] Found ${blockedTasks.length} tasks for repo ${repoId}`,
      );

      // For each task, check if it's waiting on this clone
      for (const taskRow of blockedTasks) {
        // If task has a special "clone-pending" marker or is in a waiting state
        // In Loopforge, tasks typically auto-proceed when repo is ready
        // This handler primarily logs the event for future extensibility

        if (taskRow.blockedByIds.length > 0) {
          console.log(
            `[TaskEventHandlers] Task ${taskRow.id} has ${taskRow.blockedByIds.length} blockers, may be waiting on dependencies`,
          );
        }

        // Future: Could implement logic to auto-unblock tasks that were waiting
        // specifically for the repository clone to complete
        // Example: tasks.blockedByIds could contain "repo-clone:<repoId>"
      }
    } catch (error) {
      console.error(
        `[TaskEventHandlers] Error handling CloneCompleted for repo ${repoId}:`,
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
    console.log("[TaskEventHandlers] Stopped");
  }
}
