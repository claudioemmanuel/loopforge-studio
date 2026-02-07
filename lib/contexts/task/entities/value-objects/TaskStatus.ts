/**
 * TaskStatus value object - Valid task lifecycle states
 */
export type TaskStatus =
  | "todo"
  | "brainstorming"
  | "planning"
  | "ready"
  | "executing"
  | "review"
  | "done"
  | "stuck";

export function isValidTaskStatus(value: string): value is TaskStatus {
  return [
    "todo",
    "brainstorming",
    "planning",
    "ready",
    "executing",
    "review",
    "done",
    "stuck",
  ].includes(value);
}

export function validateTaskStatus(value: string): TaskStatus {
  if (!isValidTaskStatus(value)) {
    throw new Error(`Invalid task status: ${value}`);
  }
  return value;
}

/**
 * Valid status transitions for task lifecycle
 */
export const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  todo: ["brainstorming"],
  brainstorming: ["planning", "todo"],
  planning: ["ready", "todo"],
  ready: ["executing", "todo"],
  executing: ["review", "done", "stuck", "ready"],
  review: ["done", "executing"],
  done: [],
  stuck: ["todo", "ready"],
};

export function canTransitionTo(from: TaskStatus, to: TaskStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
