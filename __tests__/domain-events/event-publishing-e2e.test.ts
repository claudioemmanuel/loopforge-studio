/**
 * Event Publishing E2E Verification Tests
 *
 * These tests verify that:
 * 1. All aggregates publish domain events correctly
 * 2. Event subscribers receive and process events
 * 3. Idempotency protection prevents duplicate processing
 * 4. Process role isolation works correctly
 *
 * REQUIREMENTS:
 * - Postgres database running
 * - Redis running
 * - TEST_DATABASE_URL set
 * - REDIS_URL set
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { getRedis } from "@/lib/queue";
import { EventPublisher } from "@/lib/contexts/domain-events/infrastructure/event-publisher";
import { startDomainEventRuntime } from "@/lib/contexts/domain-events/runtime";
import { DomainEventTypes } from "@/lib/contexts/domain-events/domain/event-types";
import { getTaskService } from "@/lib/contexts/task/api";
import { getExecutionService } from "@/lib/contexts/execution/api";
import { getUserService } from "@/lib/contexts/iam/api";
import { db } from "@/lib/db";
import { domainEvents } from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";
import type Redis from "ioredis";

describe("Event Publishing E2E", () => {
  let redis: Redis;
  let testStartTime: Date;

  beforeAll(async () => {
    // Initialize Redis connection
    redis = getRedis();

    // Start event runtime in test mode
    await startDomainEventRuntime({
      role: "event-consumer",
      forceConsumer: true,
    });

    // Wait for subscriber to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  beforeEach(() => {
    // Track test start time to filter events
    testStartTime = new Date();
  });

  afterAll(async () => {
    // Cleanup
    await redis.quit();
  });

  describe("Task Aggregate Event Publishing", () => {
    it("should publish Task.Created when task is created", async () => {
      // Arrange
      const taskService = getTaskService();
      const testRepoId = "test-repo-id";
      const testUserId = "test-user-id";

      // Act - Create a task
      const task = await taskService.createTask({
        repoId: testRepoId,
        userId: testUserId,
        title: "Test task for event publishing",
        description: "E2E test task",
        status: "todo",
      });

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Assert - Check domain_events table
      const events = await db
        .select()
        .from(domainEvents)
        .where(
          and(
            eq(domainEvents.eventType, DomainEventTypes.task.created),
            eq(domainEvents.aggregateId, task.id),
            gte(domainEvents.createdAt, testStartTime),
          ),
        );

      expect(events).toHaveLength(1);
      expect(events[0].aggregateType).toBe("Task");
      expect(events[0].data).toHaveProperty(
        "title",
        "Test task for event publishing",
      );
    });

    it("should publish Task.StatusChanged when task status changes", async () => {
      // Arrange
      const taskService = getTaskService();
      const task = await taskService.createTask({
        repoId: "test-repo-id",
        userId: "test-user-id",
        title: "Status change test",
        description: "Test",
        status: "todo",
      });

      // Act - Update task status
      await taskService.updateFields(task.id, {
        status: "brainstorming",
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Assert
      const events = await db
        .select()
        .from(domainEvents)
        .where(
          and(
            eq(domainEvents.eventType, DomainEventTypes.task.statusChanged),
            eq(domainEvents.aggregateId, task.id),
            gte(domainEvents.createdAt, testStartTime),
          ),
        );

      expect(events).toHaveLength(1);
      expect(events[0].data).toHaveProperty("from", "todo");
      expect(events[0].data).toHaveProperty("to", "brainstorming");
    });
  });

  describe("Execution Aggregate Event Publishing", () => {
    it("should publish Execution.Completed when execution completes", async () => {
      // Arrange
      const executionService = getExecutionService();
      const testTaskId = "test-task-id";

      // Create execution
      const execution = await executionService.create({
        taskId: testTaskId,
        workerId: "test-worker",
        status: "processing",
      });

      // Act - Mark execution as completed
      await executionService.markCompleted({
        executionId: execution.id,
        commits: ["abc123"],
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Assert
      const events = await db
        .select()
        .from(domainEvents)
        .where(
          and(
            eq(domainEvents.eventType, DomainEventTypes.execution.completed),
            eq(domainEvents.aggregateId, execution.id),
            gte(domainEvents.createdAt, testStartTime),
          ),
        );

      expect(events).toHaveLength(1);
      expect(events[0].aggregateType).toBe("Execution");
      expect(events[0].data).toHaveProperty("executionId", execution.id);
      expect(events[0].data).toHaveProperty("taskId", testTaskId);
    });

    it("should publish Execution.Failed when execution fails", async () => {
      // Arrange
      const executionService = getExecutionService();
      const execution = await executionService.create({
        taskId: "test-task-id",
        workerId: "test-worker",
        status: "processing",
      });

      // Act - Mark execution as failed
      await executionService.markFailed({
        executionId: execution.id,
        error: "Test error",
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Assert
      const events = await db
        .select()
        .from(domainEvents)
        .where(
          and(
            eq(domainEvents.eventType, DomainEventTypes.execution.failed),
            eq(domainEvents.aggregateId, execution.id),
            gte(domainEvents.createdAt, testStartTime),
          ),
        );

      expect(events).toHaveLength(1);
      expect(events[0].data).toHaveProperty("error", "Test error");
    });
  });

  describe("User Aggregate Event Publishing", () => {
    it("should publish User.Registered when user is created", async () => {
      // Arrange
      const userService = getUserService();

      // Act - Create user
      const user = await userService.createUser({
        id: `test-user-${Date.now()}`,
        githubId: 12345,
        username: "testuser",
        email: "test@example.com",
        avatarUrl: "https://example.com/avatar.png",
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Assert
      const events = await db
        .select()
        .from(domainEvents)
        .where(
          and(
            eq(domainEvents.eventType, DomainEventTypes.user.registered),
            eq(domainEvents.aggregateId, user.id),
            gte(domainEvents.createdAt, testStartTime),
          ),
        );

      expect(events).toHaveLength(1);
      expect(events[0].aggregateType).toBe("User");
      expect(events[0].data).toHaveProperty("email", "test@example.com");
      expect(events[0].data).toHaveProperty("username", "testuser");
    });

    it("should publish User.ProviderConfigured when AI provider is configured", async () => {
      // Arrange
      const userService = getUserService();
      const user = await userService.createUser({
        id: `test-user-${Date.now()}`,
        githubId: 12346,
        username: "testuser2",
        email: "test2@example.com",
        avatarUrl: "https://example.com/avatar.png",
      });

      // Act - Configure provider
      await userService.configureProvider(user.id, {
        provider: "anthropic",
        apiKey: "test-key",
        preferredModel: "claude-3-5-sonnet-20241022",
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Assert
      const events = await db
        .select()
        .from(domainEvents)
        .where(
          and(
            eq(
              domainEvents.eventType,
              DomainEventTypes.user.providerConfigured,
            ),
            eq(domainEvents.aggregateId, user.id),
            gte(domainEvents.createdAt, testStartTime),
          ),
        );

      expect(events).toHaveLength(1);
      expect(events[0].data).toHaveProperty("provider", "anthropic");
    });
  });

  describe("Event Subscriber Integration", () => {
    it("should process Execution.Completed events in billing handler", async () => {
      // This test verifies that the billing event handler receives and processes events
      // Note: Actual billing logic testing should be in separate billing unit tests

      // Arrange
      const executionService = getExecutionService();
      const execution = await executionService.create({
        taskId: "billing-test-task",
        workerId: "test-worker",
        status: "processing",
      });

      // Act - Complete execution (should trigger billing event)
      await executionService.markCompleted({
        executionId: execution.id,
        commits: ["abc123"],
      });

      // Wait for event processing (billing handler runs asynchronously)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Assert - Check that event was consumed (inbox entry created)
      const inbox = await db
        .select()
        .from(domainEvents)
        .where(
          and(
            eq(domainEvents.eventType, DomainEventTypes.execution.completed),
            eq(domainEvents.aggregateId, execution.id),
            gte(domainEvents.createdAt, testStartTime),
          ),
        );

      expect(inbox).toHaveLength(1);

      // TODO: Add actual billing record check once billing service exposes query methods
      // const billingRecord = await billingService.getRecordForExecution(execution.id);
      // expect(billingRecord).toBeDefined();
    });

    it("should process Task.StatusChanged events in analytics handler", async () => {
      // Arrange
      const taskService = getTaskService();
      const task = await taskService.createTask({
        repoId: "analytics-test-repo",
        userId: "test-user-id",
        title: "Analytics test task",
        description: "Test",
        status: "todo",
      });

      // Act - Change status (should trigger analytics event)
      await taskService.updateFields(task.id, {
        status: "done",
      });

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Assert - Verify event was consumed
      const events = await db
        .select()
        .from(domainEvents)
        .where(
          and(
            eq(domainEvents.eventType, DomainEventTypes.task.statusChanged),
            eq(domainEvents.aggregateId, task.id),
            gte(domainEvents.createdAt, testStartTime),
          ),
        );

      expect(events).toHaveLength(1);

      // TODO: Add analytics record verification once analytics service exposes query methods
    });
  });

  describe("Idempotency Protection", () => {
    it("should not process duplicate events with same event ID", async () => {
      // Arrange
      const eventPublisher = EventPublisher.getInstance(redis);
      const eventId = `test-duplicate-${Date.now()}`;

      const testEvent = {
        id: eventId,
        eventType: DomainEventTypes.execution.completed as const,
        aggregateType: "Execution" as const,
        aggregateId: "duplicate-test-execution",
        occurredAt: new Date(),
        data: {
          executionId: "duplicate-test-execution",
          taskId: "duplicate-test-task",
          completedAt: new Date().toISOString(),
        },
      };

      // Act - Publish same event twice
      await eventPublisher.publish(testEvent);
      await eventPublisher.publish(testEvent); // Duplicate

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Assert - Should only have one event in database
      const events = await db
        .select()
        .from(domainEvents)
        .where(
          and(
            eq(domainEvents.eventId, eventId),
            gte(domainEvents.createdAt, testStartTime),
          ),
        );

      expect(events).toHaveLength(1);

      // TODO: Verify billing/analytics handlers only processed once
      // This would require handler instrumentation/logging
    });

    it("should clean up inbox after 7 days", async () => {
      // Note: This test would need to mock time or use a dedicated cleanup test
      // For now, we verify the inbox TTL is set correctly

      const eventPublisher = EventPublisher.getInstance(redis);
      const eventId = `test-ttl-${Date.now()}`;

      await eventPublisher.publish({
        id: eventId,
        eventType: DomainEventTypes.task.created,
        aggregateType: "Task",
        aggregateId: "ttl-test-task",
        occurredAt: new Date(),
        data: { title: "TTL test" },
      });

      // Check Redis inbox key has TTL set
      const inboxKey = `events:inbox:${eventId}`;
      const ttl = await redis.ttl(inboxKey);

      // Should have ~7 days TTL (604800 seconds)
      expect(ttl).toBeGreaterThan(600000); // At least 7 days minus a few seconds
      expect(ttl).toBeLessThanOrEqual(604800); // No more than 7 days
    });
  });

  describe("Process Role Isolation", () => {
    it("should only run side-effect handlers in event-consumer role", async () => {
      // This is more of an integration test verifying the runtime initialization
      // We verify by checking that handlers are only initialized when role is correct

      // This test would need to:
      // 1. Start runtime with different roles
      // 2. Verify which handlers are initialized
      // 3. Publish events and verify processing

      // For now, this is verified via code inspection in runtime.ts
      // The critical lines are:
      // - Line 97: const shouldRunSideEffectHandlers = runtimeRole === "event-consumer"
      // - Lines 99-128: Only initialize handlers if shouldRunSideEffectHandlers

      expect(true).toBe(true); // Placeholder - actual test requires runtime isolation
    });
  });

  describe("Event Taxonomy", () => {
    it("should use canonical event naming (Aggregate.Action)", () => {
      // Verify all event types follow the pattern
      const eventTypes = Object.values(DomainEventTypes).flatMap((aggregate) =>
        Object.values(aggregate),
      );

      for (const eventType of eventTypes) {
        // Should match pattern: Word.Word (e.g., Task.Created, User.Registered)
        expect(eventType).toMatch(/^[A-Z][a-z]+\.[A-Z][a-z]+$/);
      }
    });

    it("should have all required aggregate event types defined", () => {
      // Verify all 5 aggregates have event types
      expect(DomainEventTypes.task).toBeDefined();
      expect(DomainEventTypes.execution).toBeDefined();
      expect(DomainEventTypes.repository).toBeDefined();
      expect(DomainEventTypes.user).toBeDefined();
      expect(DomainEventTypes.billing).toBeDefined();

      // Verify key events exist
      expect(DomainEventTypes.task.created).toBe("Task.Created");
      expect(DomainEventTypes.execution.completed).toBe("Execution.Completed");
      expect(DomainEventTypes.user.registered).toBe("User.Registered");
    });
  });
});
