import { describe, expect, it } from "vitest";
import { EventPublisher } from "@/lib/contexts/domain-events/event-publisher";
import { EventSubscriber } from "@/lib/contexts/domain-events/event-subscriber";
import { DomainEventTypes } from "@/lib/contexts/domain-events/event-taxonomy";
import {
  areDomainEventHandlersHealthy,
  getDomainEventRuntimeContext,
  getDomainEventRuntimeHealth,
  isDomainEventRuntimeConsumer,
  isDomainEventRuntimeInitialized,
  startDomainEventRuntime,
  stopDomainEventRuntime,
} from "@/lib/contexts/domain-events/runtime";
import { BillingEventHandlers } from "@/lib/contexts/billing/infrastructure/event-handlers";
import { AnalyticsEventSubscriber } from "@/lib/contexts/analytics/infrastructure/event-subscribers";
import { getExecutionService } from "@/lib/contexts/execution/api";
import { getRepositoryService } from "@/lib/contexts/repository/api";
import { getTaskService } from "@/lib/contexts/task/api";
import { getUserService } from "@/lib/contexts/iam/api";

describe("Domain Event Runtime Operational Contracts", () => {
  it("exports runtime lifecycle functions", () => {
    expect(typeof startDomainEventRuntime).toBe("function");
    expect(typeof stopDomainEventRuntime).toBe("function");
    expect(typeof getDomainEventRuntimeHealth).toBe("function");
    expect(typeof getDomainEventRuntimeContext).toBe("function");
    expect(typeof isDomainEventRuntimeInitialized).toBe("function");
    expect(typeof isDomainEventRuntimeConsumer).toBe("function");
    expect(typeof areDomainEventHandlersHealthy).toBe("function");
  });

  it("exposes consistent default runtime context", async () => {
    await stopDomainEventRuntime();
    const context = getDomainEventRuntimeContext();

    expect(context.role).toBe("web");
    expect(context.consumerRole).toBe("worker");
    expect(context.runningAsConsumer).toBe(false);
    expect(isDomainEventRuntimeInitialized()).toBe(false);
    expect(isDomainEventRuntimeConsumer()).toBe(false);
  });

  it("returns health entries for all core handlers", () => {
    const health = getDomainEventRuntimeHealth();
    const names = health.map((entry) => entry.name);

    expect(names).toContain("BillingEventHandlers");
    expect(names).toContain("AnalyticsEventSubscriber");
    expect(names).toContain("EventSubscriber");
  });

  it("allows idempotent stop before runtime initialization", async () => {
    await expect(stopDomainEventRuntime()).resolves.toBeUndefined();
    expect(isDomainEventRuntimeInitialized()).toBe(false);
  });
});

describe("Domain Event Infrastructure Wiring", () => {
  it("exposes publisher and subscriber classes", () => {
    expect(EventPublisher).toBeDefined();
    expect(EventSubscriber).toBeDefined();
    expect(typeof EventPublisher.getInstance).toBe("function");
    expect(typeof EventPublisher.createEvent).toBe("function");
    expect(typeof EventSubscriber.getInstance).toBe("function");
  });

  it("exposes analytics and billing subscriber classes", () => {
    expect(BillingEventHandlers).toBeDefined();
    expect(AnalyticsEventSubscriber).toBeDefined();
  });

  it("exposes service factories used by event handlers", () => {
    expect(typeof getTaskService).toBe("function");
    expect(typeof getExecutionService).toBe("function");
    expect(typeof getRepositoryService).toBe("function");
    expect(typeof getUserService).toBe("function");
  });
});

describe("Domain Event Type Coverage", () => {
  it("defines key event families used by runtime subscribers", () => {
    expect(DomainEventTypes.task.created).toBe("Task.Created");
    expect(DomainEventTypes.task.statusChanged).toBe("Task.StatusChanged");
    expect(DomainEventTypes.execution.completed).toBe("Execution.Completed");
    expect(DomainEventTypes.execution.failed).toBe("Execution.Failed");
    expect(DomainEventTypes.repository.cloneCompleted).toBe(
      "Repository.CloneCompleted",
    );
    expect(DomainEventTypes.user.registered).toBe("User.Registered");
    expect(DomainEventTypes.billing.usageRecorded).toBe("Usage.Recorded");
  });
});
