/**
 * Domain Event Infrastructure Tests
 *
 * Verifies event publishing, subscribing, and persistence work correctly.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Redis } from "ioredis";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { domainEvents } from "@/lib/db/schema/tables";
import { EventPublisher, EventSubscriber } from "@/lib/contexts/domain-events";

type EventShape = {
  eventType: string;
  data: Record<string, unknown>;
};

describe("Domain Event Infrastructure", () => {
  let redis: Redis;
  let publisher: EventPublisher;
  let subscriber: EventSubscriber;

  beforeAll(async () => {
    // Initialize Redis connection
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

    // Initialize publisher and subscriber
    publisher = EventPublisher.getInstance(redis);
    subscriber = EventSubscriber.getInstance(redis);

    // Start subscriber
    await subscriber.start();

    // Wait for subscriber to be ready
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    await subscriber.stop();
    await redis.quit();
  });

  beforeEach(async () => {
    // Clean up domain_events table before each test
    await db.delete(domainEvents);

    // Get all subscriptions and unsubscribe them
    const subscriptions = subscriber.getSubscriptions();
    for (const [eventType, subs] of subscriptions.entries()) {
      for (const sub of subs) {
        subscriber.unsubscribe(eventType, sub.subscriberName);
      }
    }
  });

  it("should publish and persist a domain event", async () => {
    const testEvent = EventPublisher.createEvent(
      "TestEvent",
      "TestAggregate",
      "test-123",
      { message: "Hello World" },
    );

    await publisher.publish(testEvent);

    // Verify event was persisted to database
    const persistedEvents = await db
      .select()
      .from(domainEvents)
      .where(eq(domainEvents.id, testEvent.id));

    expect(persistedEvents).toHaveLength(1);
    expect(persistedEvents[0].eventType).toBe("TestEvent");
    expect(persistedEvents[0].aggregateType).toBe("TestAggregate");
    expect(persistedEvents[0].aggregateId).toBe("test-123");
    expect(persistedEvents[0].data).toEqual({ message: "Hello World" });
  });

  it("should deliver event to subscriber", async () => {
    let receivedEvent: EventShape | null = null;

    // Register subscriber
    subscriber.subscribe({
      eventType: "UserRegistered",
      subscriberName: "test-subscriber",
      handler: async (event) => {
        receivedEvent = event as EventShape;
      },
    });

    // Publish event
    const testEvent = EventPublisher.createEvent(
      "UserRegistered",
      "User",
      "user-456",
      { email: "test@example.com" },
    );

    await publisher.publish(testEvent);

    // Wait for event to be delivered
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(receivedEvent).not.toBeNull();
    expect(receivedEvent as unknown as EventShape).toMatchObject({
      eventType: "User.Registered",
      data: { email: "test@example.com" },
    });
  });

  it("should support wildcard subscriptions", async () => {
    const receivedEvents: EventShape[] = [];

    // Subscribe to all Task.* events
    subscriber.subscribe({
      eventType: "Task.*",
      subscriberName: "task-wildcard-subscriber",
      handler: async (event) => {
        receivedEvents.push(event as EventShape);
      },
    });

    // Publish multiple task events
    await publisher.publish(
      EventPublisher.createEvent("TaskCreated", "Task", "task-1", {}),
    );
    await publisher.publish(
      EventPublisher.createEvent("TaskStatusChanged", "Task", "task-1", {}),
    );
    await publisher.publish(
      EventPublisher.createEvent("TaskCompleted", "Task", "task-1", {}),
    );

    // Wait for events to be delivered
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(receivedEvents).toHaveLength(3);
    expect(receivedEvents[0].eventType).toBe("Task.Created");
    expect(receivedEvents[1].eventType).toBe("Task.StatusChanged");
    expect(receivedEvents[2].eventType).toBe("TaskCompleted");
  });

  it("should handle multiple subscribers with priorities", async () => {
    const executionOrder: string[] = [];

    // Register subscribers with different priorities
    subscriber.subscribe({
      eventType: "OrderProcessed",
      subscriberName: "low-priority",
      priority: 200,
      handler: async () => {
        executionOrder.push("low");
      },
    });

    subscriber.subscribe({
      eventType: "OrderProcessed",
      subscriberName: "high-priority",
      priority: 50,
      handler: async () => {
        executionOrder.push("high");
      },
    });

    subscriber.subscribe({
      eventType: "OrderProcessed",
      subscriberName: "medium-priority",
      priority: 100,
      handler: async () => {
        executionOrder.push("medium");
      },
    });

    // Publish event
    await publisher.publish(
      EventPublisher.createEvent("OrderProcessed", "Order", "order-789", {}),
    );

    // Wait for handlers to execute
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify execution order (high → medium → low)
    expect(executionOrder).toEqual(["high", "medium", "low"]);
  });

  it("should measure Redis latency under 10ms", async () => {
    const iterations = 10;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await redis.ping();
      const latency = Date.now() - start;
      latencies.push(latency);
    }

    // Calculate p99 latency
    latencies.sort((a, b) => a - b);
    const p99Index = Math.floor(iterations * 0.99);
    const p99Latency = latencies[p99Index];

    console.log(`Redis p99 latency: ${p99Latency}ms`);
    expect(p99Latency).toBeLessThan(10);
  });

  it("should query domain_events table in under 5ms", async () => {
    // Insert test events
    for (let i = 0; i < 100; i++) {
      await publisher.publish(
        EventPublisher.createEvent("TestEvent", "Test", `test-${i}`, {
          index: i,
        }),
      );
    }

    // Measure query performance
    const start = Date.now();
    await db.select().from(domainEvents).limit(10);
    const queryTime = Date.now() - start;

    console.log(`Query time: ${queryTime}ms`);
    expect(queryTime).toBeLessThan(5);
  });

  it("should prevent duplicate event processing via inbox pattern", async () => {
    let processCount = 0;

    // Register subscriber
    subscriber.subscribe({
      eventType: "PaymentProcessed",
      subscriberName: "payment-handler",
      handler: async () => {
        processCount++;
        // Simulate processing time
        await new Promise((resolve) => setTimeout(resolve, 50));
      },
    });

    // Create a test event
    const testEvent = EventPublisher.createEvent(
      "PaymentProcessed",
      "Payment",
      "payment-123",
      { amount: 100 },
    );

    // Publish the same event multiple times (simulating duplicate delivery)
    await Promise.all([
      publisher.publish(testEvent),
      publisher.publish(testEvent),
      publisher.publish(testEvent),
    ]);

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Verify event was processed exactly once despite multiple publishes
    expect(processCount).toBe(1);
  });

  it("should retry failed handlers with exponential backoff", async () => {
    const attempts: number[] = [];
    let attemptCount = 0;

    subscriber.subscribe({
      eventType: "FailingEvent",
      subscriberName: "failing-handler",
      handler: async () => {
        attemptCount++;
        attempts.push(Date.now());

        // Fail first 2 attempts, succeed on 3rd
        if (attemptCount < 3) {
          throw new Error("Simulated failure");
        }
      },
    });

    await publisher.publish(
      EventPublisher.createEvent("FailingEvent", "Test", "test-999", {}),
    );

    // Wait for retries
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify handler was retried (should succeed on 3rd attempt)
    expect(attemptCount).toBe(3);

    // Verify exponential backoff (delays should increase)
    if (attempts.length >= 3) {
      const delay1 = attempts[1] - attempts[0];
      const delay2 = attempts[2] - attempts[1];

      console.log(`Retry delays: ${delay1}ms, ${delay2}ms`);

      // Second delay should be roughly 2x the first (exponential backoff)
      // Allow some variance due to timing jitter
      expect(delay2).toBeGreaterThan(delay1);
    }
  });
});
