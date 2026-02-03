export type DomainEventType =
  | "TaskPlanningRequested"
  | "TaskPlanned"
  | "TaskApproved"
  | "TaskExecutionRequested"
  | "ExecutionStarted"
  | "ExecutionFailed"
  | "ExecutionCompleted"
  | "RepoIndexRequested"
  | "RepoIndexed"
  | "NotificationRequested"
  | "BillingCheckRequested";

export interface DomainEventPayloads {
  TaskPlanningRequested: {
    taskId: string;
    userId: string;
    repoId: string;
    brainstormResult: string;
    continueToExecution: boolean;
    repoName: string;
    repoFullName: string;
    repoDefaultBranch: string;
    techStack?: string[];
  };
  TaskPlanned: {
    taskId: string;
    userId: string;
    repoId: string;
    planSteps: number;
    autoApprove: boolean;
  };
  TaskApproved: {
    taskId: string;
    userId: string;
    repoId: string;
    autoExecute: boolean;
  };
  TaskExecutionRequested: {
    executionId: string;
    taskId: string;
    repoId: string;
    userId: string;
    aiProvider: string;
    preferredModel: string;
    planContent: string;
    branch: string;
    defaultBranch: string;
    cloneUrl: string;
  };
  ExecutionStarted: {
    executionId: string;
    taskId: string;
    repoId: string;
    userId: string;
  };
  ExecutionFailed: {
    executionId: string;
    taskId: string;
    repoId: string;
    userId: string;
    reason: string;
  };
  ExecutionCompleted: {
    executionId: string;
    taskId: string;
    repoId: string;
    userId: string;
  };
  RepoIndexRequested: {
    repoId: string;
    userId: string;
    localPath: string;
    repoName: string;
  };
  RepoIndexed: {
    repoId: string;
    userId: string;
    success: boolean;
    fileCount?: number;
    error?: string;
  };
  NotificationRequested: {
    userId: string;
    subject: string;
    message: string;
    metadata?: Record<string, unknown>;
  };
  BillingCheckRequested: {
    userId: string;
    taskId: string;
    executionId?: string;
  };
}

export const domainEventCatalog: Array<{
  type: DomainEventType;
  description: string;
}> = [
  {
    type: "TaskPlanningRequested",
    description: "A task has requested a planning job to be queued.",
  },
  {
    type: "TaskPlanned",
    description: "A task plan has been generated and stored.",
  },
  {
    type: "TaskApproved",
    description: "A planned task has been approved for execution.",
  },
  {
    type: "TaskExecutionRequested",
    description: "A task execution job should be queued.",
  },
  {
    type: "ExecutionStarted",
    description: "An execution has begun running.",
  },
  {
    type: "ExecutionFailed",
    description: "An execution failed and needs follow-up actions.",
  },
  {
    type: "ExecutionCompleted",
    description: "An execution finished successfully.",
  },
  {
    type: "RepoIndexRequested",
    description: "Repository indexing should be queued.",
  },
  {
    type: "RepoIndexed",
    description: "Repository indexing finished (success or failure).",
  },
  {
    type: "NotificationRequested",
    description: "A user notification should be delivered.",
  },
  {
    type: "BillingCheckRequested",
    description: "Billing limits should be validated for an action.",
  },
];
