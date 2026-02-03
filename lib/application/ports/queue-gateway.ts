import type { AiProvider } from "./domain";

export interface ExecutionJobPayload {
  executionId: string;
  taskId: string;
  repoId: string;
  userId: string;
  aiProvider: AiProvider;
  preferredModel: string;
  planContent: string;
  branch: string;
  defaultBranch: string;
  cloneUrl: string;
}

export interface QueueGateway {
  queueExecution(data: ExecutionJobPayload): Promise<void>;
}
