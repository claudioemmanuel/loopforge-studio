export type WorkerPhase =
  | "brainstorming"
  | "planning"
  | "ready"
  | "executing"
  | "stuck";

export interface WorkerEventPayload {
  currentAction?: string;
  currentStep?: string;
  error?: string;
}

export interface WorkerTaskUpdate {
  userId: string;
  taskId: string;
  taskTitle: string;
  repoName: string;
  status: WorkerPhase;
  payload?: WorkerEventPayload;
}

export interface WorkerEventsGateway {
  publishTaskUpdate(update: WorkerTaskUpdate): Promise<void>;
}
