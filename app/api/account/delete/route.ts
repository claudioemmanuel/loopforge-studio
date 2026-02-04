import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { clientLogger } from "@/lib/logger";
import { getAnalyticsService } from "@/lib/contexts/analytics/api";
import { getRepositoryService } from "@/lib/contexts/repository/api";
import { getTaskService } from "@/lib/contexts/task/api";
import { getExecutionService } from "@/lib/contexts/execution/api";
import { getUserService } from "@/lib/contexts/iam/api";

/**
 * DELETE /api/account/delete
 *
 * Permanently deletes the user account and all associated data.
 * Deletion order respects FK constraints:
 *   activityEvents → executions → tasks → repos → user
 *
 * This action is irreversible.
 */
export const DELETE = withAuth(async (_request, { user }) => {
  try {
    clientLogger.info("Account deletion initiated", { userId: user.id });

    const analyticsService = getAnalyticsService();
    const repositoryService = getRepositoryService();
    const taskService = getTaskService();
    const executionService = getExecutionService();
    const userService = getUserService();

    // 1. Activity events
    await analyticsService.deleteUserActivities(user.id);

    // 2. Resolve repo → task IDs for cascade
    const userRepos = await repositoryService.listUserRepositories(user.id);
    const repoIds = userRepos.map((r) => r.id);
    const taskIds = await taskService.getIdsByRepoIds(repoIds);

    // 3. Executions (cascade handles execution_events / execution_logs)
    await executionService.deleteByTaskIds(taskIds);

    // 4. Tasks
    await taskService.deleteByRepoIds(repoIds);

    // 5. Repos
    await repositoryService.deleteAllByUser(user.id);

    // 6. User row
    await userService.deleteUser(user.id);

    clientLogger.info("Account deleted successfully", { userId: user.id });

    return NextResponse.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    clientLogger.error("Account deletion failed", {
      userId: user.id,
      error,
    });

    return NextResponse.json(
      { success: false, error: "Failed to delete account" },
      { status: 500 },
    );
  }
});
