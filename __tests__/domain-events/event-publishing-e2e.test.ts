import { describe, expect, it } from "vitest";
import type Redis from "ioredis";
import { EventPublisher } from "@/lib/contexts/domain-events/event-publisher";
import {
  DomainEventPatterns,
  DomainEventTypes,
  getCompatibleEventTypes,
  toCanonicalEventType,
} from "@/lib/contexts/domain-events/event-taxonomy";

describe("Domain Event Taxonomy Compatibility", () => {
  it("uses canonical Aggregate.Action naming", () => {
    const allEventTypes = Object.values(DomainEventTypes).flatMap((aggregate) =>
      Object.values(aggregate),
    );

    for (const eventType of allEventTypes) {
      expect(eventType).toMatch(/^[A-Z][A-Za-z]+\.[A-Z][A-Za-z]+$/);
    }
  });

  it("exposes wildcard patterns for event fanout", () => {
    expect(DomainEventPatterns.task).toBe("Task.*");
    expect(DomainEventPatterns.execution).toBe("Execution.*");
    expect(DomainEventPatterns.repository).toBe("Repository.*");
    expect(DomainEventPatterns.user).toBe("User.*");
    expect(DomainEventPatterns.subscription).toBe("Subscription.*");
    expect(DomainEventPatterns.usage).toBe("Usage.*");
    expect(DomainEventPatterns.billing).toBe("Billing.*");
  });

  it("maps legacy task names to canonical events", () => {
    expect(toCanonicalEventType("TaskCreated")).toBe(
      DomainEventTypes.task.created,
    );
    expect(toCanonicalEventType("TaskStatusChanged")).toBe(
      DomainEventTypes.task.statusChanged,
    );
    expect(toCanonicalEventType("BrainstormingCompleted")).toBe(
      DomainEventTypes.task.brainstormingCompleted,
    );
  });

  it("applies aggregate-aware overrides for Execution* names", () => {
    expect(toCanonicalEventType("ExecutionStarted", "Task")).toBe(
      DomainEventTypes.task.executionStarted,
    );
    expect(toCanonicalEventType("ExecutionCompleted", "Task")).toBe(
      DomainEventTypes.task.executionCompleted,
    );
    expect(toCanonicalEventType("ExecutionStarted", "Execution")).toBe(
      DomainEventTypes.execution.started,
    );
    expect(toCanonicalEventType("ExecutionCompleted", "Execution")).toBe(
      DomainEventTypes.execution.completed,
    );
  });

  it("returns canonical event plus aliases for compatibility routing", () => {
    const compatible = getCompatibleEventTypes(DomainEventTypes.task.created);

    expect(compatible).toContain(DomainEventTypes.task.created);
    expect(compatible).toContain("TaskCreated");
  });
});

describe("EventPublisher Contracts", () => {
  it("creates a valid event envelope", () => {
    const event = EventPublisher.createEvent(
      DomainEventTypes.task.created,
      "Task",
      "task-123",
      { title: "Contract test task" },
      { correlationId: "corr-1" },
    );

    expect(typeof event.id).toBe("string");
    expect(event.eventType).toBe(DomainEventTypes.task.created);
    expect(event.aggregateType).toBe("Task");
    expect(event.aggregateId).toBe("task-123");
    expect(event.occurredAt).toBeInstanceOf(Date);
    expect(event.data).toEqual({ title: "Contract test task" });
    expect(event.metadata?.correlationId).toBe("corr-1");
  });

  it("preserves singleton instance semantics", () => {
    const mockRedis = {
      publish: async () => 1,
    } as unknown as Redis;

    const first = EventPublisher.getInstance(mockRedis);
    const second = EventPublisher.getInstance(mockRedis);

    expect(first).toBe(second);
  });
});
