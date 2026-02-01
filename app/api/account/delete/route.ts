import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { db } from "@/lib/db";
import {
  users,
  repos,
  tasks,
  executions,
  activityEvents,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { clientLogger } from "@/lib/logger";

/**
 * DELETE /api/account/delete
 *
 * Permanently deletes the user account and all associated data.
 *
 * Deletion includes:
 * - All tasks (cascade deletes executionLogs, executionEvents)
 * - All repositories
 * - All activity events
 * - User account
 *
 * This action is irreversible.
 */
export const DELETE = withAuth(async (request, { user }) => {
  try {
    // Log the deletion attempt
    clientLogger.info("Account deletion initiated", { userId: user.id });

    // Delete in order to respect foreign key constraints
    // 1. Delete activity events
    await db.delete(activityEvents).where(eq(activityEvents.userId, user.id));

    // 2. Delete executions (cascade will handle execution_events and execution_logs)
    const userTasks = await db.query.tasks.findMany({
      where: eq(tasks.userId, user.id),
      columns: { id: true },
    });

    if (userTasks.length > 0) {
      const taskIds = userTasks.map((t) => t.id);
      for (const taskId of taskIds) {
        await db.delete(executions).where(eq(executions.taskId, taskId));
      }
    }

    // 3. Delete tasks
    await db.delete(tasks).where(eq(tasks.userId, user.id));

    // 4. Delete repos
    await db.delete(repos).where(eq(repos.userId, user.id));

    // 5. Delete user account
    await db.delete(users).where(eq(users.id, user.id));

    clientLogger.info("Account deleted successfully", { userId: user.id });

    return NextResponse.json(
      {
        success: true,
        message: "Account deleted successfully",
      },
      { status: 200 },
    );
  } catch (error) {
    clientLogger.error("Account deletion failed", {
      userId: user.id,
      error,
    });

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete account",
      },
      { status: 500 },
    );
  }
});
