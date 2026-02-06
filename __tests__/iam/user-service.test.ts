/**
 * IAM UserService integration tests (current application-layer contract).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Redis } from "ioredis";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema/tables";
import { UserService } from "@/lib/contexts/iam/application/user-service";

describe("UserService", () => {
  let redis: Redis;
  let userService: UserService;
  let userId: string;

  beforeAll(async () => {
    if (!process.env.ENCRYPTION_KEY) {
      process.env.ENCRYPTION_KEY =
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    }

    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    userService = new UserService(redis);
  });

  beforeEach(async () => {
    userId = randomUUID();
  });

  afterAll(async () => {
    await redis.quit();
  });

  it("registers a user and returns full persisted state", async () => {
    const result = await userService.registerUser({
      id: userId,
      email: "test@example.com",
      username: "testuser",
      avatarUrl: null,
      githubId: `gh-${Date.now()}`,
      locale: "en",
      encryptedGithubToken: "enc-token",
      githubTokenIv: "iv-token",
    });

    expect(result.userId).toBe(userId);

    const full = await userService.getUserFull(userId);
    expect(full).toBeTruthy();
    expect(full?.id).toBe(userId);
    expect(full?.username).toBe("testuser");
    expect(full?.onboardingCompleted).toBe(false);
  });

  it("configures providers and decrypts API keys", async () => {
    await userService.registerUser({
      id: userId,
      email: "provider@example.com",
      username: "provider-user",
      avatarUrl: null,
      githubId: `gh-${Date.now()}`,
      encryptedGithubToken: "enc-token",
      githubTokenIv: "iv-token",
    });

    await userService.configureProvider({
      userId,
      provider: "anthropic",
      apiKey: "sk-ant-test-key",
      preferredModel: "claude-sonnet-4-20250514",
    });

    const providerConfig = await userService.getUserProviderConfig(userId);
    expect(providerConfig.preferredProvider).toBe("anthropic");
    expect(providerConfig.anthropic?.configured).toBe(true);

    const key = await userService.getProviderApiKey(userId, "anthropic");
    expect(key).toBe("sk-ant-test-key");
  });

  it("removes configured provider keys", async () => {
    await userService.registerUser({
      id: userId,
      email: "remove@example.com",
      username: "remove-user",
      avatarUrl: null,
      githubId: `gh-${Date.now()}`,
      encryptedGithubToken: "enc-token",
      githubTokenIv: "iv-token",
    });

    await userService.configureProvider({
      userId,
      provider: "openai",
      apiKey: "sk-openai-test",
      preferredModel: "gpt-4o",
    });
    await userService.removeProvider(userId, "openai");

    const providerConfig = await userService.getUserProviderConfig(userId);
    expect(providerConfig.openai).toBeNull();
  });

  it("updates preferences, onboarding, locale, and generic user fields", async () => {
    await userService.registerUser({
      id: userId,
      email: "prefs@example.com",
      username: "prefs-user",
      avatarUrl: null,
      githubId: `gh-${Date.now()}`,
      encryptedGithubToken: "enc-token",
      githubTokenIv: "iv-token",
    });

    await userService.updatePreferences({
      userId,
      preferences: {
        defaultCloneDirectory: "/tmp/loopforge",
        defaultTestCommand: "npm test",
        defaultTestTimeout: 120000,
        defaultTestGatePolicy: "strict",
      },
    });

    await userService.completeOnboarding(userId);
    expect(await userService.hasCompletedOnboarding(userId)).toBe(true);

    await userService.updateLocale(userId, "pt-BR");
    await userService.updateUserFields(userId, {
      username: "prefs-user-updated",
    });

    const full = await userService.getUserFull(userId);
    expect(full?.defaultCloneDirectory).toBe("/tmp/loopforge");
    expect(full?.defaultTestCommand).toBe("npm test");
    expect(full?.defaultTestGatePolicy).toBe("strict");
    expect(full?.locale).toBe("pt-BR");
    expect(full?.username).toBe("prefs-user-updated");
  });

  it("updates subscription fields and deletes users", async () => {
    await userService.registerUser({
      id: userId,
      email: "sub@example.com",
      username: "sub-user",
      avatarUrl: null,
      githubId: `gh-${Date.now()}`,
      encryptedGithubToken: "enc-token",
      githubTokenIv: "iv-token",
    });

    await userService.updateSubscription({
      userId,
      tier: "pro",
      billingMode: "managed",
      status: "active",
      stripeCustomerId: "cus_123",
      periodEnd: new Date(Date.now() + 86_400_000),
    });

    const row = await db.query.users.findFirst({
      where: (table, { eq }) => eq(table.id, userId),
    });
    expect(row?.subscriptionTier).toBe("pro");
    expect(row?.billingMode).toBe("managed");
    expect(row?.stripeCustomerId).toBe("cus_123");

    await userService.deleteUser(userId);
    const deleted = await db.query.users.findFirst({
      where: (table, { eq }) => eq(table.id, userId),
    });
    expect(deleted).toBeUndefined();
  });

  it("returns null for missing users in read paths", async () => {
    const missingId = randomUUID();
    const full = await userService.getUserFull(missingId);
    const key = await userService.getProviderApiKey(missingId, "anthropic");
    expect(full).toBeNull();
    expect(key).toBeNull();
  });
});
