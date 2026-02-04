/**
 * Usage Tracking Aggregate Root
 *
 * Manages token usage recording and aggregation for billing periods.
 * This aggregate tracks API consumption across different providers and models.
 */

import { EventPublisher } from "@/lib/contexts/domain-events";
import type { Redis } from "ioredis";
import type { UsageRecord } from "./types";
import type { UsageRecordedEvent } from "./events";

/**
 * Usage aggregate state
 */
export interface UsageState {
  id: string;
  userId: string;
  executionId: string;
  tokensUsed: number;
  provider: string; // anthropic | openai | gemini
  model: string;
  recordedAt: Date;
}

/**
 * Usage Tracking aggregate root
 *
 * Enforces invariants:
 * - Positive token counts
 * - Valid provider and model
 * - Links to valid execution
 */
export class UsageTrackingAggregate {
  private state: UsageState;
  private eventPublisher: EventPublisher;

  constructor(state: UsageState, redis: Redis) {
    this.state = state;
    this.eventPublisher = EventPublisher.getInstance(redis);
  }

  /**
   * Get usage ID
   */
  getId(): string {
    return this.state.id;
  }

  /**
   * Get current state (for persistence)
   */
  getState(): UsageState {
    return { ...this.state };
  }

  /**
   * Record new usage
   */
  static async recordUsage(
    params: {
      id: string;
      userId: string;
      executionId: string;
      tokensUsed: number;
      provider: string;
      model: string;
    },
    redis: Redis,
  ): Promise<UsageTrackingAggregate> {
    // Validate token count
    if (params.tokensUsed <= 0) {
      throw new Error(
        `Invalid token count: ${params.tokensUsed} (must be positive)`,
      );
    }

    // Validate provider
    const validProviders = ["anthropic", "openai", "gemini"];
    if (!validProviders.includes(params.provider.toLowerCase())) {
      throw new Error(
        `Invalid provider: ${params.provider} (must be one of ${validProviders.join(", ")})`,
      );
    }

    // Create usage state
    const state: UsageState = {
      id: params.id,
      userId: params.userId,
      executionId: params.executionId,
      tokensUsed: params.tokensUsed,
      provider: params.provider.toLowerCase(),
      model: params.model,
      recordedAt: new Date(),
    };

    const usage = new UsageTrackingAggregate(state, redis);

    // Publish UsageRecorded event
    const event: UsageRecordedEvent = {
      id: crypto.randomUUID(),
      eventType: "UsageRecorded",
      aggregateType: "Usage",
      aggregateId: state.id,
      occurredAt: new Date(),
      data: {
        usageId: state.id,
        userId: state.userId,
        executionId: state.executionId,
        tokensUsed: state.tokensUsed,
        provider: state.provider,
        model: state.model,
        recordedAt: state.recordedAt,
      },
      metadata: {
        correlationId: crypto.randomUUID(),
      },
    };

    await usage.eventPublisher.publish(event);

    return usage;
  }

  /**
   * Get user ID
   */
  getUserId(): string {
    return this.state.userId;
  }

  /**
   * Get execution ID
   */
  getExecutionId(): string {
    return this.state.executionId;
  }

  /**
   * Get tokens used
   */
  getTokensUsed(): number {
    return this.state.tokensUsed;
  }

  /**
   * Get provider
   */
  getProvider(): string {
    return this.state.provider;
  }

  /**
   * Get model
   */
  getModel(): string {
    return this.state.model;
  }

  /**
   * Get recorded timestamp
   */
  getRecordedAt(): Date {
    return this.state.recordedAt;
  }
}
