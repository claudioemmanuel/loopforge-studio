import { NextResponse } from "next/server";
import { withTask } from "@/lib/api";
import { getExecutionService } from "@/lib/contexts/execution/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = withTask(async (request, { task, taskId }) => {
  void request;

  const executionService = getExecutionService();
  const execution = await executionService.getLatestForTask(taskId);

  const events = execution
    ? await executionService.getExecutionEvents(execution.id)
    : [];

  return NextResponse.json({
    task,
    execution,
    events,
  });
});
