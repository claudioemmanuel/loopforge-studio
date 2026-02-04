/**
 * IAM User Service Tests
 *
 * Tests the IAM context including user registration, provider configuration,
 * and domain event publishing.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Redis } from "ioredis";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, domainEvents } from "@/lib/db/schema/tables";
import { UserService } from "@/lib/contexts/iam/application/user-service";
import {
  EventSubscriber,
  type DomainEvent,
} from "@/lib/contexts/domain-events";

describe("IAM User Service", () => {
  let redis: Redis;
  let userService: UserService;
  let eventSubscriber: EventSubscriber;
  const receivedEvents: DomainEvent[] = [];

  beforeAll(async () => {
    // Initialize Redis connection
    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

    // Initialize user service
    userService = new UserService(redis);

    // Initialize event subscriber
    eventSubscriber = EventSubscriber.getInstance(redis);
    await eventSubscriber.start();

    // Subscribe to all IAM events
    eventSubscriber.subscribe({
      eventType: "*",
      subscriberName: "test-subscriber",
      handler: async (event) => {
        receivedEvents.push(event);
      },
    });

    // Wait for subscriber to be ready
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    await eventSubscriber.stop();
    await redis.quit();
  });

  beforeEach(async () => {
    // Clean up tables
    await db.delete(domainEvents);
    await db.delete(users);

    // Clear received events
    receivedEvents.length = 0;

    // Unsubscribe all test subscribers
    const subscriptions = eventSubscriber.getSubscriptions();
    for (const [eventType, subs] of subscriptions.entries()) {
      for (const sub of subs) {
        if (sub.subscriberName.startsWith("test-")) {
          eventSubscriber.unsubscribe(eventType, sub.subscriberName);
        }
      }
    }

    // Re-subscribe to all events
    eventSubscriber.subscribe({
      eventType: "*",
      subscriberName: "test-subscriber",
      handler: async (event) => {
        receivedEvents.push(event);
      },
    });
  });

  describe("User Registration", () => {
    it("should register a new user and publish UserRegistered event", async () => {
      const userId = randomUUID();

      // Register user
      const result = await userService.registerUser({
        id: userId,
        githubId: "github-123",
        username: "testuser",
        email: "test@example.com",
        avatarUrl: "https://example.com/avatar.png",
        locale: "en",
      });

      expect(result.userId).toBe(userId);

      // Verify user in database
      const dbUsers = await db.select().from(users).where(eq(users.id, userId));

      expect(dbUsers).toHaveLength(1);
      expect(dbUsers[0].githubId).toBe("github-123");
      expect(dbUsers[0].username).toBe("testuser");
      expect(dbUsers[0].email).toBe("test@example.com");

      // Wait for event to be delivered
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify UserRegistered event was published
      const userRegisteredEvents = receivedEvents.filter(
        (e) => e.eventType === "UserRegistered",
      );
      expect(userRegisteredEvents).toHaveLength(1);
      expect(userRegisteredEvents[0].data).toMatchObject({
        userId: "1",
        githubId: "github-123",
        username: "testuser",
        email: "test@example.com",
      });
    });

    it("should return existing user ID if user already registered", async () => {
      // Register user first time
      await userService.registerUser({
        id: "2",
        githubId: "github-456",
        username: "existinguser",
      });

      // Clear events
      receivedEvents.length = 0;

      // Try to register same GitHub user again
      const result2 = await userService.registerUser({
        id: "3", // Different ID
        githubId: "github-456", // Same GitHub ID
        username: "existinguser",
      });

      // Should return original user ID
      expect(result2.userId).toBe("2");

      // Wait for events
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Should NOT publish another UserRegistered event
      const userRegisteredEvents = receivedEvents.filter(
        (e) => e.eventType === "UserRegistered",
      );
      expect(userRegisteredEvents).toHaveLength(0);
    });
  });

  describe("Provider Configuration", () => {
    it("should configure provider and publish ProviderConfigured event", async () => {
      // Register user first
      await userService.registerUser({
        id: "3",
        githubId: "github-789",
        username: "provideruser",
      });

      // Clear events
      receivedEvents.length = 0;

      // Configure Anthropic provider
      await userService.configureProvider(
        "3",
        "anthropic",
        "sk-ant-test-key-123",
        "claude-opus-4-20250514",
      );

      // Verify in database (API key should be encrypted)
      const dbUsers = await db.select().from(users).where(eq(users.id, "3"));

      expect(dbUsers[0].encryptedApiKey).toBeTruthy();
      expect(dbUsers[0].apiKeyIv).toBeTruthy();
      expect(dbUsers[0].preferredAnthropicModel).toBe("claude-opus-4-20250514");

      // Wait for event
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify ProviderConfigured event
      const providerConfiguredEvents = receivedEvents.filter(
        (e) => e.eventType === "ProviderConfigured",
      );
      expect(providerConfiguredEvents).toHaveLength(1);
      expect(providerConfiguredEvents[0].data).toMatchObject({
        userId: "3",
        provider: "anthropic",
        hasApiKey: true,
      });
    });

    it("should retrieve decrypted API key", async () => {
      // Register and configure provider
      await userService.registerUser({
        id: "4",
        githubId: "github-101",
        username: "apiuser",
      });

      const testApiKey = "sk-test-key-secret-123";
      await userService.configureProvider("4", "openai", testApiKey);

      // Retrieve provider config
      const config = await userService.getUserProviderConfig("4");

      expect(config).not.toBeNull();
      expect(config!.provider).toBe("anthropic"); // Default preferred provider
      expect(config!.apiKey).toBe(testApiKey);
    });

    it("should remove provider and publish ProviderRemoved event", async () => {
      // Register and configure provider
      await userService.registerUser({
        id: "5",
        githubId: "github-102",
        username: "removeuser",
      });

      await userService.configureProvider("5", "anthropic", "sk-ant-key");

      // Clear events
      receivedEvents.length = 0;

      // Remove provider
      await userService.removeProvider("5", "anthropic");

      // Verify in database
      const dbUsers = await db.select().from(users).where(eq(users.id, "5"));

      expect(dbUsers[0].encryptedApiKey).toBeNull();
      expect(dbUsers[0].apiKeyIv).toBeNull();

      // Wait for event
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify ProviderRemoved event
      const providerRemovedEvents = receivedEvents.filter(
        (e) => e.eventType === "ProviderRemoved",
      );
      expect(providerRemovedEvents).toHaveLength(1);
      expect(providerRemovedEvents[0].data).toMatchObject({
        userId: "5",
        provider: "anthropic",
      });
    });
  });

  describe("User Preferences", () => {
    it("should update preferences and publish UserPreferencesUpdated event", async () => {
      // Register and configure provider
      await userService.registerUser({
        id: "6",
        githubId: "github-103",
        username: "prefuser",
      });

      await userService.configureProvider("6", "anthropic", "sk-ant-key");
      await userService.configureProvider("6", "openai", "sk-openai-key");

      // Clear events
      receivedEvents.length = 0;

      // Update preferences
      await userService.updatePreferences("6", {
        preferredProvider: "openai",
        preferredOpenaiModel: "gpt-4o-mini",
        locale: "pt-BR",
      });

      // Verify in database
      const dbUsers = await db.select().from(users).where(eq(users.id, "6"));

      expect(dbUsers[0].preferredProvider).toBe("openai");
      expect(dbUsers[0].preferredOpenaiModel).toBe("gpt-4o-mini");
      expect(dbUsers[0].locale).toBe("pt-BR");

      // Wait for event
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify UserPreferencesUpdated event
      const prefUpdatedEvents = receivedEvents.filter(
        (e) => e.eventType === "UserPreferencesUpdated",
      );
      expect(prefUpdatedEvents).toHaveLength(1);
      expect(prefUpdatedEvents[0].data).toMatchObject({
        userId: "6",
        preferredProvider: "openai",
        preferredOpenaiModel: "gpt-4o-mini",
        locale: "pt-BR",
      });
    });

    it("should reject changing to provider without API key", async () => {
      // Register user
      await userService.registerUser({
        id: "7",
        githubId: "github-104",
        username: "invalidpref",
      });

      // Configure only Anthropic
      await userService.configureProvider("7", "anthropic", "sk-ant-key");

      // Try to switch to OpenAI (not configured)
      await expect(
        userService.updatePreferences("7", {
          preferredProvider: "openai",
        }),
      ).rejects.toThrow("no API key configured");
    });
  });

  describe("Onboarding", () => {
    it("should complete onboarding and publish OnboardingCompleted event", async () => {
      // Register and configure provider
      await userService.registerUser({
        id: "8",
        githubId: "github-105",
        username: "onboarduser",
      });

      await userService.configureProvider("8", "anthropic", "sk-ant-key");

      // Clear events
      receivedEvents.length = 0;

      // Complete onboarding
      await userService.completeOnboarding("8");

      // Verify in database
      const dbUsers = await db.select().from(users).where(eq(users.id, "8"));

      expect(dbUsers[0].onboardingCompleted).toBe(true);

      // Wait for event
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify OnboardingCompleted event
      const onboardingEvents = receivedEvents.filter(
        (e) => e.eventType === "OnboardingCompleted",
      );
      expect(onboardingEvents).toHaveLength(1);
      expect(onboardingEvents[0].data).toMatchObject({
        userId: "8",
      });
    });

    it("should reject onboarding without provider configured", async () => {
      // Register user without provider
      await userService.registerUser({
        id: "9",
        githubId: "github-106",
        username: "noprovider",
      });

      // Try to complete onboarding
      await expect(userService.completeOnboarding("9")).rejects.toThrow(
        "no provider configured",
      );
    });

    it("should check onboarding status", async () => {
      // Register user
      await userService.registerUser({
        id: "10",
        githubId: "github-107",
        username: "statuscheck",
      });

      // Should not be complete yet
      let completed = await userService.hasCompletedOnboarding("10");
      expect(completed).toBe(false);

      // Configure provider and complete onboarding
      await userService.configureProvider("10", "anthropic", "sk-ant-key");
      await userService.completeOnboarding("10");

      // Should be complete now
      completed = await userService.hasCompletedOnboarding("10");
      expect(completed).toBe(true);
    });
  });
});
