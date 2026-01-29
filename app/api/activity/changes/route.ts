import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { db, pendingChanges, repos, tasks } from "@/lib/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { handleError, Errors } from "@/lib/errors";

export const GET = withAuth(async (request, { user }) => {
  const { searchParams } = new URL(request.url);
  const repoId = searchParams.get("repoId");

  if (!repoId) {
    return handleError(Errors.invalidRequest("repoId is required"));
  }

  // Verify repo ownership
  const repo = await db.query.repos.findFirst({
    where: and(eq(repos.id, repoId), eq(repos.userId, user.id)),
  });

  if (!repo) {
    return handleError(Errors.notFound("Repository"));
  }

  // Get all tasks for this repo
  const repoTasks = await db.query.tasks.findMany({
    where: eq(tasks.repoId, repoId),
    columns: { id: true, title: true },
  });

  if (repoTasks.length === 0) {
    return NextResponse.json({ changes: [] });
  }

  const taskIds = repoTasks.map((t) => t.id);
  const taskMap = new Map(repoTasks.map((t) => [t.id, t]));

  // Get pending changes for these tasks
  const changes = await db
    .select({
      id: pendingChanges.id,
      taskId: pendingChanges.taskId,
      filePath: pendingChanges.filePath,
      action: pendingChanges.action,
      isApproved: pendingChanges.isApproved,
      createdAt: pendingChanges.createdAt,
    })
    .from(pendingChanges)
    .where(inArray(pendingChanges.taskId, taskIds))
    .orderBy(desc(pendingChanges.createdAt));

  // Enrich with task info
  const enrichedChanges = changes.map((change) => ({
    ...change,
    task: taskMap.get(change.taskId) || { id: change.taskId, title: "Unknown" },
  }));

  return NextResponse.json({ changes: enrichedChanges });
});
