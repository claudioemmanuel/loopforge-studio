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
