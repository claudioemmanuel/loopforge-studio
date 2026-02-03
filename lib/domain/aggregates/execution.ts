import type { Execution } from "@/lib/db/schema";
import { ExecutionId, TaskId } from "../value-objects/identifiers";

export type ExecutionAggregateSnapshot = Execution;

export class ExecutionAggregate {
  private constructor(private state: ExecutionAggregateSnapshot) {}

  static createQueued(params: { id: string; taskId: string }): ExecutionAggregate {
    const now = new Date();
    return new ExecutionAggregate({
      id: params.id,
      taskId: params.taskId,
      status: "queued",
      iteration: 0,
      startedAt: null,
      completedAt: null,
      errorMessage: null,
      logsPath: null,
      commits: null,
      branch: null,
      prUrl: null,
      prNumber: null,
      reverted: false,
      revertCommitSha: null,
      revertedAt: null,
      revertReason: null,
      stuckSignals: null,
      recoveryAttempts: null,
      validationReport: null,
      tokenMetrics: {},
      skillExecutions: [],
      createdAt: now,
    });
  }

  get id(): ExecutionId {
    return new ExecutionId(this.state.id);
  }

  get taskId(): TaskId {
    return new TaskId(this.state.taskId);
  }

  get snapshot(): ExecutionAggregateSnapshot {
    return { ...this.state };
  }
}
