/**
 * User Adapter Tests
 *
 * Verifies mapping between IAM domain models and API formats.
 */

import { describe, it, expect } from "vitest";
import {
  UserAdapter,
  type UserApiResponse,
  type UserSettingsRequest,
} from "@/lib/contexts/iam/api/adapters";
import type { UserState } from "@/lib/contexts/iam/domain/user-aggregate";
import type { UserProviderConfiguration } from "@/lib/contexts/iam/domain/provider-config";

describe("UserAdapter", () => {
  describe("toApiResponse", () => {
    it("should map all fields correctly with full data", () => {
      const now = new Date();
      const state: UserState = {
        id: "user-1",
        githubId: "github-123",
        username: "testuser",
        email: "test@example.com",
        avatarUrl: "https://github.com/avatar.png",
        providerConfiguration: {
          anthropic: {
            provider: "anthropic",
            apiKey: {
              encryptedValue: "encrypted-anthropic-key",
              iv: "anthropic-iv",
            },
            preferredModel: "claude-sonnet-4-20250514",
          },
          openai: {
            provider: "openai",
            apiKey: {
              encryptedValue: "encrypted-openai-key",
              iv: "openai-iv",
            },
            preferredModel: "gpt-4o",
          },
          gemini: {
            provider: "gemini",
            apiKey: {
              encryptedValue: "encrypted-gemini-key",
              iv: "gemini-iv",
            },
            preferredModel: "gemini-2.5-pro",
          },
          preferredProvider: "anthropic",
        },
        onboardingCompleted: true,
        locale: "en",
        createdAt: now,
        updatedAt: now,
      };

      const additionalData = {
        encryptedGithubToken: "encrypted-github-token",
        githubTokenIv: "github-iv",
        defaultCloneDirectory: "/tmp/repos",
        defaultTestCommand: "npm test",
        defaultTestTimeout: 300000,
        defaultTestGatePolicy: "warn",
        billingMode: "byok",
        subscriptionTier: null,
      };

      const response = UserAdapter.toApiResponse(state, additionalData);

      // Identity
      expect(response.id).toBe("user-1");
      expect(response.githubId).toBe("github-123");
      expect(response.username).toBe("testuser");
      expect(response.email).toBe("test@example.com");
      expect(response.avatarUrl).toBe("https://github.com/avatar.png");

      // Anthropic API key (legacy flat structure)
      expect(response.encryptedApiKey).toBe("encrypted-anthropic-key");
      expect(response.apiKeyIv).toBe("anthropic-iv");

      // OpenAI API key
      expect(response.openaiEncryptedApiKey).toBe("encrypted-openai-key");
      expect(response.openaiApiKeyIv).toBe("openai-iv");

      // Gemini API key
      expect(response.geminiEncryptedApiKey).toBe("encrypted-gemini-key");
      expect(response.geminiApiKeyIv).toBe("gemini-iv");

      // Preferred models
      expect(response.preferredAnthropicModel).toBe("claude-sonnet-4-20250514");
      expect(response.preferredOpenaiModel).toBe("gpt-4o");
      expect(response.preferredGeminiModel).toBe("gemini-2.5-pro");
      expect(response.preferredProvider).toBe("anthropic");

      // GitHub token
      expect(response.encryptedGithubToken).toBe("encrypted-github-token");
      expect(response.githubTokenIv).toBe("github-iv");

      // Preferences
      expect(response.onboardingCompleted).toBe(true);
      expect(response.locale).toBe("en");
      expect(response.defaultCloneDirectory).toBe("/tmp/repos");
      expect(response.defaultTestCommand).toBe("npm test");
      expect(response.defaultTestTimeout).toBe(300000);
      expect(response.defaultTestGatePolicy).toBe("warn");

      // Billing
      expect(response.billingMode).toBe("byok");
      expect(response.subscriptionTier).toBeNull();

      // Timestamps
      expect(response.createdAt).toBe(now);
      expect(response.updatedAt).toBe(now);
    });

    it("should handle missing optional fields", () => {
      const state: UserState = {
        id: "user-2",
        githubId: "github-456",
        username: "minimaluser",
        email: undefined,
        avatarUrl: undefined,
        providerConfiguration: {
          anthropic: {
            provider: "anthropic",
            apiKey: null,
            preferredModel: "claude-sonnet-4-20250514",
          },
          openai: {
            provider: "openai",
            apiKey: null,
            preferredModel: "gpt-4o",
          },
          gemini: {
            provider: "gemini",
            apiKey: null,
            preferredModel: "gemini-2.5-pro",
          },
          preferredProvider: "anthropic",
        },
        onboardingCompleted: false,
        locale: "en",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = UserAdapter.toApiResponse(state);

      expect(response.email).toBeNull();
      expect(response.avatarUrl).toBeNull();
      expect(response.encryptedApiKey).toBeNull();
      expect(response.apiKeyIv).toBeNull();
      expect(response.openaiEncryptedApiKey).toBeNull();
      expect(response.openaiApiKeyIv).toBeNull();
      expect(response.geminiEncryptedApiKey).toBeNull();
      expect(response.geminiApiKeyIv).toBeNull();
      expect(response.encryptedGithubToken).toBeNull();
      expect(response.githubTokenIv).toBeNull();
      expect(response.defaultCloneDirectory).toBeNull();
      expect(response.billingMode).toBe("byok"); // Default
    });

    it("should handle null API keys", () => {
      const state: UserState = {
        id: "user-3",
        githubId: "github-789",
        username: "nokeysuser",
        providerConfiguration: {
          anthropic: {
            provider: "anthropic",
            apiKey: null,
            preferredModel: "claude-sonnet-4-20250514",
          },
          openai: {
            provider: "openai",
            apiKey: null,
            preferredModel: "gpt-4o",
          },
          gemini: {
            provider: "gemini",
            apiKey: null,
            preferredModel: "gemini-2.5-pro",
          },
          preferredProvider: "openai",
        },
        onboardingCompleted: false,
        locale: "en",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = UserAdapter.toApiResponse(state);

      expect(response.encryptedApiKey).toBeNull();
      expect(response.apiKeyIv).toBeNull();
      expect(response.openaiEncryptedApiKey).toBeNull();
      expect(response.openaiApiKeyIv).toBeNull();
      expect(response.geminiEncryptedApiKey).toBeNull();
      expect(response.geminiApiKeyIv).toBeNull();
      expect(response.preferredProvider).toBe("openai");
    });

    it("should handle partial provider configuration", () => {
      const state: UserState = {
        id: "user-4",
        githubId: "github-101",
        username: "partialuser",
        providerConfiguration: {
          anthropic: {
            provider: "anthropic",
            apiKey: {
              encryptedValue: "key",
              iv: "iv",
            },
            preferredModel: "claude-sonnet-4-20250514",
          },
          openai: {
            provider: "openai",
            apiKey: null,
            preferredModel: "gpt-4o",
          },
          gemini: {
            provider: "gemini",
            apiKey: null,
            preferredModel: "gemini-2.5-pro",
          },
          preferredProvider: "anthropic",
        },
        onboardingCompleted: true,
        locale: "en",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const response = UserAdapter.toApiResponse(state);

      // Anthropic configured
      expect(response.encryptedApiKey).toBe("key");
      expect(response.apiKeyIv).toBe("iv");

      // Others not configured
      expect(response.openaiEncryptedApiKey).toBeNull();
      expect(response.geminiEncryptedApiKey).toBeNull();
    });
  });

  describe("fromSettingsRequest", () => {
    it("should extract locale only", () => {
      const body: UserSettingsRequest = {
        locale: "es",
      };

      const result = UserAdapter.fromSettingsRequest(body);

      expect(result.locale).toBe("es");
      expect(result.providerConfiguration).toBeUndefined();
    });

    it("should extract preferred provider only", () => {
      const body: UserSettingsRequest = {
        preferredProvider: "openai",
      };

      const result = UserAdapter.fromSettingsRequest(body);

      expect(result.locale).toBeUndefined();
      expect(result.providerConfiguration).toBeDefined();
      expect(result.providerConfiguration?.preferredProvider).toBe("openai");
    });

    it("should extract Anthropic model only", () => {
      const body: UserSettingsRequest = {
        preferredAnthropicModel: "claude-opus-4-20250514",
      };

      const result = UserAdapter.fromSettingsRequest(body);

      expect(result.providerConfiguration).toBeDefined();
      expect(result.providerConfiguration?.anthropic).toBeDefined();
      expect(result.providerConfiguration?.anthropic?.preferredModel).toBe(
        "claude-opus-4-20250514",
      );
      expect(result.providerConfiguration?.anthropic?.provider).toBe(
        "anthropic",
      );
      expect(result.providerConfiguration?.anthropic?.apiKey).toBeNull();
    });

    it("should extract OpenAI model only", () => {
      const body: UserSettingsRequest = {
        preferredOpenaiModel: "gpt-4-turbo",
      };

      const result = UserAdapter.fromSettingsRequest(body);

      expect(result.providerConfiguration).toBeDefined();
      expect(result.providerConfiguration?.openai).toBeDefined();
      expect(result.providerConfiguration?.openai?.preferredModel).toBe(
        "gpt-4-turbo",
      );
    });

    it("should extract Gemini model only", () => {
      const body: UserSettingsRequest = {
        preferredGeminiModel: "gemini-2.5-flash",
      };

      const result = UserAdapter.fromSettingsRequest(body);

      expect(result.providerConfiguration).toBeDefined();
      expect(result.providerConfiguration?.gemini).toBeDefined();
      expect(result.providerConfiguration?.gemini?.preferredModel).toBe(
        "gemini-2.5-flash",
      );
    });

    it("should extract all settings", () => {
      const body: UserSettingsRequest = {
        locale: "fr",
        preferredProvider: "gemini",
        preferredAnthropicModel: "claude-sonnet-4-20250514",
        preferredOpenaiModel: "gpt-4o",
        preferredGeminiModel: "gemini-2.5-pro",
      };

      const result = UserAdapter.fromSettingsRequest(body);

      expect(result.locale).toBe("fr");
      expect(result.providerConfiguration?.preferredProvider).toBe("gemini");
      expect(result.providerConfiguration?.anthropic?.preferredModel).toBe(
        "claude-sonnet-4-20250514",
      );
      expect(result.providerConfiguration?.openai?.preferredModel).toBe(
        "gpt-4o",
      );
      expect(result.providerConfiguration?.gemini?.preferredModel).toBe(
        "gemini-2.5-pro",
      );
    });

    it("should handle empty body", () => {
      const body: UserSettingsRequest = {};

      const result = UserAdapter.fromSettingsRequest(body);

      expect(result).toEqual({});
    });

    it("should not include provider config if no provider fields", () => {
      const body: UserSettingsRequest = {
        locale: "de",
      };

      const result = UserAdapter.fromSettingsRequest(body);

      expect(result.locale).toBe("de");
      expect(result.providerConfiguration).toBeUndefined();
    });
  });

  describe("fromDatabaseRow", () => {
    it("should map all fields from database row", () => {
      const now = new Date();
      const row = {
        id: "user-1",
        githubId: "github-123",
        username: "dbuser",
        email: "db@example.com",
        avatarUrl: "https://avatar.png",
        encryptedApiKey: "encrypted-key",
        apiKeyIv: "iv",
        openaiEncryptedApiKey: "openai-key",
        openaiApiKeyIv: "openai-iv",
        geminiEncryptedApiKey: "gemini-key",
        geminiApiKeyIv: "gemini-iv",
        preferredAnthropicModel: "claude-sonnet-4-20250514",
        preferredOpenaiModel: "gpt-4o",
        preferredGeminiModel: "gemini-2.5-pro",
        preferredProvider: "anthropic" as const,
        onboardingCompleted: true,
        locale: "en",
        createdAt: now,
        updatedAt: now,
      };

      const state = UserAdapter.fromDatabaseRow(row);

      expect(state.id).toBe("user-1");
      expect(state.githubId).toBe("github-123");
      expect(state.username).toBe("dbuser");
      expect(state.email).toBe("db@example.com");
      expect(state.avatarUrl).toBe("https://avatar.png");

      expect(state.providerConfiguration.anthropic.apiKey).toEqual({
        encryptedValue: "encrypted-key",
        iv: "iv",
      });
      expect(state.providerConfiguration.openai.apiKey).toEqual({
        encryptedValue: "openai-key",
        iv: "openai-iv",
      });
      expect(state.providerConfiguration.gemini.apiKey).toEqual({
        encryptedValue: "gemini-key",
        iv: "gemini-iv",
      });

      expect(state.providerConfiguration.anthropic.preferredModel).toBe(
        "claude-sonnet-4-20250514",
      );
      expect(state.providerConfiguration.openai.preferredModel).toBe("gpt-4o");
      expect(state.providerConfiguration.gemini.preferredModel).toBe(
        "gemini-2.5-pro",
      );
      expect(state.providerConfiguration.preferredProvider).toBe("anthropic");

      expect(state.onboardingCompleted).toBe(true);
      expect(state.locale).toBe("en");
      expect(state.createdAt).toBe(now);
      expect(state.updatedAt).toBe(now);
    });

    it("should handle null API keys", () => {
      const row = {
        id: "user-2",
        githubId: "github-456",
        username: "nokeys",
        encryptedApiKey: null,
        apiKeyIv: null,
        openaiEncryptedApiKey: null,
        openaiApiKeyIv: null,
        geminiEncryptedApiKey: null,
        geminiApiKeyIv: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const state = UserAdapter.fromDatabaseRow(row);

      expect(state.providerConfiguration.anthropic.apiKey).toBeNull();
      expect(state.providerConfiguration.openai.apiKey).toBeNull();
      expect(state.providerConfiguration.gemini.apiKey).toBeNull();
    });

    it("should use defaults for missing optional fields", () => {
      const row = {
        id: "user-3",
        githubId: "github-789",
        username: "minimal",
        email: null,
        avatarUrl: null,
        onboardingCompleted: undefined,
        locale: null,
        preferredProvider: undefined,
        preferredAnthropicModel: null,
        preferredOpenaiModel: null,
        preferredGeminiModel: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const state = UserAdapter.fromDatabaseRow(row);

      expect(state.email).toBeUndefined();
      expect(state.avatarUrl).toBeUndefined();
      expect(state.onboardingCompleted).toBe(false); // Default
      expect(state.locale).toBe("en"); // Default
      expect(state.providerConfiguration.preferredProvider).toBe("anthropic"); // Default
      expect(state.providerConfiguration.anthropic.preferredModel).toBe(
        "claude-sonnet-4-20250514",
      );
      expect(state.providerConfiguration.openai.preferredModel).toBe("gpt-4o");
      expect(state.providerConfiguration.gemini.preferredModel).toBe(
        "gemini-2.5-pro",
      );
    });

    it("should handle partial API keys (missing IV)", () => {
      const row = {
        id: "user-4",
        githubId: "github-101",
        username: "partial",
        encryptedApiKey: "key",
        apiKeyIv: null, // Missing IV
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const state = UserAdapter.fromDatabaseRow(row);

      // Should be null because IV is missing
      expect(state.providerConfiguration.anthropic.apiKey).toBeNull();
    });

    it("should handle partial API keys (missing key)", () => {
      const row = {
        id: "user-5",
        githubId: "github-102",
        username: "partial2",
        encryptedApiKey: null, // Missing key
        apiKeyIv: "iv",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const state = UserAdapter.fromDatabaseRow(row);

      // Should be null because key is missing
      expect(state.providerConfiguration.anthropic.apiKey).toBeNull();
    });

    it("should handle mixed provider configurations", () => {
      const row = {
        id: "user-6",
        githubId: "github-103",
        username: "mixed",
        encryptedApiKey: "anthropic-key",
        apiKeyIv: "anthropic-iv",
        openaiEncryptedApiKey: null,
        openaiApiKeyIv: null,
        geminiEncryptedApiKey: "gemini-key",
        geminiApiKeyIv: "gemini-iv",
        preferredProvider: "gemini" as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const state = UserAdapter.fromDatabaseRow(row);

      // Anthropic configured
      expect(state.providerConfiguration.anthropic.apiKey).toEqual({
        encryptedValue: "anthropic-key",
        iv: "anthropic-iv",
      });

      // OpenAI not configured
      expect(state.providerConfiguration.openai.apiKey).toBeNull();

      // Gemini configured
      expect(state.providerConfiguration.gemini.apiKey).toEqual({
        encryptedValue: "gemini-key",
        iv: "gemini-iv",
      });

      expect(state.providerConfiguration.preferredProvider).toBe("gemini");
    });
  });

  describe("Round-trip conversion", () => {
    it("should preserve data through database -> domain -> API conversion", () => {
      const dbRow = {
        id: "user-1",
        githubId: "github-123",
        username: "roundtrip",
        email: "test@example.com",
        avatarUrl: "https://avatar.png",
        encryptedApiKey: "key",
        apiKeyIv: "iv",
        openaiEncryptedApiKey: "openai-key",
        openaiApiKeyIv: "openai-iv",
        geminiEncryptedApiKey: null,
        geminiApiKeyIv: null,
        preferredAnthropicModel: "claude-sonnet-4-20250514",
        preferredOpenaiModel: "gpt-4o",
        preferredGeminiModel: "gemini-2.5-pro",
        preferredProvider: "anthropic" as const,
        onboardingCompleted: true,
        locale: "en",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // DB -> Domain
      const state = UserAdapter.fromDatabaseRow(dbRow);

      // Domain -> API
      const apiResponse = UserAdapter.toApiResponse(state);

      // Verify key fields preserved
      expect(apiResponse.id).toBe(dbRow.id);
      expect(apiResponse.username).toBe(dbRow.username);
      expect(apiResponse.encryptedApiKey).toBe(dbRow.encryptedApiKey);
      expect(apiResponse.apiKeyIv).toBe(dbRow.apiKeyIv);
      expect(apiResponse.openaiEncryptedApiKey).toBe(
        dbRow.openaiEncryptedApiKey,
      );
      expect(apiResponse.openaiApiKeyIv).toBe(dbRow.openaiApiKeyIv);
      expect(apiResponse.geminiEncryptedApiKey).toBeNull();
      expect(apiResponse.preferredProvider).toBe(dbRow.preferredProvider);
    });
  });
});
