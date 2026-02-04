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
        name: state.name,
        image: state.image,
        githubId: state.githubId,
        githubUsername: state.githubUsername,
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
        cloneDirectory: state.cloneDirectory,
        testRunCommand: state.testRunCommand,
        testGatePolicy: state.testGatePolicy,
        subscriptionTier: state.subscriptionTier,
        stripeCustomerId: state.stripeCustomerId,
        stripeSubscriptionId: state.stripeSubscriptionId,
        onboardingCompleted: state.onboardingCompleted,
        createdAt: state.createdAt,
        updatedAt: state.updatedAt,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: state.email,
          name: state.name,
          image: state.image,
          githubUsername: state.githubUsername,
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
          cloneDirectory: state.cloneDirectory,
          testRunCommand: state.testRunCommand,
          testGatePolicy: state.testGatePolicy,
          subscriptionTier: state.subscriptionTier,
          stripeCustomerId: state.stripeCustomerId,
          stripeSubscriptionId: state.stripeSubscriptionId,
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
      name: row.name,
      image: row.image,
      githubId: row.githubId,
      githubUsername: row.githubUsername,
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
      cloneDirectory: row.cloneDirectory,
      testRunCommand: row.testRunCommand,
      testGatePolicy: row.testGatePolicy as
        | "strict"
        | "warn"
        | "skip"
        | "autoApprove"
        | null,
      subscriptionTier: row.subscriptionTier as "free" | "pro" | "enterprise",
      stripeCustomerId: row.stripeCustomerId,
      stripeSubscriptionId: row.stripeSubscriptionId,
      onboardingCompleted: row.onboardingCompleted,
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
      name: row.name,
      image: row.image,
      githubId: row.githubId,
      githubUsername: row.githubUsername,
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
      cloneDirectory: row.cloneDirectory,
      testRunCommand: row.testRunCommand,
      testGatePolicy: row.testGatePolicy as
        | "strict"
        | "warn"
        | "skip"
        | "autoApprove"
        | null,
      subscriptionTier: row.subscriptionTier as "free" | "pro" | "enterprise",
      stripeCustomerId: row.stripeCustomerId,
      stripeSubscriptionId: row.stripeSubscriptionId,
      onboardingCompleted: row.onboardingCompleted,
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
}
