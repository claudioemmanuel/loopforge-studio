import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, activityEvents, tasks, repos } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { handleError, Errors } from "@/lib/errors";

/**
 * GET /api/activity
 * Fetches recent activity events for a repository
 * Phase 2.3: Activity Tracking System
 */
export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  const { searchParams } = new URL(request.url);
  const repoId = searchParams.get("repoId");
  const limit = parseInt(searchParams.get("limit") || "50");

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

    // Fetch activity events for tasks in this repo
    const events = await db
      .select({
        id: activityEvents.id,
        eventType: activityEvents.eventType,
        title: activityEvents.title,
        content: activityEvents.content,
        createdAt: activityEvents.createdAt,
        taskId: tasks.id,
        taskTitle: tasks.title,
        metadata: activityEvents.metadata,
      })
      .from(activityEvents)
      .innerJoin(tasks, eq(activityEvents.taskId, tasks.id))
      .where(eq(tasks.repoId, repoId))
      .orderBy(desc(activityEvents.createdAt))
      .limit(limit);

    // Transform to expected format
    const formattedEvents = events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      title: event.title || `${event.eventType} event`, // Fallback title if not provided
      content: event.content,
      createdAt: event.createdAt.toISOString(),
      task: event.taskId
        ? {
            id: event.taskId,
            title: event.taskTitle,
          }
        : undefined,
      metadata: event.metadata,
    }));

    return NextResponse.json({
      events: formattedEvents,
      total: formattedEvents.length,
    });
  } catch (error) {
    return handleError(error);
  }
}
