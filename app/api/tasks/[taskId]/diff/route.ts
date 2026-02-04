/**
 * GET /api/tasks/[taskId]/diff
 * Get pending changes for a task in review status
 */

import { NextResponse } from "next/server";
import {
  getPendingChangesByTask,
  countPendingChanges,
} from "@/lib/db/pending-changes";
import { getLatestTestRun, getTestRunSummary } from "@/lib/db/test-runs";
import { withTask } from "@/lib/api";
import { getExecutionService } from "@/lib/contexts/execution/api";

export const GET = withTask(async (request, { task, taskId }) => {
  // Task should be in review status to have pending changes
  if (task.status !== "review" && task.status !== "executing") {
    return NextResponse.json({
      changes: [],
      summary: { total: 0, approved: 0, pending: 0 },
      testRun: null,
      message: `Task status is ${task.status}, no pending changes`,
    });
  }

  // Get pending changes
  const changes = await getPendingChangesByTask(taskId);

  const executionService = getExecutionService();
  const latestExecution = await executionService.getLatestForTask(taskId);

  let testRunData = null;

  if (latestExecution) {
    const testRun = await getLatestTestRun(taskId);
    if (testRun) {
      testRunData = {
        ...testRun,
        ...getTestRunSummary(testRun),
      };
    }

    // Get counts
    const counts = await countPendingChanges(latestExecution.id);

    return NextResponse.json({
      taskId,
      executionId: latestExecution.id,
      changes,
      summary: counts,
      testRun: testRunData,
      canApprove: counts.pending === 0 || counts.total > 0,
      canReject: counts.total > 0,
    });
  }

  return NextResponse.json({
    taskId,
    changes: [],
    summary: { total: 0, approved: 0, pending: 0 },
    testRun: null,
    canApprove: false,
    canReject: false,
  });
});
