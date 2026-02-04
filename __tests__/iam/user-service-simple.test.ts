/**
 * IAM User Service Tests (Simplified)
 *
 * Tests the IAM context with valid UUIDs.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Redis } from "ioredis";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { users, domainEvents } from "@/lib/db/schema/tables";
import { UserService } from "@/lib/contexts/iam/application/user-service";
import {
  EventSubscriber,
  type DomainEvent,
} from "@/lib/contexts/domain-events";

describe("IAM User Service (Simplified)", () => {
  let redis: Redis;
  let userService: UserService;
  let eventSubscriber: EventSubscriber;
  const receivedEvents: DomainEvent[] = [];

  beforeAll(async () => {
    // Set encryption key for tests
    if (!process.env.ENCRYPTION_KEY) {
      process.env.ENCRYPTION_KEY =
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    }

    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    userService = new UserService(redis);
    eventSubscriber = EventSubscriber.getInstance(redis);
    await eventSubscriber.start();
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    await eventSubscriber.stop();
    await redis.quit();
  });

  beforeEach(async () => {
    await db.delete(domainEvents);
    await db.delete(users);
    receivedEvents.length = 0;
  });

  it("should register a new user and publish UserRegistered event", async () => {
    const userId = randomUUID();

    // Subscribe to events
    eventSubscriber.subscribe({
      eventType: "UserRegistered",
      subscriberName: "test-subscriber",
      handler: async (event) => {
        receivedEvents.push(event);
      },
    });

    const result = await userService.registerUser({
      id: userId,
      githubId: "github-123",
      username: "testuser",
      email: "test@example.com",
    });

    expect(result.userId).toBe(userId);

    // Wait for event
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(receivedEvents).toHaveLength(1);
    expect(receivedEvents[0].eventType).toBe("UserRegistered");
  });

  it("should configure provider and publish ProviderConfigured event", async () => {
    const userId = randomUUID();

    // Subscribe to events
    eventSubscriber.subscribe({
      eventType: "ProviderConfigured",
      subscriberName: "test-subscriber-2",
      handler: async (event) => {
        receivedEvents.push(event);
      },
    });

    await userService.registerUser({
      id: userId,
      githubId: "github-456",
      username: "provideruser",
    });

    await userService.configureProvider(userId, "anthropic", "sk-ant-test-key");

    // Wait for event
    await new Promise((resolve) => setTimeout(resolve, 200));

    const providerEvents = receivedEvents.filter(
      (e) => e.eventType === "ProviderConfigured",
    );
    expect(providerEvents).toHaveLength(1);
  });
});
