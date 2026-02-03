import {
  publishWorkerEvent,
  createWorkerUpdateEvent,
} from "@/lib/workers/events";
import type {
  WorkerEventsGateway,
  WorkerTaskUpdate,
} from "@/lib/application/ports/worker-events-gateway";

export class DefaultWorkerEventsGateway implements WorkerEventsGateway {
  async publishTaskUpdate(update: WorkerTaskUpdate): Promise<void> {
    await publishWorkerEvent(
      update.userId,
      createWorkerUpdateEvent(
        update.taskId,
        update.taskTitle,
        update.repoName,
        update.status,
        update.payload ?? {},
      ),
    );
  }
}
