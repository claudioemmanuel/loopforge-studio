import { NextResponse } from "next/server";
import { db, executions, executionEvents } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { withTask } from "@/lib/api";

/**
 * GET /api/tasks/[taskId]/execution
 * Returns task details, latest execution, and all events for the execution page
 */
export const GET = withTask(async (request, { task, taskId }) => {
  // Get latest execution for this task
  const execution = await db.query.executions.findFirst({
    where: eq(executions.taskId, taskId),
    orderBy: [desc(executions.createdAt)],
  });

  // Get execution events if we have an execution
  let events: Array<typeof executionEvents.$inferSelect> = [];
  if (execution) {
    events = await db.query.executionEvents.findMany({
      where: eq(executionEvents.executionId, execution.id),
      orderBy: [executionEvents.createdAt],
    });
  }

  return NextResponse.json({
    task: {
      ...task,
      repo: {
        ...task.repo,
        // Include clone/index status from repo
        isCloned: task.repo.isCloned,
        indexingStatus: task.repo.indexingStatus,
      },
    },
    execution,
    events,
  });
});
