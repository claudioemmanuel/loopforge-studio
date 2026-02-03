import { queueExecution } from "@/lib/queue/execution-queue";
import type { QueueGateway, ExecutionJobPayload } from "@/lib/application/ports/queue-gateway";

export class ExecutionQueueGateway implements QueueGateway {
  async queueExecution(data: ExecutionJobPayload): Promise<void> {
    await queueExecution(data);
  }
}
