import type { TaskStatus } from "@/lib/db/schema";
import type { TaskAggregateSnapshot } from "../aggregates/task";
import { TaskStatusTransition } from "./task-status-transition";

const allowedTransitions: Record<TaskStatus, TaskStatus[]> = {
  todo: ["todo", "brainstorming", "planning", "ready", "stuck"],
  brainstorming: ["brainstorming", "planning", "ready", "stuck", "todo"],
  planning: ["planning", "ready", "stuck", "todo", "brainstorming"],
  ready: ["ready", "executing", "stuck", "todo", "brainstorming", "planning"],
  executing: ["executing", "review", "done", "stuck"],
  review: ["review", "done", "stuck", "executing"],
  done: ["done", "review", "stuck"],
  stuck: ["stuck", "todo", "brainstorming", "planning", "ready"],
};

export class TaskLifecycleRules {
  static assertStatusTransition(
    transition: TaskStatusTransition,
    snapshot: TaskAggregateSnapshot,
  ) {
    if (transition.isNoop()) {
      return;
    }

    const allowed = allowedTransitions[transition.from] ?? [];
    if (!allowed.includes(transition.to)) {
      throw new Error(
        `Invalid task status transition: ${transition.from} -> ${transition.to}`,
      );
    }

    if (transition.to === "executing" && !snapshot.planContent) {
      throw new Error("Task must have a plan to execute");
    }
  }

  static getResetFields(targetStatus: TaskStatus): Partial<TaskAggregateSnapshot> {
    if (targetStatus === "todo") {
      return { brainstormResult: null, planContent: null };
    }

    if (targetStatus === "brainstorming") {
      return { planContent: null };
    }

    return {};
  }
}
