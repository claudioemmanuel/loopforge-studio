import type { TaskStatus } from "./TaskStatus";

/**
 * ProcessingPhase value object - Active processing state
 */
export type ProcessingPhase = "brainstorming" | "planning" | "executing";

export function getProcessingPhaseForStatus(
  status: TaskStatus,
): ProcessingPhase | null {
  switch (status) {
    case "brainstorming":
      return "brainstorming";
    case "planning":
      return "planning";
    case "executing":
      return "executing";
    default:
      return null;
  }
}

export function isValidProcessingPhase(
  value: string,
): value is ProcessingPhase {
  return ["brainstorming", "planning", "executing"].includes(value);
}
