import { BillingEventHandlers } from "@/lib/contexts/billing/infrastructure/event-handlers";
import { AnalyticsEventSubscriber } from "@/lib/contexts/analytics/infrastructure/event-subscribers";
import { EventSubscriber } from "./event-subscriber";

export type DomainEventRuntimeRole = "web" | "worker" | "event-consumer";

export interface DomainEventRuntimeOptions {
  role?: DomainEventRuntimeRole;
  consumerRole?: DomainEventRuntimeRole;
  forceConsumer?: boolean;
}

export interface DomainEventHandlerHealth {
  name: string;
  initialized: boolean;
  healthy: boolean;
  error?: string;
}

let initialized = false;
let runningAsConsumer = false;
let runtimeRole: DomainEventRuntimeRole = "web";
let consumerRole: DomainEventRuntimeRole = "worker";

let billingHandler: BillingEventHandlers | undefined;
let analyticsHandler: AnalyticsEventSubscriber | undefined;
let subscriber: EventSubscriber | undefined;

let health: DomainEventHandlerHealth[] = [
  { name: "BillingEventHandlers", initialized: false, healthy: false },
  { name: "AnalyticsEventSubscriber", initialized: false, healthy: false },
  { name: "EventSubscriber", initialized: false, healthy: false },
];

function resolveRole(): DomainEventRuntimeRole {
  const value = process.env.DOMAIN_EVENT_RUNTIME_ROLE;
  if (value === "web" || value === "worker" || value === "event-consumer") {
    return value;
  }
  return "web";
}

function resolveConsumerRole(): DomainEventRuntimeRole {
  const value = process.env.DOMAIN_EVENT_CONSUMER_ROLE;
  if (value === "web" || value === "worker" || value === "event-consumer") {
    return value;
  }
  return "worker";
}

function resetHealth(): void {
  health = health.map((entry) => ({
    name: entry.name,
    initialized: false,
    healthy: false,
  }));
}

function setHealth(
  name: DomainEventHandlerHealth["name"],
  status: Partial<DomainEventHandlerHealth>,
): void {
  health = health.map((entry) =>
    entry.name === name ? { ...entry, ...status } : entry,
  );
}

export async function startDomainEventRuntime(
  options: DomainEventRuntimeOptions = {},
): Promise<void> {
  if (initialized) {
    return;
  }

  runtimeRole = options.role ?? resolveRole();
  consumerRole = options.consumerRole ?? resolveConsumerRole();
  const forceConsumer = options.forceConsumer ?? false;

  // Allow web, worker, and event-consumer roles to run subscribers
  // This enables event consumption in development (web) and production (worker/event-consumer)
  const canConsumeEvents = ["web", "worker", "event-consumer"].includes(
    runtimeRole,
  );
  runningAsConsumer = forceConsumer || canConsumeEvents;

  initialized = true;

  if (!runningAsConsumer) {
    resetHealth();
    return;
  }

  const { getRedis } = await import("@/lib/queue/connection");
  const redis = getRedis();
  subscriber = EventSubscriber.getInstance(redis);

  // Only event-consumer role should run side-effect handlers (billing, analytics)
  // to prevent duplicate processing when multiple processes are running
  const shouldRunSideEffectHandlers = runtimeRole === "event-consumer";

  if (shouldRunSideEffectHandlers) {
    billingHandler = new BillingEventHandlers(redis);
    analyticsHandler = new AnalyticsEventSubscriber(redis);

    try {
      await billingHandler.start();
      setHealth("BillingEventHandlers", {
        initialized: true,
        healthy: true,
        error: undefined,
      });
    } catch (error) {
      setHealth("BillingEventHandlers", {
        initialized: true,
        healthy: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    try {
      await analyticsHandler.start();
      setHealth("AnalyticsEventSubscriber", {
        initialized: true,
        healthy: true,
        error: undefined,
      });
    } catch (error) {
      setHealth("AnalyticsEventSubscriber", {
        initialized: true,
        healthy: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  try {
    await subscriber.start();
    setHealth("EventSubscriber", {
      initialized: true,
      healthy: true,
      error: undefined,
    });
  } catch (error) {
    setHealth("EventSubscriber", {
      initialized: true,
      healthy: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

export async function stopDomainEventRuntime(): Promise<void> {
  if (!initialized) {
    return;
  }

  try {
    if (billingHandler) {
      await billingHandler.stop();
    }

    if (analyticsHandler) {
      await analyticsHandler.stop();
    }

    if (subscriber) {
      await subscriber.stop();
    }
  } finally {
    initialized = false;
    runningAsConsumer = false;
    runtimeRole = "web";
    consumerRole = "worker";

    billingHandler = undefined;
    analyticsHandler = undefined;
    subscriber = undefined;
    resetHealth();
  }
}

export function getDomainEventRuntimeHealth(): DomainEventHandlerHealth[] {
  return [...health];
}

export function isDomainEventRuntimeInitialized(): boolean {
  return initialized;
}

export function isDomainEventRuntimeConsumer(): boolean {
  return runningAsConsumer;
}

export function areDomainEventHandlersHealthy(): boolean {
  if (!runningAsConsumer) {
    return true;
  }
  return health.every((entry) => entry.healthy);
}

export function getDomainEventRuntimeContext(): {
  role: DomainEventRuntimeRole;
  consumerRole: DomainEventRuntimeRole;
  runningAsConsumer: boolean;
} {
  return {
    role: runtimeRole,
    consumerRole,
    runningAsConsumer,
  };
}
