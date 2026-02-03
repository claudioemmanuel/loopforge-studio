import { workerLogger } from "@/lib/logger";

export interface NotificationPayload {
  subject: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export async function notifyUser(
  userId: string,
  payload: NotificationPayload,
): Promise<void> {
  workerLogger.info(
    { userId, subject: payload.subject, metadata: payload.metadata },
    payload.message,
  );
}
