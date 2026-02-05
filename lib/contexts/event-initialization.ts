/**
 * Event System Initialization
 *
 * Bootstraps all event handlers and subscribers for the domain event system.
 * Call this once at application startup (server-side only).
 */

import { getRedis } from "@/lib/queue";
import { getEventPublisher } from "./domain-events";
import { BillingEventHandlers } from "./billing/infrastructure/event-handlers";
import { AnalyticsEventSubscriber } from "./analytics/infrastructure/event-subscribers";
import { TaskEventHandlers } from "./task/infrastructure/event-handlers";

let initialized = false;
let handlers: {
  billing?: BillingEventHandlers;
  analytics?: AnalyticsEventSubscriber;
  task?: TaskEventHandlers;
} = {};

/**
 * Initialize all event handlers and subscribers
 */
export async function initializeEventHandlers(): Promise<void> {
  if (initialized) {
    console.log("⚠️  Event handlers already initialized");
    return;
  }

  try {
    const redis = getRedis();
    const publisher = getEventPublisher();

    // Initialize Billing event handlers
    handlers.billing = new BillingEventHandlers(publisher, redis);
    await handlers.billing.start();
    console.log("✅ BillingEventHandlers initialized");

    // Initialize Analytics event subscriber
    handlers.analytics = new AnalyticsEventSubscriber(publisher, redis);
    await handlers.analytics.start();
    console.log("✅ AnalyticsEventSubscriber initialized");

    // Initialize Task event handlers
    handlers.task = new TaskEventHandlers(publisher, redis);
    await handlers.task.start();
    console.log("✅ TaskEventHandlers initialized");

    initialized = true;
    console.log("✅ Event system initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize event handlers:", error);
    throw error;
  }
}

/**
 * Gracefully shutdown event handlers
 */
export async function shutdownEventHandlers(): Promise<void> {
  if (!initialized) {
    return;
  }

  try {
    if (handlers.billing) {
      await handlers.billing.stop();
    }
    if (handlers.analytics) {
      await handlers.analytics.stop();
    }
    if (handlers.task) {
      await handlers.task.stop();
    }

    initialized = false;
    handlers = {};
    console.log("✅ Event handlers shut down successfully");
  } catch (error) {
    console.error("❌ Error shutting down event handlers:", error);
    throw error;
  }
}

/**
 * Check if event system is initialized
 */
export function isEventSystemInitialized(): boolean {
  return initialized;
}

/**
 * Get initialized handlers (for testing)
 */
export function getHandlers() {
  return handlers;
}
