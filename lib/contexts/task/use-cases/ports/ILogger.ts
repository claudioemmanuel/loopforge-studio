/**
 * Logger port interface
 *
 * Structured logging for use cases.
 * Implementations can use any logging library (pino, winston, etc).
 */
export interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}
