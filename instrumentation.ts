/**
 * Next.js Instrumentation
 * Runs before the server starts
 */

import { EventEmitter } from "events";

export async function register() {
  // Suppress MaxListenersExceededWarning in development
  // These warnings are common with SSE connections and HMR
  if (process.env.NODE_ENV === "development") {
    const devMaxListeners = 100;

    // Increase default max listeners globally
    EventEmitter.defaultMaxListeners = Math.max(
      EventEmitter.defaultMaxListeners,
      devMaxListeners,
    );

    if (process.setMaxListeners) {
      process.setMaxListeners(
        Math.max(process.getMaxListeners(), devMaxListeners),
      );
    }

    // Also increase for stdout/stderr streams specifically
    if (process.stdout?.setMaxListeners) {
      process.stdout.setMaxListeners(
        Math.max(process.stdout.getMaxListeners(), devMaxListeners),
      );
    }
    if (process.stderr?.setMaxListeners) {
      process.stderr.setMaxListeners(
        Math.max(process.stderr.getMaxListeners(), devMaxListeners),
      );
    }
  }

  // Initialize cross-context event handlers (Node.js runtime only)
  if (process.env.NEXT_RUNTIME === "nodejs" || !process.env.NEXT_RUNTIME) {
    try {
      const { initializeEventHandlers } =
        await import("@/lib/contexts/event-initialization");
      await initializeEventHandlers();
      console.log("[Instrumentation] Cross-context event handlers initialized");
    } catch (error) {
      console.error(
        "[Instrumentation] Failed to initialize event handlers:",
        error,
      );
      // Don't throw - let app start even if event handlers fail
    }
  }
}
