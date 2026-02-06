/**
 * User Repository (Infrastructure Layer)
 *
 * Handles persistence and retrieval of User aggregates.
 */

import type { Redis } from "ioredis";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema/tables";
import { eq } from "drizzle-orm";
import { UserAggregate, type UserState } from "../domain/user-aggregate";

export class UserRepository {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Save user aggregate
   */
  async save(user: UserAggregate): Promise<void> {
    const state = user.getState();

    await db
      .insert(users)
      .values({
        id: state.id,
        email: state.email,
        username: state.username, // ✅ Fixed: username field
        avatarUrl: state.avatarUrl, // ✅ Fixed: avatarUrl field
        githubId: state.githubId, // ✅ Already text type
        locale: state.locale, // ✅ Added: locale field
        encryptedGithubToken: state.encryptedGithubToken,
        githubTokenIv: state.githubTokenIv,
        preferredProvider: state.preferredProvider,
        encryptedApiKey: state.encryptedApiKey,
        apiKeyIv: state.apiKeyIv,
        preferredAnthropicModel: state.preferredAnthropicModel,
        openaiEncryptedApiKey: state.openaiEncryptedApiKey,
        openaiApiKeyIv: state.openaiApiKeyIv,
        preferredOpenaiModel: state.preferredOpenaiModel,
        geminiEncryptedApiKey: state.geminiEncryptedApiKey,
        geminiApiKeyIv: state.geminiApiKeyIv,
        preferredGeminiModel: state.preferredGeminiModel,
        defaultCloneDirectory: state.defaultCloneDirectory, // ✅ Fixed: correct field name
        defaultTestCommand: state.defaultTestCommand, // ✅ Fixed: correct field name
        defaultTestTimeout: state.defaultTestTimeout, // ✅ Added: missing field
        defaultTestGatePolicy: state.defaultTestGatePolicy, // ✅ Fixed: correct field name
        subscriptionTier: state.subscriptionTier,
        billingMode: state.billingMode, // ✅ Added: missing field
        subscriptionStatus: state.subscriptionStatus, // ✅ Added: missing field
        subscriptionPeriodEnd: state.subscriptionPeriodEnd, // ✅ Added: missing field
        stripeCustomerId: state.stripeCustomerId,
        onboardingCompleted: state.onboardingCompleted,
        createdAt: state.createdAt,
        updatedAt: state.updatedAt,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: state.email,
          username: state.username, // ✅ Fixed: username field
          avatarUrl: state.avatarUrl, // ✅ Fixed: avatarUrl field
          locale: state.locale, // ✅ Added: locale field
          encryptedGithubToken: state.encryptedGithubToken,
          githubTokenIv: state.githubTokenIv,
          preferredProvider: state.preferredProvider,
          encryptedApiKey: state.encryptedApiKey,
          apiKeyIv: state.apiKeyIv,
          preferredAnthropicModel: state.preferredAnthropicModel,
          openaiEncryptedApiKey: state.openaiEncryptedApiKey,
          openaiApiKeyIv: state.openaiApiKeyIv,
          preferredOpenaiModel: state.preferredOpenaiModel,
          geminiEncryptedApiKey: state.geminiEncryptedApiKey,
          geminiApiKeyIv: state.geminiApiKeyIv,
          preferredGeminiModel: state.preferredGeminiModel,
          defaultCloneDirectory: state.defaultCloneDirectory, // ✅ Fixed: correct field name
          defaultTestCommand: state.defaultTestCommand, // ✅ Fixed: correct field name
          defaultTestTimeout: state.defaultTestTimeout, // ✅ Added: missing field
          defaultTestGatePolicy: state.defaultTestGatePolicy, // ✅ Fixed: correct field name
          subscriptionTier: state.subscriptionTier,
          billingMode: state.billingMode, // ✅ Added: missing field
          subscriptionStatus: state.subscriptionStatus, // ✅ Added: missing field
          subscriptionPeriodEnd: state.subscriptionPeriodEnd, // ✅ Added: missing field
          stripeCustomerId: state.stripeCustomerId,
          onboardingCompleted: state.onboardingCompleted,
          updatedAt: state.updatedAt,
        },
      });
  }

  /**
   * Find user by ID
   */
  async findById(userId: string): Promise<UserAggregate | null> {
    const row = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!row) {
      return null;
    }

    const state: UserState = {
      id: row.id,
      email: row.email,
      username: row.username, // ✅ Fixed: username field
      avatarUrl: row.avatarUrl, // ✅ Fixed: avatarUrl field
      githubId: row.githubId, // ✅ Already text type
      locale: row.locale || "en", // ✅ Added: locale field with default
      encryptedGithubToken: row.encryptedGithubToken,
      githubTokenIv: row.githubTokenIv,
      preferredProvider: row.preferredProvider as
        | "anthropic"
        | "openai"
        | "gemini"
        | null,
      encryptedApiKey: row.encryptedApiKey,
      apiKeyIv: row.apiKeyIv,
      preferredAnthropicModel: row.preferredAnthropicModel,
      openaiEncryptedApiKey: row.openaiEncryptedApiKey,
      openaiApiKeyIv: row.openaiApiKeyIv,
      preferredOpenaiModel: row.preferredOpenaiModel,
      geminiEncryptedApiKey: row.geminiEncryptedApiKey,
      geminiApiKeyIv: row.geminiApiKeyIv,
      preferredGeminiModel: row.preferredGeminiModel,
      defaultCloneDirectory: row.defaultCloneDirectory, // ✅ Fixed: correct field name
      defaultTestCommand: row.defaultTestCommand, // ✅ Fixed: correct field name
      defaultTestTimeout: row.defaultTestTimeout, // ✅ Added: missing field
      defaultTestGatePolicy: row.defaultTestGatePolicy as
        | "strict"
        | "warn"
        | "skip"
        | "autoApprove"
        | null, // ✅ Fixed: correct field name
      subscriptionTier: row.subscriptionTier as "free" | "pro" | "enterprise",
      billingMode: (row.billingMode as "byok" | "managed") || "byok", // ✅ Added: missing field
      subscriptionStatus:
        (row.subscriptionStatus as "active" | "canceled" | "past_due") ||
        "active", // ✅ Added: missing field
      subscriptionPeriodEnd: row.subscriptionPeriodEnd, // ✅ Added: missing field
      stripeCustomerId: row.stripeCustomerId,
      onboardingCompleted: row.onboardingCompleted ?? false, // ✅ Handle null with default
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    return new UserAggregate(state, this.redis);
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<UserAggregate | null> {
    const row = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!row) {
      return null;
    }

    const state: UserState = {
      id: row.id,
      email: row.email,
      username: row.username, // ✅ Fixed: username field
      avatarUrl: row.avatarUrl, // ✅ Fixed: avatarUrl field
      githubId: row.githubId, // ✅ Already text type
      locale: row.locale || "en", // ✅ Added: locale field with default
      encryptedGithubToken: row.encryptedGithubToken,
      githubTokenIv: row.githubTokenIv,
      preferredProvider: row.preferredProvider as
        | "anthropic"
        | "openai"
        | "gemini"
        | null,
      encryptedApiKey: row.encryptedApiKey,
      apiKeyIv: row.apiKeyIv,
      preferredAnthropicModel: row.preferredAnthropicModel,
      openaiEncryptedApiKey: row.openaiEncryptedApiKey,
      openaiApiKeyIv: row.openaiApiKeyIv,
      preferredOpenaiModel: row.preferredOpenaiModel,
      geminiEncryptedApiKey: row.geminiEncryptedApiKey,
      geminiApiKeyIv: row.geminiApiKeyIv,
      preferredGeminiModel: row.preferredGeminiModel,
      defaultCloneDirectory: row.defaultCloneDirectory, // ✅ Fixed: correct field name
      defaultTestCommand: row.defaultTestCommand, // ✅ Fixed: correct field name
      defaultTestTimeout: row.defaultTestTimeout, // ✅ Added: missing field
      defaultTestGatePolicy: row.defaultTestGatePolicy as
        | "strict"
        | "warn"
        | "skip"
        | "autoApprove"
        | null, // ✅ Fixed: correct field name
      subscriptionTier: row.subscriptionTier as "free" | "pro" | "enterprise",
      billingMode: (row.billingMode as "byok" | "managed") || "byok", // ✅ Added: missing field
      subscriptionStatus:
        (row.subscriptionStatus as "active" | "canceled" | "past_due") ||
        "active", // ✅ Added: missing field
      subscriptionPeriodEnd: row.subscriptionPeriodEnd, // ✅ Added: missing field
      stripeCustomerId: row.stripeCustomerId,
      onboardingCompleted: row.onboardingCompleted ?? false, // ✅ Handle null with default
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };

    return new UserAggregate(state, this.redis);
  }

  /**
   * Delete user
   */
  async delete(userId: string): Promise<void> {
    await db.delete(users).where(eq(users.id, userId));
  }

  /**
   * Update user locale.
   */
  async updateLocale(userId: string, locale: string): Promise<void> {
    await db.update(users).set({ locale }).where(eq(users.id, userId));
  }

  /**
   * Generic user field update helper.
   */
  async updateFields(
    userId: string,
    fields: Record<string, unknown>,
  ): Promise<void> {
    await db
      .update(users)
      .set({ ...fields, updatedAt: new Date() } as Record<string, unknown>)
      .where(eq(users.id, userId));
  }
}
