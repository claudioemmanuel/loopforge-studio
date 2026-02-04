/**
 * Event Handler Initialization
 *
 * Singleton management for cross-context event handlers.
 * Handles lifecycle, error isolation, and graceful shutdown.
 */

import Redis from "ioredis";
import { EventSubscriber } from "@/lib/contexts/domain-events";
import { BillingEventHandlers } from "@/lib/contexts/billing/infrastructure/event-handlers";
import { TaskEventHandlers } from "@/lib/contexts/task/infrastructure/event-handlers";
import { AutonomousFlowManager } from "@/lib/contexts/task/infrastructure/autonomous-flow-manager";
import { AnalyticsEventSubscriber } from "@/lib/contexts/analytics/infrastructure/event-subscribers";
import { connectionOptions } from "@/lib/queue/connection";

// ============================================================================
// Types
// ============================================================================

/**
 * Health status for a single event handler
 */
export interface HandlerHealth {
  name: string;
  initialized: boolean;
  error?: string;
  startedAt?: Date;
}

/**
 * Handler registration entry
 */
interface HandlerEntry {
  name: string;
  priority: number;
  instance?: unknown;
  start?: () => Promise<void>;
  stop?: () => Promise<void>;
}

// ============================================================================
// Global State
// ============================================================================

/**
 * Singleton Redis instance for event handlers
 */
let redisInstance: Redis | null = null;

/**
 * Registered event handlers
 */
const handlers = new Map<string, HandlerEntry>();

/**
 * Health status tracking per handler
 */
const healthStatus = new Map<string, HandlerHealth>();

/**
 * Initialization flag
 */
let isInitialized = false;

/**
 * Shutdown handler registered flag
 */
let shutdownHandlersRegistered = false;

// ============================================================================
// Redis Management
// ============================================================================

/**
 * Get or create Redis instance with lazy connection
 */
function getOrCreateRedis(): Redis {
  if (redisInstance) {
    return redisInstance;
  }

  redisInstance = new Redis({
    ...connectionOptions,
    lazyConnect: true, // Don't connect immediately
    retryStrategy: (times: number) => {
      // Exponential backoff with max delay of 3s
      const delay = Math.min(times * 50, 3000);
      console.log(
        `[EventInit] Redis reconnecting in ${delay}ms (attempt ${times})`,
      );
      return delay;
    },
  });

  // Handle connection events
  redisInstance.on("connect", () => {
    console.log("[EventInit] Redis connected");
  });

  redisInstance.on("error", (error) => {
    console.error("[EventInit] Redis error:", error);
  });

  redisInstance.on("close", () => {
    console.log("[EventInit] Redis connection closed");
  });

  return redisInstance;
}

// ============================================================================
// Handler Initialization
// ============================================================================

/**
 * Initialize a single event handler with error isolation
 */
async function initializeHandler(
  name: string,
  priority: number,
  factory: (redis: Redis) => unknown,
  starter: (instance: unknown) => Promise<void>,
): Promise<boolean> {
  const startedAt = new Date();

  try {
    console.log(`[EventInit] Initializing ${name} (priority ${priority})...`);

    const redis = getOrCreateRedis();
    const instance = factory(redis);
    await starter(instance);

    // Register handler
    handlers.set(name, {
      name,
      priority,
      instance,
      start: () => starter(instance),
      stop: async () => {
        if ("stop" in (instance as object)) {
          await (instance as { stop: () => Promise<void> }).stop();
        }
      },
    });

    // Mark as healthy
    healthStatus.set(name, {
      name,
      initialized: true,
      startedAt,
    });

    console.log(`[EventInit] ✓ ${name} initialized`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[EventInit] ✗ ${name} failed:`, errorMessage);

    // Mark as unhealthy
    healthStatus.set(name, {
      name,
      initialized: false,
      error: errorMessage,
      startedAt,
    });

    return false;
  }
}

/**
 * Initialize all event handlers in priority order
 */
export async function initializeEventHandlers(): Promise<void> {
  // Idempotency check
  if (isInitialized) {
    console.log("[EventInit] Already initialized, skipping");
    return;
  }

  console.log("[EventInit] Starting event handler initialization...");

  try {
    // Get Redis instance
    const redis = getOrCreateRedis();

    // Connect to Redis
    try {
      await redis.connect();
      console.log("[EventInit] Redis connection established");
    } catch (error) {
      console.error("[EventInit] Redis connection failed:", error);
      console.warn(
        "[EventInit] App will start in degraded mode (no event handlers)",
      );
      // Don't throw - fail open
      return;
    }

    // Start EventSubscriber singleton
    const subscriber = EventSubscriber.getInstance(redis);
    await subscriber.start();
    console.log("[EventInit] EventSubscriber started");

    // Initialize handlers in priority order (lower number = higher priority)
    const initResults: boolean[] = [];

    // Priority 1: AutonomousFlowManager (critical for autonomous workflow)
    initResults.push(
      await initializeHandler(
        "AutonomousFlowManager",
        1,
        (r) => new AutonomousFlowManager(r),
        async (instance) => {
          await (instance as AutonomousFlowManager).start();
        },
      ),
    );

    // Priority 2: BillingEventHandlers (token tracking)
    initResults.push(
      await initializeHandler(
        "BillingEventHandlers",
        2,
        (r) => new BillingEventHandlers(r),
        async (instance) => {
          await (instance as BillingEventHandlers).start();
        },
      ),
    );

    // Priority 3: TaskEventHandlers (dependency unblocking)
    initResults.push(
      await initializeHandler(
        "TaskEventHandlers",
        3,
        (r) => new TaskEventHandlers(r),
        async (instance) => {
          await (instance as TaskEventHandlers).start();
        },
      ),
    );

    // Priority 4: AnalyticsEventSubscriber (nice-to-have)
    initResults.push(
      await initializeHandler(
        "AnalyticsEventSubscriber",
        4,
        (r) => new AnalyticsEventSubscriber(r),
        async (instance) => {
          await (instance as AnalyticsEventSubscriber).start();
        },
      ),
    );

    // Log summary
    const successCount = initResults.filter(Boolean).length;
    const totalCount = initResults.length;
    console.log(
      `[EventInit] Handler Health: ${successCount}/${totalCount} initialized`,
    );

    // Register shutdown handlers (only once)
    if (!shutdownHandlersRegistered) {
      registerShutdownHandlers();
      shutdownHandlersRegistered = true;
    }

    isInitialized = true;
    console.log("[EventInit] Initialization complete");
  } catch (error) {
    console.error("[EventInit] Unexpected error during initialization:", error);
    // Don't throw - fail open, allow app to start
  }
}

// ============================================================================
// Shutdown Management
// ============================================================================

/**
 * Shutdown all event handlers gracefully
 */
export async function shutdownEventHandlers(): Promise<void> {
  if (!isInitialized) {
    console.log("[EventInit] Not initialized, nothing to shutdown");
    return;
  }

  console.log("[EventInit] Starting graceful shutdown...");

  try {
    // Get handlers in reverse priority order (shutdown in reverse)
    const handlerEntries = Array.from(handlers.values()).sort(
      (a, b) => b.priority - a.priority,
    );

    // Stop each handler with timeout
    const shutdownPromises = handlerEntries.map(async (handler) => {
      if (!handler.stop) return;

      try {
        console.log(`[EventInit] Stopping ${handler.name}...`);
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 5000),
        );
        await Promise.race([handler.stop(), timeoutPromise]);
        console.log(`[EventInit] ✓ ${handler.name} stopped`);
      } catch (error) {
        console.error(`[EventInit] ✗ ${handler.name} stop failed:`, error);
      }
    });

    await Promise.allSettled(shutdownPromises);

    // Stop EventSubscriber
    if (redisInstance) {
      const subscriber = EventSubscriber.getInstance(redisInstance);
      try {
        await subscriber.stop();
        console.log("[EventInit] EventSubscriber stopped");
      } catch (error) {
        console.error("[EventInit] EventSubscriber stop failed:", error);
      }
    }

    // Close Redis connection
    if (redisInstance) {
      try {
        await redisInstance.quit();
        console.log("[EventInit] Redis connection closed");
      } catch (error) {
        console.error("[EventInit] Redis close failed:", error);
      }
    }

    // Clear global state
    handlers.clear();
    healthStatus.clear();
    redisInstance = null;
    isInitialized = false;

    console.log("[EventInit] Shutdown complete");
  } catch (error) {
    console.error("[EventInit] Unexpected error during shutdown:", error);
  }
}

/**
 * Register process signal handlers for graceful shutdown
 */
function registerShutdownHandlers(): void {
  // Handle SIGTERM (Docker, Kubernetes, systemd)
  process.on("SIGTERM", async () => {
    console.log("[EventInit] Received SIGTERM, shutting down...");
    await shutdownEventHandlers();
    process.exit(0);
  });

  // Handle SIGINT (Ctrl+C)
  process.on("SIGINT", async () => {
    console.log("[EventInit] Received SIGINT, shutting down...");
    await shutdownEventHandlers();
    process.exit(0);
  });

  // Handle beforeExit (graceful process termination)
  process.on("beforeExit", async () => {
    console.log("[EventInit] Process exiting, shutting down handlers...");
    await shutdownEventHandlers();
  });

  console.log(
    "[EventInit] Shutdown handlers registered (SIGTERM, SIGINT, beforeExit)",
  );
}

// ============================================================================
// Health Status API
// ============================================================================

/**
 * Get health status for all handlers
 */
export function getHandlerHealthStatus(): HandlerHealth[] {
  return Array.from(healthStatus.values());
}

/**
 * Check if all handlers are healthy
 */
export function areAllHandlersHealthy(): boolean {
  return Array.from(healthStatus.values()).every(
    (status) => status.initialized,
  );
}
