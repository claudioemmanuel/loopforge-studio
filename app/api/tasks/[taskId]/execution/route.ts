import { NextResponse } from "next/server";
import { withTask } from "@/lib/api";
import { getExecutionService } from "@/lib/contexts/execution/api";

/**
 * GET /api/tasks/[taskId]/execution
 * Returns task details, latest execution, and all events for the execution page
 */
export const GET = withTask(async (request, { task, taskId }) => {
  const executionService = getExecutionService();
  const execution = await executionService.getLatestForTask(taskId);

  const events = execution
    ? await executionService.getExecutionEvents(execution.id)
    : [];

  return NextResponse.json({
    task: {
      ...task,
      repo: {
        ...task.repo,
        isCloned: task.repo.isCloned,
        indexingStatus: task.repo.indexingStatus,
      },
    },
    execution,
    events,
  });
});
