import type { StatusHistoryEntry, Task, TaskStatus } from "@/lib/db/schema";
import { RepoId, TaskId } from "../value-objects/identifiers";
import { TaskLifecycleRules } from "../value-objects/task-lifecycle";
import { TaskStatusTransition } from "../value-objects/task-status-transition";

export type TaskAggregateSnapshot = Task;

type TaskUpdateInput = Partial<{
  title: string;
  description: string | null;
  priority: number;
  branch: string | null;
  autonomousMode: boolean;
  autoApprove: boolean;
  status: TaskStatus;
  resetPhases: boolean;
  statusTriggeredBy: StatusHistoryEntry["triggeredBy"];
  statusTriggeredByUserId?: string;
  planContent: string | null;
}>;

export class TaskAggregate {
  private changes: Partial<TaskAggregateSnapshot> = {};

  private constructor(private state: TaskAggregateSnapshot) {}

  static fromPersistence(record: TaskAggregateSnapshot): TaskAggregate {
    return new TaskAggregate({ ...record });
  }

  static createNew(params: {
    id: string;
    repoId: string;
    title: string;
    description?: string | null;
    autonomousMode: boolean;
    autoApprove: boolean;
  }): TaskAggregate {
    const now = new Date();
    const state: TaskAggregateSnapshot = {
      id: params.id,
      repoId: params.repoId,
      title: params.title,
      description: params.description ?? null,
      status: "todo",
      priority: 0,
      brainstormResult: null,
      brainstormConversation: null,
      brainstormSummary: null,
      brainstormMessageCount: 0,
      brainstormCompactedAt: null,
      planContent: null,
      branch: null,
      autonomousMode: params.autonomousMode,
      autoApprove: params.autoApprove,
      processingPhase: null,
      processingJobId: null,
      processingStartedAt: null,
      processingStatusText: null,
      processingProgress: 0,
      statusHistory: [],
      prUrl: null,
      prNumber: null,
      blockedByIds: [],
      autoExecuteWhenUnblocked: false,
      dependencyPriority: 0,
      executionGraph: null,
      createdAt: now,
      updatedAt: now,
    };

    return new TaskAggregate(state);
  }

  get id(): TaskId {
    return new TaskId(this.state.id);
  }

  get repoId(): RepoId {
    return new RepoId(this.state.repoId);
  }

  get snapshot(): TaskAggregateSnapshot {
    return { ...this.state };
  }

  getChanges(): Partial<TaskAggregateSnapshot> {
    return { ...this.changes };
  }

  clearChanges() {
    this.changes = {};
  }

  private setField<K extends keyof TaskAggregateSnapshot>(
    key: K,
    value: TaskAggregateSnapshot[K],
  ) {
    if (this.state[key] !== value) {
      this.state[key] = value;
      this.changes[key] = value;
    }
  }

  updateDetails(input: TaskUpdateInput) {
    if (input.title !== undefined) {
      this.setField("title", input.title);
    }

    if (input.description !== undefined) {
      this.setField("description", input.description);
    }

    if (input.priority !== undefined) {
      this.setField("priority", input.priority);
    }

    if (input.branch !== undefined) {
      this.setField("branch", input.branch);
    }

    if (input.autonomousMode !== undefined) {
      this.setField("autonomousMode", input.autonomousMode);
    }

    if (input.autoApprove !== undefined) {
      this.setField("autoApprove", input.autoApprove);
    }

    if (input.planContent !== undefined) {
      this.setField("planContent", input.planContent);
    }

    if (input.status !== undefined) {
      this.transitionStatus(input.status, {
        triggeredBy: input.statusTriggeredBy ?? "user",
        userId: input.statusTriggeredByUserId,
        resetPhases: input.resetPhases ?? false,
      });
    }
  }

  transitionStatus(
    nextStatus: TaskStatus,
    options: {
      triggeredBy: StatusHistoryEntry["triggeredBy"];
      userId?: string;
      resetPhases: boolean;
    },
  ) {
    const transition = new TaskStatusTransition(this.state.status, nextStatus);
    TaskLifecycleRules.assertStatusTransition(transition, this.state);

    if (transition.isNoop()) {
      return;
    }

    const historyEntry: StatusHistoryEntry = {
      from: this.state.status,
      to: nextStatus,
      timestamp: new Date().toISOString(),
      triggeredBy: options.triggeredBy,
      userId: options.userId,
    };

    this.setField("status", nextStatus);
    this.setField("statusHistory", [
      ...(this.state.statusHistory || []),
      historyEntry,
    ]);

    if (options.resetPhases) {
      const resets = TaskLifecycleRules.getResetFields(nextStatus);
      if (resets.brainstormResult !== undefined) {
        this.setField("brainstormResult", resets.brainstormResult);
      }
      if (resets.planContent !== undefined) {
        this.setField("planContent", resets.planContent);
      }
    }
  }

  claimExecution(branch: string) {
    TaskLifecycleRules.assertStatusTransition(
      new TaskStatusTransition(this.state.status, "executing"),
      this.state,
    );
    this.setField("status", "executing");
    this.setField("branch", branch);
  }

  revertExecution(previousStatus: TaskStatus) {
    this.setField("status", previousStatus);
    this.setField("branch", null);
  }

  updateExecutionGraph(graph: TaskAggregateSnapshot["executionGraph"]) {
    this.setField("executionGraph", graph ?? null);
  }

  recordBrainstorm(params: {
    brainstormResult?: string;
    brainstormConversation?: string;
  }) {
    if (params.brainstormResult !== undefined) {
      this.setField("brainstormResult", params.brainstormResult);
    }
    if (params.brainstormConversation !== undefined) {
      this.setField("brainstormConversation", params.brainstormConversation);
    }
  }

  addDependency(blockedById: string) {
    if (blockedById === this.state.id) {
      throw new Error("Cannot depend on self");
    }

    const current = this.state.blockedByIds ?? [];
    if (current.includes(blockedById)) {
      return;
    }

    this.setField("blockedByIds", [...current, blockedById]);
  }

  removeDependency(blockedById: string) {
    const current = this.state.blockedByIds ?? [];
    if (!current.includes(blockedById)) {
      return;
    }

    this.setField(
      "blockedByIds",
      current.filter((id) => id !== blockedById),
    );
  }

  updateDependencySettings(params: {
    autoExecuteWhenUnblocked?: boolean;
    dependencyPriority?: number;
  }) {
    if (params.autoExecuteWhenUnblocked !== undefined) {
      this.setField("autoExecuteWhenUnblocked", params.autoExecuteWhenUnblocked);
    }
    if (params.dependencyPriority !== undefined) {
      this.setField("dependencyPriority", params.dependencyPriority);
    }
  }
}
