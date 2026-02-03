import type { AppLogger } from "@/lib/application/ports/logger";
import { queueLogger } from "@/lib/logger";

export class QueueLoggerAdapter implements AppLogger {
  info(details: Record<string, unknown> | string, message?: string): void {
    if (typeof details === "string") {
      queueLogger.info(details);
      return;
    }

    if (message) {
      queueLogger.info(details, message);
      return;
    }

    queueLogger.info(details);
  }

  error(details: Record<string, unknown> | string, message?: string): void {
    if (typeof details === "string") {
      queueLogger.error(details);
      return;
    }

    if (message) {
      queueLogger.error(details, message);
      return;
    }

    queueLogger.error(details);
  }
}
