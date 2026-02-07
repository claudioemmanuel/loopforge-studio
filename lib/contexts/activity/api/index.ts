import { getExecutionService } from "@/lib/contexts/execution/api";

import type { ExecutionEvent } from "@/lib/db/schema";

type ExecutionWithOwnership = NonNullable<
  Awaited<
    ReturnType<
      ReturnType<typeof getExecutionService>["getExecutionWithOwnership"]
    >
  >
>;

export async function getExecutionDetailForUser(
  userId: string,
  executionId: string,
): Promise<{
  execution: ExecutionWithOwnership;
  events: ExecutionEvent[];
} | null> {
  const executionService = getExecutionService();
  const execution =
    await executionService.getExecutionWithOwnership(executionId);

  if (!execution) {
    return null;
  }

  if (execution.task.repo.userId !== userId) {
    return null;
  }

  const events = await executionService.getExecutionEvents(execution.id);

  return {
    execution,
    events,
  };
}
