/**
 * UserService smoke tests for high-signal happy paths.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Redis } from "ioredis";
import { randomUUID } from "crypto";
import { UserService } from "@/lib/contexts/iam/application/user-service";

describe("UserService (Smoke)", () => {
  let redis: Redis;
  let userService: UserService;

  beforeAll(async () => {
    if (!process.env.ENCRYPTION_KEY) {
      process.env.ENCRYPTION_KEY =
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    }

    redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    userService = new UserService(redis);
  });

  afterAll(async () => {
    await redis.quit();
  });

  it("registers and configures an anthropic provider", async () => {
    const userId = randomUUID();
    await userService.registerUser({
      id: userId,
      email: "smoke@example.com",
      username: `smoke-${Date.now()}`,
      avatarUrl: null,
      githubId: `gh-${Date.now()}-${Math.random()}`,
      encryptedGithubToken: "enc-token",
      githubTokenIv: "iv-token",
    });

    await userService.configureProvider({
      userId,
      provider: "anthropic",
      apiKey: "sk-ant-smoke",
    });

    const config = await userService.getUserProviderConfig(userId);
    expect(config.preferredProvider).toBe("anthropic");
    expect(config.anthropic?.configured).toBe(true);
  });
});
