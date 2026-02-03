import type { Job } from "bullmq";
import { queueExecution, queueIndexing, queuePlan } from "@/lib/queue";
import { canExecuteTask } from "@/lib/billing";
import { workerLogger } from "@/lib/logger";
import type {
  DomainEventBus,
  DomainEvent,
} from "@/lib/domain-events/bus";
import type { DomainEventType } from "@/lib/domain-events/catalog";
import { notifyUser } from "@/lib/application/notifications";

export function registerDomainEventHandlers(bus: DomainEventBus): void {
  bus.subscribe("TaskPlanningRequested", async (event) => {
    const job = await queuePlan(event.data);
    workerLogger.info(
      { taskId: event.data.taskId, jobId: job.id },
      "Queued plan job from domain event",
    );
    return job;
  });

  bus.subscribe("TaskExecutionRequested", async (event) => {
    const job = await queueExecution(event.data);
    workerLogger.info(
      { taskId: event.data.taskId, jobId: job.id },
      "Queued execution job from domain event",
    );
    return job;
  });

  bus.subscribe("RepoIndexRequested", async (event) => {
    const job = await queueIndexing(event.data);
    workerLogger.info(
      { repoId: event.data.repoId, jobId: job.id },
      "Queued indexing job from domain event",
    );
    return job;
  });

  bus.subscribe("TaskApproved", async (event) => {
    await notifyUser(event.data.userId, {
      subject: "Task approved",
      message: `Task ${event.data.taskId} approved for execution.`,
      metadata: { repoId: event.data.repoId },
    });
  });

  bus.subscribe("ExecutionStarted", async (event) => {
    await notifyUser(event.data.userId, {
      subject: "Execution started",
      message: `Execution ${event.data.executionId} started.`,
      metadata: { taskId: event.data.taskId, repoId: event.data.repoId },
    });
  });

  bus.subscribe("ExecutionFailed", async (event) => {
    await notifyUser(event.data.userId, {
      subject: "Execution failed",
      message: `Execution ${event.data.executionId} failed: ${event.data.reason}`,
      metadata: { taskId: event.data.taskId, repoId: event.data.repoId },
    });
  });

  bus.subscribe("NotificationRequested", async (event) => {
    await notifyUser(event.data.userId, {
      subject: event.data.subject,
      message: event.data.message,
      metadata: event.data.metadata,
    });
  });

  bus.subscribe("BillingCheckRequested", async (event) => {
    const result = await canExecuteTask(event.data.userId);
    workerLogger.info(
      {
        userId: event.data.userId,
        taskId: event.data.taskId,
        allowed: result.allowed,
      },
      "Billing check result from domain event",
    );
    return result;
  });
}

export type DomainEventJobResult = Job | undefined;

export async function publishForJob<T extends DomainEventType>(
  bus: DomainEventBus,
  event: DomainEvent<T>,
): Promise<DomainEventJobResult> {
  const results = await bus.publish(event);
  return results.find((result) => result) as DomainEventJobResult;
}
