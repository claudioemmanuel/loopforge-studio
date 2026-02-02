/**
 * Next.js Instrumentation
 * Runs before the server starts
 */

import { EventEmitter } from "events";

export function register() {
  // Suppress MaxListenersExceededWarning in development
  // These warnings are common with SSE connections and HMR
  if (process.env.NODE_ENV === "development") {
    // Increase default max listeners globally
    EventEmitter.defaultMaxListeners = 20;

    // Also increase for stdout/stderr streams specifically
    if (process.stdout?.setMaxListeners) {
      process.stdout.setMaxListeners(20);
    }
    if (process.stderr?.setMaxListeners) {
      process.stderr.setMaxListeners(20);
    }
  }
}
