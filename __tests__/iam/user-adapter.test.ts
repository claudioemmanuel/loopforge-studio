/**
 * User Adapter Tests
 */

import { describe, it, expect } from "vitest";
import {
  UserAdapter,
  type UserSettingsRequest,
} from "@/lib/contexts/iam/api/adapters";
import type { UserState } from "@/lib/contexts/iam/domain/user-aggregate";

describe("UserAdapter", () => {
  const baseState = (): UserState => ({
    id: "user-1",
    githubId: "gh-1",
    username: "testuser",
    email: "test@example.com",
    avatarUrl: "https://example.com/avatar.png",
    locale: "en",
    encryptedGithubToken: "enc-gh",
    githubTokenIv: "iv-gh",
    preferredProvider: "anthropic",
    encryptedApiKey: "enc-anthropic",
    apiKeyIv: "iv-anthropic",
    preferredAnthropicModel: "claude-sonnet-4-20250514",
    openaiEncryptedApiKey: "enc-openai",
    openaiApiKeyIv: "iv-openai",
    preferredOpenaiModel: "gpt-4o",
    geminiEncryptedApiKey: "enc-gemini",
    geminiApiKeyIv: "iv-gemini",
    preferredGeminiModel: "gemini-2.5-pro",
    defaultCloneDirectory: "/tmp/repos",
    defaultTestCommand: "npm test",
    defaultTestTimeout: 300000,
    defaultTestGatePolicy: "warn",
    subscriptionTier: "free",
    billingMode: "byok",
    subscriptionStatus: "active",
    subscriptionPeriodEnd: null,
    stripeCustomerId: null,
    onboardingCompleted: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });

  describe("toApiResponse", () => {
    it("maps flattened user state to API shape", () => {
      const state = baseState();
      const response = UserAdapter.toApiResponse(state);

      expect(response.githubId).toBe(state.githubId);
      expect(response.username).toBe(state.username);
      expect(response.encryptedApiKey).toBe(state.encryptedApiKey);
      expect(response.openaiEncryptedApiKey).toBe(state.openaiEncryptedApiKey);
      expect(response.geminiEncryptedApiKey).toBe(state.geminiEncryptedApiKey);
      expect(response.preferredProvider).toBe("anthropic");
      expect(response.defaultTestTimeout).toBe(300000);
    });

    it("applies defaults when optional provider fields are null", () => {
      const state = {
        ...baseState(),
        preferredProvider: null,
        preferredAnthropicModel: null,
        preferredOpenaiModel: null,
        preferredGeminiModel: null,
      };

      const response = UserAdapter.toApiResponse(state);

      expect(response.preferredProvider).toBe("anthropic");
      expect(response.preferredAnthropicModel).toBe("claude-sonnet-4-20250514");
      expect(response.preferredOpenaiModel).toBe("gpt-4o");
      expect(response.preferredGeminiModel).toBe("gemini-2.5-pro");
    });
  });

  describe("fromSettingsRequest", () => {
    it("extracts flat settings updates", () => {
      const body: UserSettingsRequest = {
        locale: "pt-BR",
        preferredProvider: "openai",
        preferredOpenaiModel: "gpt-4.1",
      };

      const result = UserAdapter.fromSettingsRequest(body);

      expect(result).toEqual({
        locale: "pt-BR",
        preferredProvider: "openai",
        preferredOpenaiModel: "gpt-4.1",
      });
    });

    it("returns empty object for empty body", () => {
      expect(UserAdapter.fromSettingsRequest({})).toEqual({});
    });
  });

  describe("fromDatabaseRow", () => {
    it("maps DB row to flattened UserState", () => {
      const now = new Date();
      const row = {
        id: "user-db",
        githubId: "gh-db",
        username: "dbuser",
        email: "db@example.com",
        avatarUrl: "https://example.com/db.png",
        encryptedApiKey: "enc-a",
        apiKeyIv: "iv-a",
        openaiEncryptedApiKey: "enc-o",
        openaiApiKeyIv: "iv-o",
        geminiEncryptedApiKey: "enc-g",
        geminiApiKeyIv: "iv-g",
        preferredAnthropicModel: "claude-sonnet-4-20250514",
        preferredOpenaiModel: "gpt-4o",
        preferredGeminiModel: "gemini-2.5-pro",
        preferredProvider: "gemini" as const,
        encryptedGithubToken: "enc-gh",
        githubTokenIv: "iv-gh",
        defaultCloneDirectory: "/tmp/repos",
        defaultTestCommand: "pnpm test",
        defaultTestTimeout: 120000,
        defaultTestGatePolicy: "strict" as const,
        subscriptionTier: "pro" as const,
        billingMode: "managed" as const,
        subscriptionStatus: "active" as const,
        subscriptionPeriodEnd: null,
        stripeCustomerId: null,
        onboardingCompleted: true,
        locale: "en",
        createdAt: now,
        updatedAt: now,
      };

      const state = UserAdapter.fromDatabaseRow(row);

      expect(state.id).toBe("user-db");
      expect(state.preferredProvider).toBe("gemini");
      expect(state.encryptedApiKey).toBe("enc-a");
      expect(state.openaiEncryptedApiKey).toBe("enc-o");
      expect(state.geminiEncryptedApiKey).toBe("enc-g");
      expect(state.defaultTestGatePolicy).toBe("strict");
      expect(state.subscriptionTier).toBe("pro");
    });
  });
});
