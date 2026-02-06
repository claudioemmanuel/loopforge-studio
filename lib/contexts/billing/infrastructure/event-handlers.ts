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

/**
 * Billing event handlers for automatic usage tracking
 */
export class BillingEventHandlers {
  private subscriber: EventSubscriber;
  private usageRepository: UsageRepository;

  constructor(redis: Redis) {
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
      subscriberName: "billing-usage-tracker",
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
    const executionId =
      typeof event.data.executionId === "string" ? event.data.executionId : "";
    const userId =
      typeof event.data.userId === "string" ? event.data.userId : "";
    const model = typeof event.data.model === "string" ? event.data.model : "";
    const inputTokens =
      typeof event.data.inputTokens === "number" ? event.data.inputTokens : 0;
    const outputTokens =
      typeof event.data.outputTokens === "number" ? event.data.outputTokens : 0;
    const tokensUsed =
      typeof event.data.tokensUsed === "number" ? event.data.tokensUsed : 0;

    console.log(
      `[BillingEventHandlers] ExecutionCompleted: ${executionId}, tokens: ${tokensUsed || inputTokens + outputTokens}`,
    );

    try {
      if (!userId || !model) {
        return;
      }

      // Calculate total tokens if not provided
      const totalTokens = tokensUsed || inputTokens + outputTokens;

      if (totalTokens === 0) {
        console.warn(
          `[BillingEventHandlers] No token usage data for execution ${executionId}, skipping`,
        );
        return;
      }

      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
        999,
      );
      const estimatedCost = 0;

      await this.usageRepository.recordUsage({
        userId,
        taskId: null,
        executionId: executionId || null,
        periodStart,
        periodEnd,
        model,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost,
      });

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
   * Stop event subscriptions
   */
  async stop(): Promise<void> {
    // EventSubscriber doesn't currently support unsubscribe
    // This is a placeholder for future implementation
    console.log("[BillingEventHandlers] Stopped");
  }
}
