import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, activityEvents, tasks, repos } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { handleError, Errors } from "@/lib/errors";

/**
 * GET /api/activity/history
 * Fetches execution history for a repository
 * Phase 2.3: Activity Tracking System
 */
export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  const { searchParams } = new URL(request.url);
  const repoId = searchParams.get("repoId");
  const limit = parseInt(searchParams.get("limit") || "20");

  if (!repoId) {
    return handleError(Errors.invalidRequest("repoId is required"));
  }

  try {
    // Verify user owns this repo
    const repo = await db.query.repos.findFirst({
      where: and(eq(repos.id, repoId), eq(repos.userId, session.user.id)),
    });

    if (!repo) {
      return handleError(Errors.notFound("Repository"));
    }

    // Fetch activity history for this repo's tasks
    const history = await db
      .select({
        id: activityEvents.id,
        taskId: tasks.id,
        taskTitle: tasks.title,
        eventType: activityEvents.eventType,
        eventCategory: activityEvents.eventCategory,
        title: activityEvents.title,
        content: activityEvents.content,
        createdAt: activityEvents.createdAt,
        metadata: activityEvents.metadata,
      })
      .from(activityEvents)
      .innerJoin(tasks, eq(activityEvents.taskId, tasks.id))
      .where(eq(tasks.repoId, repoId))
      .orderBy(desc(activityEvents.createdAt))
      .limit(limit);

    return NextResponse.json({
      history,
      total: history.length,
    });
  } catch (error) {
    return handleError(error);
  }
}
