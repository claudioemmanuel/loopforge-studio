import {
  createDomainEvent,
  type DomainEventBus,
} from "@/lib/domain-events/bus";

export class TaskLifecycleSaga {
  constructor(private bus: DomainEventBus) {}

  register(): void {
    this.bus.subscribe("TaskPlanned", async (event) => {
      if (!event.data.autoApprove) {
        return;
      }
      await this.bus.publish(
        createDomainEvent("TaskApproved", {
          taskId: event.data.taskId,
          userId: event.data.userId,
          repoId: event.data.repoId,
          autoExecute: event.data.autoApprove,
        }),
      );
    });

    this.bus.subscribe("TaskApproved", async (event) => {
      if (!event.data.autoExecute) {
        return;
      }
      await this.bus.publish(
        createDomainEvent("BillingCheckRequested", {
          userId: event.data.userId,
          taskId: event.data.taskId,
        }),
      );
    });

    this.bus.subscribe("ExecutionStarted", async (event) => {
      await this.bus.publish(
        createDomainEvent("BillingCheckRequested", {
          userId: event.data.userId,
          taskId: event.data.taskId,
          executionId: event.data.executionId,
        }),
      );
    });

    this.bus.subscribe("ExecutionFailed", async (event) => {
      await this.bus.publish(
        createDomainEvent("NotificationRequested", {
          userId: event.data.userId,
          subject: "Execution failed",
          message: `Execution ${event.data.executionId} failed.`,
          metadata: { reason: event.data.reason, taskId: event.data.taskId },
        }),
      );
    });
  }
}

export class RepoIndexSaga {
  constructor(private bus: DomainEventBus) {}

  register(): void {
    this.bus.subscribe("RepoIndexed", async (event) => {
      const message = event.data.success
        ? `Repository ${event.data.repoId} indexed.`
        : `Repository ${event.data.repoId} indexing failed.`;
      await this.bus.publish(
        createDomainEvent("NotificationRequested", {
          userId: event.data.userId,
          subject: "Repository indexing update",
          message,
          metadata: {
            repoId: event.data.repoId,
            success: event.data.success,
            error: event.data.error,
          },
        }),
      );
    });
  }
}

export function registerProcessManagers(bus: DomainEventBus): void {
  new TaskLifecycleSaga(bus).register();
  new RepoIndexSaga(bus).register();
}
