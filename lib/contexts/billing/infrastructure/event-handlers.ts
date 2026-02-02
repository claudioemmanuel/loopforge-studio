/**
 * Billing Event Handlers
 *
 * Handles cross-context events that affect the Billing context.
 * Subscribes to Execution events to automatically track token usage.
 */

import type { Redis } from "ioredis";
import { EventSubscriber } from "@/lib/contexts/domain-events";
import type { DomainEvent } from "@/lib/contexts/domain-events/types";
import { UsageRepository } from "./usage-repository";
import { UsageTrackingAggregate } from "../domain/usage-aggregate";

/**
 * Billing event handlers for automatic usage tracking
 */
export class BillingEventHandlers {
  private subscriber: EventSubscriber;
  private usageRepository: UsageRepository;
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
    this.subscriber = EventSubscriber.getInstance(redis);
    this.usageRepository = new UsageRepository(redis);
  }

  /**
   * Start event subscriptions
   */
  async start(): Promise<void> {
    // Subscribe to Execution events
    this.subscriber.subscribe({
      eventType: "Execution.ExecutionCompleted",
      handler: this.handleExecutionCompleted.bind(this),
      subscriberId: "billing-usage-tracker",
      priority: 5, // Higher priority than analytics (10)
    });

    console.log("[BillingEventHandlers] Subscriptions registered");
  }

  /**
   * Handle Execution.ExecutionCompleted event
   *
   * When an execution completes, automatically record token usage.
   */
  private async handleExecutionCompleted(event: DomainEvent): Promise<void> {
    const {
      executionId,
      userId,
      tokensUsed,
      model,
      inputTokens,
      outputTokens,
    } = event.data;

    console.log(
      `[BillingEventHandlers] ExecutionCompleted: ${executionId}, tokens: ${tokensUsed || inputTokens + outputTokens}`,
    );

    try {
      // Extract provider from model name
      const provider = this.extractProviderFromModel(model);

      // Calculate total tokens if not provided
      const totalTokens =
        tokensUsed || (inputTokens ?? 0) + (outputTokens ?? 0);

      if (totalTokens === 0) {
        console.warn(
          `[BillingEventHandlers] No token usage data for execution ${executionId}, skipping`,
        );
        return;
      }

      // Create usage tracking aggregate
      const usageAggregate = await UsageTrackingAggregate.create(
        {
          id: crypto.randomUUID(),
          userId,
          executionId,
          tokensUsed: totalTokens,
          provider,
          model,
        },
        this.redis,
      );

      // Save to database (this will also publish UsageRecorded event)
      await this.usageRepository.save(usageAggregate);

      console.log(
        `[BillingEventHandlers] Recorded usage: ${totalTokens} tokens for user ${userId}`,
      );
    } catch (error) {
      console.error(
        `[BillingEventHandlers] Error recording usage for execution ${executionId}:`,
        error,
      );
      // Don't throw - event processing should be resilient
    }
  }

  /**
   * Extract provider from model name
   */
  private extractProviderFromModel(model: string): string {
    const lowerModel = model.toLowerCase();
    if (lowerModel.includes("claude")) return "anthropic";
    if (lowerModel.includes("gpt")) return "openai";
    if (lowerModel.includes("gemini")) return "gemini";
    return "unknown";
  }

  /**
   * Stop event subscriptions
   */
  async stop(): Promise<void> {
    // EventSubscriber doesn't currently support unsubscribe
    // This is a placeholder for future implementation
    console.log("[BillingEventHandlers] Stopped");
  }
}
