/**
 * Event System Initialization
 *
 * Bootstraps event subscribers/handlers for DDD cross-context workflows.
 */

import { getRedis } from "@/lib/queue";
import { BillingEventHandlers } from "./billing/infrastructure/event-handlers";
import { AnalyticsEventSubscriber } from "./analytics/infrastructure/event-subscribers";

export interface HandlerHealth {
  name: string;
  initialized: boolean;
  healthy: boolean;
  error?: string;
}

let initialized = false;
let handlers: {
  billing?: BillingEventHandlers;
  analytics?: AnalyticsEventSubscriber;
} = {};

let health: HandlerHealth[] = [
  { name: "BillingEventHandlers", initialized: false, healthy: false },
  { name: "AnalyticsEventSubscriber", initialized: false, healthy: false },
];

export async function initializeEventHandlers(): Promise<void> {
  if (initialized) {
    return;
  }

  const redis = getRedis();

  const nextHealth: HandlerHealth[] = [
    { name: "BillingEventHandlers", initialized: false, healthy: false },
    { name: "AnalyticsEventSubscriber", initialized: false, healthy: false },
  ];

  handlers = {};

  try {
    const billing = new BillingEventHandlers(redis);
    await billing.start();
    handlers.billing = billing;
    nextHealth[0] = {
      name: "BillingEventHandlers",
      initialized: true,
      healthy: true,
    };
  } catch (error) {
    nextHealth[0] = {
      name: "BillingEventHandlers",
      initialized: true,
      healthy: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  try {
    const analytics = new AnalyticsEventSubscriber(redis);
    await analytics.start();
    handlers.analytics = analytics;
    nextHealth[1] = {
      name: "AnalyticsEventSubscriber",
      initialized: true,
      healthy: true,
    };
  } catch (error) {
    nextHealth[1] = {
      name: "AnalyticsEventSubscriber",
      initialized: true,
      healthy: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }

  health = nextHealth;
  initialized = true;
}

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
  } finally {
    initialized = false;
    handlers = {};
    health = health.map((item) => ({
      name: item.name,
      initialized: false,
      healthy: false,
    }));
  }
}

export function isEventSystemInitialized(): boolean {
  return initialized;
}

export function getHandlers() {
  return handlers;
}

export function getHandlerHealthStatus(): HandlerHealth[] {
  return [...health];
}

export function areAllHandlersHealthy(): boolean {
  return health.length > 0 && health.every((h) => h.healthy);
}
