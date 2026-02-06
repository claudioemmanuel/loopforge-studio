/**
 * Logger Adapter
 * Implements ILogger port by delegating to the application logger
 */

import type { ILogger } from "../../use-cases/ports/ILogger";
import { apiLogger } from "@/lib/logger";

export class LoggerAdapter implements ILogger {
  log(level: string, message: string, meta?: Record<string, unknown>): void {
    switch (level) {
      case "error":
        apiLogger.error(meta || {}, message);
        break;
      case "warn":
        apiLogger.warn(meta || {}, message);
        break;
      case "info":
        apiLogger.info(meta || {}, message);
        break;
      case "debug":
        apiLogger.debug(meta || {}, message);
        break;
      default:
        apiLogger.info(meta || {}, message);
    }
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    apiLogger.error({ error, ...(meta || {}) }, message);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    apiLogger.warn(meta || {}, message);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    apiLogger.info(meta || {}, message);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    apiLogger.debug(meta || {}, message);
  }
}
