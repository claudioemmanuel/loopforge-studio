import pino from "pino";

const isDev = process.env.NODE_ENV === "development";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  transport: isDev ? { target: "pino-pretty" } : undefined,
});

// Namespaced loggers for different modules
export const dbLogger = logger.child({ module: "db" });
export const aiLogger = logger.child({ module: "ai" });
export const authLogger = logger.child({ module: "auth" });
export const queueLogger = logger.child({ module: "queue" });
export const apiLogger = logger.child({ module: "api" });
export const workerLogger = logger.child({ module: "worker" });
export const githubLogger = logger.child({ module: "github" });

/**
 * Client-safe logger for use in React components.
 * Uses structured console logging in browser environments.
 * Can be extended to send logs to a backend endpoint if needed.
 */
export const clientLogger = {
  error: (message: string, context?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === "development") {
      console.error(`[ERROR] ${message}`, context ?? "");
    } else {
      // In production, could send to logging endpoint
      console.error(`[ERROR] ${message}`, context ?? "");
    }
  },
  warn: (message: string, context?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[WARN] ${message}`, context ?? "");
    }
  },
  info: (message: string, context?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === "development") {
      console.info(`[INFO] ${message}`, context ?? "");
    }
  },
  debug: (message: string, context?: Record<string, unknown>) => {
    if (process.env.NODE_ENV === "development") {
      console.debug(`[DEBUG] ${message}`, context ?? "");
    }
  },
};
