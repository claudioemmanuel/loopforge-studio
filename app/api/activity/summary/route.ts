import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, executions, executionEvents, tasks, repos } from "@/lib/db";
import { eq, and, sql, gte } from "drizzle-orm";
import { handleError, Errors } from "@/lib/errors";

/**
 * GET /api/activity/summary
 * Fetches activity summary statistics for a repository
 * Phase 2.3: Activity Tracking System
 */
export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return handleError(Errors.unauthorized());
  }

  const { searchParams } = new URL(request.url);
  const repoId = searchParams.get("repoId");
  const days = parseInt(searchParams.get("days") || "7");

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

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);

    // Count executions by status
    const executionStats = await db
      .select({
        status: executions.status,
        count: sql<number>`count(*)::int`,
      })
      .from(executions)
      .innerJoin(tasks, eq(executions.taskId, tasks.id))
      .where(and(eq(tasks.repoId, repoId), gte(executions.startedAt, daysAgo)))
      .groupBy(executions.status);

    // Count events by type
    const eventStats = await db
      .select({
        eventType: executionEvents.eventType,
        count: sql<number>`count(*)::int`,
      })
      .from(executionEvents)
      .innerJoin(tasks, eq(executionEvents.taskId, tasks.id))
      .where(
        and(eq(tasks.repoId, repoId), gte(executionEvents.createdAt, daysAgo)),
      )
      .groupBy(executionEvents.eventType);

    // Get total events count
    const totalEvents = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(executionEvents)
      .innerJoin(tasks, eq(executionEvents.taskId, tasks.id))
      .where(
        and(eq(tasks.repoId, repoId), gte(executionEvents.createdAt, daysAgo)),
      );

    return NextResponse.json({
      period: { days, since: daysAgo.toISOString() },
      executions: executionStats.reduce(
        (acc, stat) => {
          acc[stat.status] = stat.count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      events: {
        total: totalEvents[0]?.count || 0,
        byType: eventStats.reduce(
          (acc, stat) => {
            acc[stat.eventType] = stat.count;
            return acc;
          },
          {} as Record<string, number>,
        ),
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
